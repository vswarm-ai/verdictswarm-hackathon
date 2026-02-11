from __future__ import annotations

import io
import os
from datetime import datetime
from typing import Any, Optional, Union

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

# PDF generation (pure python)
from fpdf import FPDF

router = APIRouter(prefix="/api", tags=["pdf"])


class PdfRequest(BaseModel):
    address: str
    chain: str
    tierKey: str

    tokenName: Optional[str] = None
    tokenSymbol: Optional[str] = None

    overallScore: Union[float, int]
    verdictLabel: str

    vitals: Any = None
    risks: Any = None
    bots: Any = None


# --- Design system (brand-ish) ---
_BRAND_PURPLE = (104, 63, 255)  # #683FFF
_BRAND_CYAN = (0, 212, 255)  # #00D4FF
_INK = (18, 20, 28)
_MUTED = (110, 116, 132)
_PANEL = (246, 248, 252)
_BORDER = (226, 231, 242)


def _now_cst_string() -> str:
    # Keep it simple & deterministic without timezone deps.
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _repo_asset(*parts: str) -> str:
    # This file lives at api/routers/pdf.py
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.abspath(os.path.join(here, "..", ".."))
    return os.path.join(repo, *parts)


def _verdict_badge_style(label: str) -> tuple[tuple[int, int, int], tuple[int, int, int], str]:
    l = (label or "").lower()
    if "healthy" in l or "good" in l:
        return (20, 140, 60), (234, 251, 241), "HEALTHY"
    if "warning" in l or "caution" in l:
        return (200, 140, 0), (255, 248, 227), "WARNING"
    return (200, 40, 40), (255, 235, 235), "UNHEALTHY"


class _PDF(FPDF):
    def __init__(self, *, is_free: bool, report_title: str = "Token Scan Report"):
        super().__init__(format="letter", unit="pt")
        self.is_free = is_free
        self.report_title = report_title

        # Document margins / layout rhythm
        self.set_auto_page_break(auto=True, margin=48)
        self.set_margins(48, 56, 48)

    # --- drawing helpers ---
    def _hline(self, y: float, color: tuple[int, int, int] = _BORDER):
        self.set_draw_color(*color)
        self.line(self.l_margin, y, self.w - self.r_margin, y)

    def _round_rect(self, x: float, y: float, w: float, h: float, r: float = 10, style: str = "D"):
        # fpdf2 has rounded_rect
        if hasattr(self, "rounded_rect"):
            getattr(self, "rounded_rect")(x, y, w, h, r, style=style)
        else:
            self.rect(x, y, w, h, style=style)

    def _bg(self):
        # Subtle top gradient band + micro pattern dots (light)
        self.set_fill_color(252, 253, 255)
        self.rect(0, 0, self.w, self.h, style="F")

        band_h = 120
        # Fake gradient via thin rectangles
        for i in range(18):
            t = i / 17
            r = int(_BRAND_PURPLE[0] * (1 - t) + 255 * t)
            g = int(_BRAND_PURPLE[1] * (1 - t) + 255 * t)
            b = int(_BRAND_PURPLE[2] * (1 - t) + 255 * t)
            # No alpha support in this fpdf build; approximate with very light colors.
            self.set_fill_color(r, g, b)
            self.rect(0, i * (band_h / 18), self.w, (band_h / 18) + 1, style="F")

        # Dots pattern on right side
        self.set_draw_color(235, 238, 247)
        for y in range(26, 120, 14):
            for x in range(int(self.w - 210), int(self.w - 24), 14):
                self.ellipse(x, y, 2, 2, style="F")

    def _watermark(self):
        if not self.is_free:
            return
        # No transparency available; use very light ink.
        self.set_text_color(232, 234, 244)
        self.set_font("Helvetica", "B", 62)
        self.rotate(28, x=self.w / 2, y=self.h / 2)
        self.text(self.w * 0.16, self.h * 0.55, "FREE TIER")
        self.rotate(0)
        self.set_text_color(*_INK)

    # --- header/footer ---
    def header(self):
        self._bg()
        self._watermark()

        x0 = self.l_margin
        y0 = 36

        # Logo
        logo_path = _repo_asset("landing", "assets", "logo.png")
        if os.path.exists(logo_path):
            # 28pt square logo
            self.image(logo_path, x=x0, y=y0, w=28, h=28)
            brand_x = x0 + 36
        else:
            brand_x = x0

        # Brand name
        self.set_xy(brand_x, y0 + 2)
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(*_INK)
        self.cell(0, 18, "VerdictSwarm", new_x="LMARGIN", new_y="NEXT")

        # Subtitle + divider
        self.set_x(brand_x)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*_MUTED)
        self.cell(0, 14, self.report_title, new_x="LMARGIN", new_y="NEXT")

        self.ln(6)
        self._hline(self.get_y())
        self.ln(16)

    def footer(self):
        self.set_y(-42)
        self._hline(self.get_y())
        self.ln(10)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*_MUTED)

        ts = _now_cst_string()
        left = f"Generated {ts}"
        right = "verdictswarm.io"

        self.set_x(self.l_margin)
        self.cell(0, 10, left)
        self.set_y(self.get_y() - 10)
        self.set_x(self.l_margin)
        self.cell(0, 10, right, align="R")

        self.set_y(-26)
        self.set_text_color(170, 175, 190)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def _safe_str(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, (str, int, float, bool)):
        return str(x)
    return str(x)


