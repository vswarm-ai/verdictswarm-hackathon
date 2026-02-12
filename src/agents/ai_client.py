from __future__ import annotations

import ast
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
    """Best-effort extraction of the first complete JSON object from model output."""

    s = (text or "").strip()
    if not s:
        raise ValueError("Empty model response")

    # Prefer fenced json body if present anywhere in output.
    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", s, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        s = fenced.group(1).strip()

    # Also strip leading/trailing fence markers for partial fence cases.
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE).strip()
    s = re.sub(r"\s*```$", "", s).strip()

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
        if c == '"':
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

    match = re.search(r"\{.*?\}", s, flags=re.DOTALL)
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
        if not self.has_provider(provider):
            raise RuntimeError(f"Provider not configured: {provider}")

        last_error: Optional[Exception] = None
        raw_text = ""
        for attempt in range(3):
            try:
                if attempt > 0:
                    time.sleep(1.5)
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
                    cleaned = (
                        json_text.replace("\u201c", '"')
                        .replace("\u201d", '"')
                        .replace("\u2018", "'")
                        .replace("\u2019", "'")
                    )
                    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
                    cleaned = re.sub(r"\b(?:NaN|Infinity|-Infinity)\b", "null", cleaned)
                    cleaned = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_\-]*)(\s*:)", r'\1"\2"\3', cleaned)
                    cleaned = re.sub(
                        r"'([^'\\]*(?:\\.[^'\\]*)*)'",
                        lambda m: '"' + m.group(1).replace('"', '\\"') + '"',
                        cleaned,
                    )
                    cleaned = re.sub(r'"\s*\n\s*"', '",\n"', cleaned)
                    cleaned = re.sub(r'([\]}])\s*\n\s*"', r'\1,\n"', cleaned)
                    cleaned = cleaned.strip()

                    try:
                        return json.loads(cleaned)
                    except json.JSONDecodeError:
                        py_like = cleaned
                        py_like = re.sub(r"\bnull\b", "None", py_like)
                        py_like = re.sub(r"\btrue\b", "True", py_like, flags=re.IGNORECASE)
                        py_like = re.sub(r"\bfalse\b", "False", py_like, flags=re.IGNORECASE)
                        parsed = ast.literal_eval(py_like)
                        if isinstance(parsed, dict):
                            return parsed
                        raise ValueError("Last-resort parser did not produce an object")
            except (json.JSONDecodeError, ValueError, SyntaxError) as e:
                logger.warning(
                    f"chat_json attempt {attempt+1}/3 failed for {provider}: {e}. "
                    f"Raw response (first 200 chars): {raw_text[:200]}"
                )
                last_error = e
                if attempt < 2:
                    temperature = min(temperature + 0.1, 0.5)
                    continue
                raise
        raise last_error or ValueError("JSON parse failed after retries")

    def _request_json(self, req: Request) -> Dict[str, Any]:
        try:
            with urlopen(req, timeout=float(self.timeout_s)) as resp:
                raw = resp.read().decode("utf-8")
        except HTTPError as e:
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

    def _xai_chat_text(self, *, system: str, user: str, model: str, temperature: float, max_output_tokens: int) -> str:
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
                "User-Agent": "VerdictSwarm/0.1",
            },
            method="POST",
        )
        obj = self._request_json(req)
        content = ((((obj.get("choices") or [{}])[0].get("message") or {}).get("content")) or "").strip()
        if not content:
            raise ValueError("Empty xAI response")
        return content

    def _openai_chat_text(self, *, system: str, user: str, model: str, temperature: float, max_output_tokens: int) -> str:
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
                "User-Agent": "VerdictSwarm/0.1",
            },
            method="POST",
        )
        obj = self._request_json(req)
        content = ((((obj.get("choices") or [{}])[0].get("message") or {}).get("content")) or "").strip()
        if not content:
            raise ValueError("Empty OpenAI response")
        return content

    def _moonshot_chat_text(self, *, system: str, user: str, model: str, temperature: float, max_output_tokens: int) -> str:
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
                "User-Agent": "VerdictSwarm/0.1",
            },
            method="POST",
        )
        obj = self._request_json(req)
        content = ((((obj.get("choices") or [{}])[0].get("message") or {}).get("content")) or "").strip()
        if not content:
            raise ValueError("Empty Moonshot response")
        return content

    def _anthropic_chat_text(self, *, system: str, user: str, model: str, temperature: float, max_output_tokens: int) -> str:
        payload: Dict[str, Any] = {
            "model": model,
            "max_tokens": int(max_output_tokens),
            "temperature": float(temperature),
            "system": str(system),
            "messages": [{"role": "user", "content": [{"type": "text", "text": str(user)}]}],
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
                "User-Agent": "VerdictSwarm/0.1",
            },
            method="POST",
        )
        obj = self._request_json(req)
        parts = obj.get("content") or []
        if not isinstance(parts, list):
            parts = []
        text = "".join((p.get("text") or "") for p in parts if isinstance(p, dict) and (p.get("type") == "text" or "text" in p)).strip()
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
        url = f"{self._GEMINI_BASE_URL}/models/{model}:generateContent?key={self.gemini_api_key}"
        gen_config: Dict[str, Any] = {
            "temperature": float(temperature),
            "maxOutputTokens": int(max_output_tokens),
            "thinkingConfig": {"thinkingBudget": max(128, min(1024, int(max_output_tokens * 0.25)))},
        }
        gen_config["responseMimeType"] = "application/json" if json_mode else "text/plain"
        payload: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": str(user)}]}],
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
                "User-Agent": "VerdictSwarm/0.1",
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
