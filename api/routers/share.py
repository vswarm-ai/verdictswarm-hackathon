from __future__ import annotations

import io
from typing import List, Optional

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception as e:  # pragma: no cover
    raise RuntimeError(
        "Pillow is required for /api/share/image. Add 'pillow' to api/requirements.txt"
    ) from e


router = APIRouter(prefix="/api/share", tags=["share"])


class ShareImageRequest(BaseModel):
    token_name: str = Field(..., description="Token display name")
    token_symbol: Optional[str] = Field(None, description="Token symbol, e.g. USDC")
    verdict: str = Field(..., description="Verdict label, e.g. LOW_RISK or FLAGGED")
    score: Optional[float] = Field(None, description="0-10 score; optional for FREE tier")
    key_findings: List[str] = Field(default_factory=list, description="Short bullets like 'No honeypot'")


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    # Prefer system fonts available on mac/linux images; fall back to PIL default.
    candidates = [
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    bold_candidates = [
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]

    paths = bold_candidates if bold else candidates
    for p in paths:
        try:
            return ImageFont.truetype(p, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


@router.post("/image")
def create_share_image(payload: ShareImageRequest) -> Response:
    """Generate a Twitter-card sized PNG (1200x630) for sharing scan results."""

    W, H = 1200, 630
    bg = (8, 10, 18)  # near-black
    cyan = (0, 229, 255)
    purple = (167, 106, 255)
    success = (46, 204, 113)
    danger = (255, 90, 90)
    text_dim = (210, 214, 225)
    text_muted = (150, 156, 175)

    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)

    # subtle gradient-ish bands
    d.rectangle([0, 0, W, int(H * 0.35)], fill=(10, 12, 24))
    d.rectangle([0, int(H * 0.35), W, H], fill=(8, 10, 18))

    # header
    brand_font = _load_font(34, bold=True)
    d.text((60, 42), "VerdictSwarm", fill=(235, 238, 246), font=brand_font)
    # small accent line
    d.line([(60, 92), (260, 92)], fill=cyan, width=4)

    # token name
    token_font = _load_font(60, bold=True)
    token_line = payload.token_symbol or payload.token_name
    if payload.token_symbol and payload.token_name:
        token_line = f"{payload.token_name} (${payload.token_symbol})"
    d.text((60, 150), token_line, fill=(245, 246, 250), font=token_font)

    # verdict stamp box
    verdict_norm = (payload.verdict or "").strip().upper()
    is_low_risk = "CLEAR" in verdict_norm or "HEALTHY" in verdict_norm or verdict_norm == "SAFE"
    stamp_color = success if is_low_risk else danger

    box_x, box_y, box_w, box_h = 60, 250, 520, 210
    r = 26
    # rounded rect
    d.rounded_rectangle([box_x, box_y, box_x + box_w, box_y + box_h], radius=r, outline=stamp_color, width=6, fill=(0, 0, 0, 0))

    verdict_font = _load_font(56, bold=True)
    d.text((box_x + 40, box_y + 38), verdict_norm[:22] or "VERDICT", fill=stamp_color, font=verdict_font)

    score_font = _load_font(46, bold=True)
    if payload.score is not None:
        score_text = f"✓ {payload.score:.1f}/10"
    else:
        score_text = "✓ Scan complete"
    d.text((box_x + 40, box_y + 120), score_text, fill=(235, 238, 246), font=score_font)

    # right-side accent card
    card_x, card_y, card_w, card_h = 650, 140, 490, 320
    d.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], radius=28, outline=(40, 45, 66), width=2, fill=(12, 14, 28))
    accent = Image.new("RGB", (card_w, 10), purple)
    img.paste(accent, (card_x, card_y))

    sub_font = _load_font(26, bold=True)
    body_font = _load_font(24, bold=False)
    d.text((card_x + 28, card_y + 34), "Key findings", fill=text_dim, font=sub_font)

    findings = [f.strip() for f in (payload.key_findings or []) if isinstance(f, str) and f.strip()]
    if not findings:
        findings = ["No critical flags surfaced", "Always DYOR"]
    findings = findings[:4]

    y = card_y + 86
    for f in findings:
        d.text((card_x + 28, y), f"• {f}", fill=text_muted, font=body_font)
        y += 42

    # footer
    footer_font = _load_font(26, bold=False)
    d.text((60, H - 70), "verdictswarm.io", fill=(235, 238, 246), font=footer_font)
    d.text((W - 420, H - 70), "Scan. Share. Protect your bag.", fill=text_muted, font=footer_font)

    # export
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)

    return Response(content=buf.getvalue(), media_type="image/png")