def _draw_section_title(pdf: FPDF, icon: str, title: str):
    # NOTE: Core PDF fonts (Helvetica) are not Unicode; avoid emoji here.
    icon_ascii = icon
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*_INK)
    pdf.cell(0, 16, f"{icon_ascii}  {title}", new_x="LMARGIN", new_y="NEXT")


def _draw_kv_row(pdf: FPDF, key: str, value: str):
    # 2-column key/value row with subtle divider
    x0 = pdf.l_margin
    w = pdf.w - pdf.l_margin - pdf.r_margin

    pdf.set_draw_color(*_BORDER)
    y = pdf.get_y()
    pdf.line(x0, y + 16, x0 + w, y + 16)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*_MUTED)
    pdf.set_xy(x0, y + 2)
    pdf.cell(w * 0.34, 12, key[:40])

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*_INK)
    pdf.set_xy(x0 + w * 0.34, y + 2)
    pdf.multi_cell(w * 0.66, 12, value)


def _draw_badge(pdf: FPDF, label: str, score: Union[int, float]):
    fg, bg, canonical = _verdict_badge_style(label)

    x0 = pdf.l_margin
    w = pdf.w - pdf.l_margin - pdf.r_margin

    y0 = pdf.get_y()
    h = 56

    # Card background
    pdf.set_fill_color(*_PANEL)
    pdf.set_draw_color(*_BORDER)
    if isinstance(pdf, _PDF):
        pdf._round_rect(x0, y0, w, h, r=12, style="DF")
    else:
        pdf.rect(x0, y0, w, h, style="DF")

    # Left accent bar
    pdf.set_fill_color(*fg)
    pdf.rect(x0, y0, 6, h, style="F")

    # Badge pill
    pill_w = 118
    pill_h = 18
    pill_x = x0 + 18
    pill_y = y0 + 12

    pdf.set_fill_color(*bg)
    pdf.set_draw_color(*fg)
    if isinstance(pdf, _PDF):
        pdf._round_rect(pill_x, pill_y, pill_w, pill_h, r=7, style="DF")
    else:
        pdf.rect(pill_x, pill_y, pill_w, pill_h, style="DF")

    pdf.set_xy(pill_x, pill_y + 2)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*fg)
    pdf.cell(pill_w, 12, canonical, align="C")

    # Big verdict line
    pdf.set_xy(x0 + 18, y0 + 32)
    pdf.set_font("Helvetica", "B", 15)
    pdf.set_text_color(*_INK)
    pdf.cell(0, 16, f"{label}")

    # Score on right
    pdf.set_xy(x0, y0 + 16)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*_INK)
    pdf.cell(w - 14, 20, f"{score}", align="R")

    pdf.set_xy(x0, y0 + h + 14)


def _add_qr_placeholder(pdf: FPDF, x: float, y: float, size: float, url: str = "verdictswarm.io"):
    # Dependency-free placeholder: stylized box + URL
    pdf.set_draw_color(*_BORDER)
    pdf.set_fill_color(255, 255, 255)
    if isinstance(pdf, _PDF):
        pdf._round_rect(x, y, size, size, r=10, style="DF")
    else:
        pdf.rect(x, y, size, size, style="DF")

    pdf.set_xy(x, y + size / 2 - 8)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*_BRAND_PURPLE)
    pdf.cell(size, 12, "QR", align="C")

    pdf.set_xy(x, y + size + 4)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*_MUTED)
    pdf.cell(size, 10, url, align="C")


