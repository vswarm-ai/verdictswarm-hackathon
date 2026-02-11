"""VerdictSwarm specialist agents.

Each agent analyzes a token from a different perspective and returns an
:class:`~scoring_engine.AgentVerdict`.

The implementations in this package are scaffolding (mock logic) intended to be
replaced with real API/data integrations.
"""

from .base_agent import BaseAgent, AgentEventEmitter, NullEmitter, CallbackEmitter
from .technician_bot import TechnicianBot
from .tokenomics_bot import TokenomicsBot
from .security_bot import SecurityBot
from .social_bot import SocialBot
from .macro_bot import MacroBot
from .devils_advocate import DevilsAdvocate

__all__ = [
    "BaseAgent",
    "AgentEventEmitter",
    "NullEmitter",
    "CallbackEmitter",
    "TechnicianBot",
    "TokenomicsBot",
    "SecurityBot",
    "SocialBot",
    "MacroBot",
    "DevilsAdvocate",
]
