"""Shared dependency-free LLM client for VerdictSwarm agents.

Design goals:
- **Stdlib only** (urllib/json/os/re)
- Simple, explicit provider support:
  - Gemini (Google Generative Language API)
  - Grok (xAI chat completions)
- Helpers for **JSON-first** responses with robust extraction.

All agents should accept an optional ``AIClient`` and fall back to heuristic
analysis when the relevant API key isn't configured.

Environment variables:
- ``GEMINI_API_KEY`` (enables Gemini)
- ``GEMINI_FLASH_MODEL`` (default: gemini-3-flash)
- ``GEMINI_PRO_MODEL`` (default: gemini-3-pro)
- ``XAI_API_KEY`` (enables Grok)
- ``XAI_MODEL`` (default: grok-4)
- ``OPENAI_API_KEY`` (enables OpenAI)
- ``ANTHROPIC_API_KEY`` (enables Anthropic)
- ``MOONSHOT_API_KEY`` (enables Moonshot/Kimi)
"""

from __future__ import annotations

import json
import logging
import os
import re
import socket
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# Ensure outbound HTTP requests fail fast (avoid CLI hangs on network stalls)
socket.setdefaulttimeout(30.0)


logger = logging.getLogger(__name__)

Provider = Literal["gemini", "xai", "openai", "anthropic", "moonshot"]


def _extract_first_json_object(text: str) -> str:
    """Best-effort extraction of the first JSON object from model output.

    Uses brace-depth matching instead of greedy regex to handle nested objects
    and avoid grabbing trailing garbage that breaks JSON.parse.
    """

    s = (text or "").strip()
    if not s:
        raise ValueError("Empty model response")

    # Common: fenced code blocks.
    s = re.sub(r"^```(?:json)?\s*", "", s.strip(), flags=re.IGNORECASE)
    s = re.sub(r"\s*```$", "", s.strip())

    # Find first '{' and match braces to find the complete object.
    start = s.find("{")
    if start == -1:
        return s

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(s)):
        c = s[i]
        if escape:
            escape = False
            continue
        if c == "\\":
            escape = True
            continue
        if c == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]

    # Fallback: greedy regex if brace matching failed (unclosed object).
    match = re.search(r"\{.*\}", s, flags=re.DOTALL)
    return match.group(0) if match else s


