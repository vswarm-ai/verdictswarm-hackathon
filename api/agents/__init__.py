"""API-layer agents for Tier 1 scans.

These are lightweight wrappers that use the shared src.agents.AIClient for
Gemini calls and return the Tier 1 JSON contract:

{
  "agent": "ContractReader",
  "analysis": "...",
  "flags": ["..."],
  "score": 7.5
}
"""