def _render_pdf(payload: PdfRequest) -> bytes:
    tier = (payload.tierKey or "").lower()
    is_free = tier in {"free", "trial"}

    pdf = _PDF(is_free=is_free)
    pdf.add_page()

    # --- Token identity ---
    token = "".join(
        [
            _safe_str(payload.tokenName).strip(),
            f" ({_safe_str(payload.tokenSymbol).strip()})" if payload.tokenSymbol else "",
        ]
    ).strip() or "(unknown token)"

    pdf.set_font("Helvetica", "B", 15)
    pdf.set_text_color(*_INK)
    pdf.multi_cell(0, 18, token)

    # mini vitals line
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*_MUTED)
    pdf.cell(0, 12, f"Chain: {_safe_str(payload.chain)}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*_MUTED)
    pdf.multi_cell(0, 12, f"Address: {_safe_str(payload.address)}")
    pdf.ln(10)

    # --- Verdict badge/card ---
    _draw_badge(pdf, payload.verdictLabel, payload.overallScore)

    # --- Sections ---
    # Vitals
    _draw_section_title(pdf, "Vitals", "Vitals")
    vitals_obj: Any = payload.vitals
    if isinstance(vitals_obj, dict) and vitals_obj:
        for k, v in list(vitals_obj.items())[:10]:
            _draw_kv_row(pdf, _safe_str(k), _safe_str(v))
    else:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_MUTED)
        pdf.multi_cell(0, 14, "No vitals provided.")
    pdf.ln(12)

    # Security Analysis
    _draw_section_title(pdf, "Security", "Security Analysis")
    if is_free:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_MUTED)
        pdf.multi_cell(0, 14, "Basic verdict shown. Full Security Analysis is available on paid tiers.")
    else:
        # If you later have a dedicated field, plug it in here.
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_MUTED)
        pdf.multi_cell(0, 14, "No security analysis payload provided.")
    pdf.ln(10)

    # Social Check
    _draw_section_title(pdf, "Social", "Social Check")
    if is_free:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_MUTED)
        pdf.multi_cell(0, 14, "Social reputation checks are locked on the FREE tier.")
    else:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_MUTED)
        pdf.multi_cell(0, 14, "No social check payload provided.")
    pdf.ln(10)

    # Risks
    _draw_section_title(pdf, "Risks", "Risks")
    if is_free:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_MUTED)
        pdf.multi_cell(0, 14, "Risk details are locked on the FREE tier.")
        pdf.ln(10)

        # Upgrade CTA panel
        x0 = pdf.l_margin
        w = pdf.w - pdf.l_margin - pdf.r_margin
        y0 = pdf.get_y()
        h = 78

        pdf.set_draw_color(*_BRAND_PURPLE)
        pdf.set_fill_color(252, 250, 255)
        pdf._round_rect(x0, y0, w, h, r=14, style="DF")

        pad = 14
        qr_size = 46
        qr_x = x0 + w - pad - qr_size
        qr_y = y0 + (h - qr_size) / 2

        text_w = w - (pad * 3) - qr_size
        pdf.set_xy(x0 + pad, y0 + 14)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(*_BRAND_PURPLE)
        pdf.cell(text_w, 14, "Unlock the full report")

        pdf.set_xy(x0 + pad, y0 + 34)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_INK)
        pdf.multi_cell(text_w, 13, "Unlock full Security Analysis, Whale Tracking, and more at verdictswarm.io")

        _add_qr_placeholder(pdf, x=qr_x, y=qr_y, size=qr_size, url="verdictswarm.io")
        pdf.set_y(y0 + h + 14)
    else:
        risks_obj: Any = payload.risks
        if isinstance(risks_obj, dict) and risks_obj:
            for k, v in list(risks_obj.items())[:14]:
                _draw_kv_row(pdf, _safe_str(k), _safe_str(v))
        elif isinstance(risks_obj, list) and risks_obj:
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*_INK)
            for v in risks_obj[:18]:
                pdf.multi_cell(0, 14, f"• {_safe_str(v)}")
        else:
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*_MUTED)
            pdf.multi_cell(0, 14, "No risks provided.")

    # Extra: bot/whale analysis for paid
    pdf.ln(12)
    _draw_section_title(pdf, "Bots", "Automation / Bots")
    bots_obj: Any = payload.bots
    if is_free:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*_MUTED)
        pdf.multi_cell(0, 14, "Bot and wallet analysis are locked on the FREE tier.")
    else:
        if isinstance(bots_obj, dict) and bots_obj:
            for k, v in list(bots_obj.items())[:14]:
                _draw_kv_row(pdf, _safe_str(k), _safe_str(v))
        elif isinstance(bots_obj, list) and bots_obj:
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*_INK)
            for v in bots_obj[:24]:
                pdf.multi_cell(0, 14, f"• {_safe_str(v)}")
        else:
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*_MUTED)
            pdf.multi_cell(0, 14, "No bot analysis provided.")

    out = pdf.output(dest="S")
    if isinstance(out, (bytes, bytearray)):
        return bytes(out)
    return out.encode("latin-1")


@router.post("/pdf")
async def generate_pdf(req: PdfRequest):
    pdf_bytes = _render_pdf(req)
    headers = {
        "Content-Disposition": 'inline; filename="verdictswarm-report.pdf"'
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