@dataclass
class AIClient:
    """Minimal HTTP LLM client."""

    gemini_api_key: str = ""
    xai_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    moonshot_api_key: str = ""

    gemini_flash_model: str = ""
    gemini_pro_model: str = ""
    xai_model: str = ""
    timeout_s: float = 20.0

    # Optional per-provider model defaults (overridable via env)
    openai_model: str = ""
    anthropic_model: str = ""
    moonshot_model: str = ""

    # Endpoints
    _XAI_CHAT_COMPLETIONS_URL: str = "https://api.x.ai/v1/chat/completions"
    _OPENAI_CHAT_COMPLETIONS_URL: str = "https://api.openai.com/v1/chat/completions"
    _MOONSHOT_CHAT_COMPLETIONS_URL: str = "https://api.moonshot.cn/v1/chat/completions"
    _ANTHROPIC_MESSAGES_URL: str = "https://api.anthropic.com/v1/messages"
    _GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"

    def __post_init__(self) -> None:
        if not self.gemini_api_key:
            self.gemini_api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
        if not self.xai_api_key:
            self.xai_api_key = (os.getenv("XAI_API_KEY") or "").strip()
        if not self.openai_api_key:
            self.openai_api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
        if not self.anthropic_api_key:
            self.anthropic_api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
        if not self.moonshot_api_key:
            self.moonshot_api_key = (os.getenv("MOONSHOT_API_KEY") or "").strip()

        # Gemini model defaults: keep in sync with currently-available public API model IDs.
        if not self.gemini_flash_model:
            self.gemini_flash_model = (os.getenv("GEMINI_FLASH_MODEL") or "gemini-2.5-flash").strip()
        if not self.gemini_pro_model:
            self.gemini_pro_model = (os.getenv("GEMINI_PRO_MODEL") or "gemini-2.5-pro").strip()
        if not self.xai_model:
            self.xai_model = (os.getenv("XAI_MODEL") or "grok-3").strip()

        # Other provider model defaults
        if not self.openai_model:
            self.openai_model = (os.getenv("OPENAI_MODEL") or "gpt-4o-mini").strip()
        if not self.anthropic_model:
            # Anthropic public API model IDs (keep conservative default).
            self.anthropic_model = (os.getenv("ANTHROPIC_MODEL") or "claude-3-5-sonnet-20241022").strip()
        if not self.moonshot_model:
            # Moonshot public API model IDs (Kimi). "moonshot-v1-8k" is widely available.
            self.moonshot_model = (os.getenv("MOONSHOT_MODEL") or "moonshot-v1-8k").strip()

    # -------------------- Capability --------------------

    def has_provider(self, provider: Provider) -> bool:
        if provider == "gemini":
            return bool(self.gemini_api_key)
        if provider == "xai":
            return bool(self.xai_api_key)
        if provider == "openai":
            return bool(self.openai_api_key)
        if provider == "anthropic":
            return bool(self.anthropic_api_key)
        if provider == "moonshot":
            return bool(self.moonshot_api_key)
        return False

    # -------------------- Public helpers --------------------

    def chat_text(
        self,
        *,
        provider: Provider,
        system: str,
        user: str,
        model: Optional[str] = None,
        temperature: float = 0.4,
        max_output_tokens: int = 700,
        json_mode: bool = False,
    ) -> str:
        """Request a plain-text response from a provider.

        Unlike ``chat_json``, this method returns the raw model output as a
        string without JSON parsing.  Useful for debate arguments, narratives,
        and other free-form text generation.

        Set *json_mode* to True to keep the Gemini ``responseMimeType``
        set to ``application/json`` (default is ``text/plain``).
        """

        if not self.has_provider(provider):
            raise RuntimeError(f"Provider not configured: {provider}")

        return self._chat_text(
            provider=provider,
            system=system,
            user=user,
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            json_mode=json_mode,
        )

    def chat_json(
        self,
        *,
        provider: Provider,
        system: str,
        user: str,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_output_tokens: int = 700,
    ) -> Dict[str, Any]:
        """Request a JSON object response.

        Raises:
            RuntimeError if provider isn't configured.
            ValueError on parsing issues.
        """

        if not self.has_provider(provider):
            raise RuntimeError(f"Provider not configured: {provider}")

        last_error: Optional[Exception] = None
        raw_text = ""
        for attempt in range(3):  # retry up to 3 times on JSON parse failure
            try:
                if attempt > 0:
                    time.sleep(1.5)  # delay before retries to let transient issues clear
                raw_text = self._chat_text(
                    provider=provider,
                    system=system,
                    user=user,
                    model=model,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                )

                json_text = _extract_first_json_object(raw_text)
                try:
                    return json.loads(json_text)
                except json.JSONDecodeError:
                    # Some providers/models occasionally return JSON-like objects with
                    # trailing commas or smart quotes. Try a minimal cleanup pass.
                    cleaned = (
                        json_text.replace("\u201c", '"')
                        .replace("\u201d", '"')
                        .replace("\u2018", "'")
                        .replace("\u2019", "'")
                    )
                    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)  # remove trailing commas
                    # Fix missing commas between elements: }"key" or ]"key" or "value""key"
                    cleaned = re.sub(r'"\s*\n\s*"', '",\n"', cleaned)
                    # Fix missing commas after ] or } before "
                    cleaned = re.sub(r'([\]}])\s*\n\s*"', r'\1,\n"', cleaned)
                    cleaned = cleaned.strip()
                    return json.loads(cleaned)
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(
                    f"chat_json attempt {attempt+1}/3 failed for {provider}: {e}. "
                    f"Raw response (first 200 chars): {raw_text[:200]}"
                )
                last_error = e
                if attempt < 2:
                    # Bump temperature slightly to get different output
                    temperature = min(temperature + 0.1, 0.5)
                    continue
                raise
        raise last_error or ValueError("JSON parse failed after retries")

    # -------------------- Provider implementations --------------------

    def _request_json(self, req: Request) -> Dict[str, Any]:
        """Execute an HTTP request and parse JSON.

        Raises a ValueError/RuntimeError with the response body included when possible.
        """

        try:
            with urlopen(req, timeout=float(self.timeout_s)) as resp:
                raw = resp.read().decode("utf-8")
        except HTTPError as e:
            # HTTPError is also a file-like object; it may contain a helpful JSON body.
            try:
                body = e.read().decode("utf-8")
            except Exception:
                body = ""
            raise RuntimeError(
                f"HTTP {e.code} for {req.full_url}: {body or e.reason}"
            ) from e
        except (socket.timeout, TimeoutError) as e:
            raise TimeoutError(f"Timeout after {self.timeout_s}s for {req.full_url}") from e
        except URLError as e:
            raise RuntimeError(f"Network error for {req.full_url}: {e.reason}") from e

        try:
            return json.loads(raw)
        except Exception as e:
            raise ValueError(f"Invalid JSON response from {req.full_url}: {raw[:2000]}") from e

    def _chat_text(
        self,
        *,
        provider: Provider,
        system: str,
        user: str,
        model: Optional[str],
        temperature: float,
        max_output_tokens: int,
        json_mode: bool = True,
    ) -> str:
        if provider == "xai":
            return self._xai_chat_text(
                system=system,
                user=user,
                model=model or self.xai_model,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )
        if provider == "openai":
            return self._openai_chat_text(
                system=system,
                user=user,
                model=model or self.openai_model or "gpt-4o-mini",
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )
        if provider == "moonshot":
            return self._moonshot_chat_text(
                system=system,
                user=user,
                model=model or self.moonshot_model or "moonshot-v1-8k",
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )
        if provider == "anthropic":
            return self._anthropic_chat_text(
                system=system,
                user=user,
                model=model or self.anthropic_model or "claude-3-5-sonnet-20241022",
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )
        if provider == "gemini":
            # Prefer flash unless caller overrides.
            use_model = model or self.gemini_flash_model
            return self._gemini_generate_text(
                system=system,
                user=user,
                model=use_model,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                json_mode=json_mode,
            )
        raise ValueError(f"Unknown provider: {provider}")

    def _xai_chat_text(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": str(system)},
                {"role": "user", "content": str(user)},
            ],
            "temperature": float(temperature),
            "max_tokens": int(max_output_tokens),
        }

        data = json.dumps(payload).encode("utf-8")
        req = Request(
            self._XAI_CHAT_COMPLETIONS_URL,
            data=data,
            headers={
                "Authorization": f"Bearer {self.xai_api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "VerdictSwarm/0.1 (AIClient; stdlib; +https://github.com/vswarm-ai/verdictswarm)",
            },
            method="POST",
        )

        obj = self._request_json(req)
        content = (
            (((obj.get("choices") or [{}])[0].get("message") or {}).get("content"))
            or ""
        ).strip()
        if not content:
            raise ValueError("Empty xAI response")
        return content

    def _openai_chat_text(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": str(system)},
                {"role": "user", "content": str(user)},
            ],
            "temperature": float(temperature),
            "max_tokens": int(max_output_tokens),
        }

        data = json.dumps(payload).encode("utf-8")
        req = Request(
            self._OPENAI_CHAT_COMPLETIONS_URL,
            data=data,
            headers={
                "Authorization": f"Bearer {self.openai_api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "VerdictSwarm/0.1 (AIClient; stdlib; +https://github.com/vswarm-ai/verdictswarm)",
            },
            method="POST",
        )

        obj = self._request_json(req)
        content = (
            (((obj.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
        ).strip()
        if not content:
            raise ValueError("Empty OpenAI response")
        return content

    def _moonshot_chat_text(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": str(system)},
                {"role": "user", "content": str(user)},
            ],
            "temperature": float(temperature),
            "max_tokens": int(max_output_tokens),
        }

        data = json.dumps(payload).encode("utf-8")
        req = Request(
            self._MOONSHOT_CHAT_COMPLETIONS_URL,
            data=data,
            headers={
                "Authorization": f"Bearer {self.moonshot_api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "VerdictSwarm/0.1 (AIClient; stdlib; +https://github.com/vswarm-ai/verdictswarm)",
            },
            method="POST",
        )

        obj = self._request_json(req)
        content = (
            (((obj.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
        ).strip()
        if not content:
            raise ValueError("Empty Moonshot response")
        return content

    def _anthropic_chat_text(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str:
        payload: Dict[str, Any] = {
            "model": model,
            "max_tokens": int(max_output_tokens),
            "temperature": float(temperature),
            "system": str(system),
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": str(user)},
                    ],
                }
            ],
        }

        data = json.dumps(payload).encode("utf-8")
        req = Request(
            self._ANTHROPIC_MESSAGES_URL,
            data=data,
            headers={
                "x-api-key": self.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "VerdictSwarm/0.1 (AIClient; stdlib; +https://github.com/vswarm-ai/verdictswarm)",
            },
            method="POST",
        )

        obj = self._request_json(req)
        parts = obj.get("content") or []
        if not isinstance(parts, list):
            parts = []
        text = "".join(
            (p.get("text") or "")
            for p in parts
            if isinstance(p, dict) and (p.get("type") == "text" or "text" in p)
        ).strip()
        if not text:
            raise ValueError("Empty Anthropic response")
        return text

    def _gemini_generate_text(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float,
        max_output_tokens: int,
        json_mode: bool = True,
    ) -> str:
        # https://ai.google.dev/api/generate-content
        url = f"{self._GEMINI_BASE_URL}/models/{model}:generateContent?key={self.gemini_api_key}"
        gen_config: Dict[str, Any] = {
            "temperature": float(temperature),
            "maxOutputTokens": int(max_output_tokens),
            # Gemini 2.5 models require "thinking mode". If the thinking budget is too high
            # relative to maxOutputTokens, the model may spend the entire budget on thoughts and
            # return an empty visible response. We cap thinkingBudget to preserve room for output.
            # Min allowed appears to be 128 on Gemini 2.5 models.
            "thinkingConfig": {"thinkingBudget": max(128, min(1024, int(max_output_tokens * 0.25)))},
        }
        if json_mode:
            # Encourage strict JSON output for chat_json callers.
            gen_config["responseMimeType"] = "application/json"
        else:
            gen_config["responseMimeType"] = "text/plain"

        payload: Dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": str(user)}],
                }
            ],
            "systemInstruction": {"parts": [{"text": str(system)}]},
            "generationConfig": gen_config,
        }

        data = json.dumps(payload).encode("utf-8")
        req = Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "VerdictSwarm/0.1 (AIClient; stdlib; +https://github.com/vswarm-ai/verdictswarm)",
            },
            method="POST",
        )

        obj = self._request_json(req)
        candidates: List[Dict[str, Any]] = obj.get("candidates") or []
        if not candidates:
            raise ValueError("Empty Gemini candidates")

        content = (candidates[0].get("content") or {})
        parts = content.get("parts") or []
        text = "".join((p.get("text") or "") for p in parts if isinstance(p, dict)).strip()
        if not text:
            raise ValueError("Empty Gemini text")
        return text


__all__ = ["AIClient", "Provider"]
