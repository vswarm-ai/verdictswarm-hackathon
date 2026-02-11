import unittest

from projects.verdictswarm.src.scoring_engine import AgentVerdict, ScoringEngine


class TestScoringEngine(unittest.TestCase):
    def test_example_usage_matches_expected(self):
        engine = ScoringEngine()
        verdicts = {
            "TechnicianBot": AgentVerdict(
                score=7.8,
                sentiment="bullish",
                reasoning="Uptrend intact",
            ),
            "TokenomicsBot": AgentVerdict(score=6.4, sentiment="neutral", reasoning="Emissions"),
            "SecurityBot": AgentVerdict(score=8.6, sentiment="bullish", reasoning="Audits"),
            "SocialBot": AgentVerdict(score=5.9, sentiment="neutral", reasoning="Engagement"),
            "MacroBot": AgentVerdict(score=4.8, sentiment="neutral", reasoning="Liquidity"),
            "DevilsAdvocate": AgentVerdict(score=3.2, sentiment="bearish", reasoning="Narrative"),
        }

        result = engine.score(verdicts, title="$EXAMPLE")
        self.assertAlmostEqual(result.final_score, 6.98, places=2)
        self.assertEqual(result.final_sentiment, "bullish")
        self.assertAlmostEqual(result.confidence, 0.44, places=2)

    def test_missing_agent_renormalize(self):
        engine = ScoringEngine(missing_category_policy="renormalize")
        verdicts = {
            "TechnicianBot": {"score": 7.8, "sentiment": "bullish", "reasoning": ""},
            "TokenomicsBot": {"score": 6.4, "sentiment": "neutral", "reasoning": ""},
            "SecurityBot": {"score": 8.6, "sentiment": "bullish", "reasoning": ""},
            "SocialBot": {"score": 5.9, "sentiment": "neutral", "reasoning": ""},
            # MacroBot intentionally missing
        }
        result = engine.score(verdicts)
        self.assertAlmostEqual(result.final_score, 7.37, places=2)
        self.assertEqual(result.final_sentiment, "bullish")
        self.assertNotIn("Macro", result.used_weights)

    def test_missing_agent_neutral_policy_does_not_crash(self):
        engine = ScoringEngine(missing_category_policy="neutral")
        verdicts = {
            "TechnicianBot": {"score": 7.8, "sentiment": "bullish", "reasoning": ""},
            "TokenomicsBot": {"score": 6.4, "sentiment": "neutral", "reasoning": ""},
            "SecurityBot": {"score": 8.6, "sentiment": "bullish", "reasoning": ""},
            "SocialBot": {"score": 5.9, "sentiment": "neutral", "reasoning": ""},
            # MacroBot intentionally missing
        }
        result = engine.score(verdicts)
        self.assertAlmostEqual(result.final_score, 7.01, places=2)
        self.assertIn("Macro", result.category_scores)
        self.assertAlmostEqual(result.category_scores["Macro"], 5.0, places=2)

    def test_all_agents_bearish(self):
        engine = ScoringEngine()
        verdicts = {
            "TechnicianBot": {"score": 2.0, "sentiment": "bearish", "reasoning": ""},
            "TokenomicsBot": {"score": 2.0, "sentiment": "bearish", "reasoning": ""},
            "SecurityBot": {"score": 2.0, "sentiment": "bearish", "reasoning": ""},
            "SocialBot": {"score": 2.0, "sentiment": "bearish", "reasoning": ""},
            "MacroBot": {"score": 2.0, "sentiment": "bearish", "reasoning": ""},
        }
        result = engine.score(verdicts)
        self.assertEqual(result.final_sentiment, "bearish")
        self.assertAlmostEqual(result.final_score, 2.0, places=2)
        self.assertAlmostEqual(result.confidence, 1.0, places=2)

    def test_score_clamping_extremes(self):
        engine = ScoringEngine(category_weights={"Technical": 1.0}, agent_category_map={"A": "Technical"})

        r0 = engine.score({"A": {"score": -1, "sentiment": "bearish", "reasoning": ""}})
        self.assertAlmostEqual(r0.final_score, 0.0, places=2)
        self.assertEqual(r0.final_sentiment, "bearish")

        r10 = engine.score({"A": {"score": 11, "sentiment": "bullish", "reasoning": ""}})
        self.assertAlmostEqual(r10.final_score, 10.0, places=2)
        self.assertEqual(r10.final_sentiment, "bullish")

    def test_verdict_breakdown_by_category(self):
        engine = ScoringEngine()
        verdicts = {
            "TechnicianBot": {"score": 7.0, "sentiment": "bullish", "reasoning": ""},
            "SecurityBot": {"score": 8.0, "sentiment": "bullish", "reasoning": ""},
        }
        breakdown = engine.verdict_breakdown_by_category(verdicts)
        self.assertEqual(len(breakdown["Technical"]), 1)
        self.assertEqual(breakdown["Technical"][0][0], "TechnicianBot")
        self.assertEqual(len(breakdown["Safety"]), 1)

    def test_dissenting_agents(self):
        engine = ScoringEngine(agent_category_map={"A": "Technical", "B": "Safety", "C": "Tokenomics"})
        verdicts = {
            "A": {"score": 8.0, "sentiment": "bullish", "reasoning": ""},
            "B": {"score": 2.0, "sentiment": "bearish", "reasoning": ""},
            "C": {"score": 8.0, "sentiment": "bullish", "reasoning": ""},
        }
        dissenters = engine.dissenting_agents(verdicts)
        self.assertEqual(dissenters, ["B"])

        # Tie => no clear majority.
        verdicts_tie = {
            "A": {"score": 8.0, "sentiment": "bullish", "reasoning": ""},
            "B": {"score": 2.0, "sentiment": "bearish", "reasoning": ""},
        }
        self.assertEqual(engine.dissenting_agents(verdicts_tie), [])


if __name__ == "__main__":
    unittest.main()
