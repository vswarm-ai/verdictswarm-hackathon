import json
import os
import time
import unittest
from unittest.mock import patch
from urllib.error import URLError

from projects.verdictswarm.src.data_fetcher import DataFetcher


class _FakeResp:
    def __init__(self, payload: dict):
        self._raw = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._raw

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class TestDataFetcher(unittest.TestCase):
    def test_fetch_success_combines_sources(self):
        addr = "0xabc"
        now = int(time.time())
        cutoff = now - 24 * 60 * 60

        # DexScreener
        dex_payload = {
            "pairs": [
                {
                    "baseToken": {"name": "Virtual", "symbol": "VIRTUAL"},
                    "priceUsd": "1.23",
                    "priceChange": {"h24": "4.5"},
                    "volume": {"h24": "98765"},
                    "liquidity": {"usd": "123456"},
                    "marketCap": "111",
                    "fdv": "222",
                }
            ]
        }

        # Basescan source
        basescan_source = {
            "status": "1",
            "message": "OK",
            "result": [
                {
                    "SourceCode": "contract X {}",
                    "ABI": "[]",
                    "ContractCreator": "0xcreator",
                }
            ],
        }

        # Basescan txlist (desc)
        basescan_tx = {
            "status": "1",
            "message": "OK",
            "result": [
                {"timeStamp": str(now)},
                {"timeStamp": str(cutoff + 10)},
                {"timeStamp": str(cutoff - 10)},
            ],
        }

        # Basescan holders (top 10 share)
        holders = {
            "status": "1",
            "message": "OK",
            "result": [
                {"TokenHolderShare": "10.0"},
                {"TokenHolderShare": "5.0"},
            ],
        }

        def fake_urlopen(req, timeout=0):
            url = req.full_url
            if "dexscreener.com" in url:
                return _FakeResp(dex_payload)
            if "module=contract" in url and "action=getsourcecode" in url:
                return _FakeResp(basescan_source)
            if "module=account" in url and "action=txlist" in url:
                return _FakeResp(basescan_tx)
            if "module=token" in url and "action=tokenholderlist" in url:
                return _FakeResp(holders)
            raise AssertionError(f"Unexpected URL: {url}")

        with patch("projects.verdictswarm.src.data_fetcher.urlopen", side_effect=fake_urlopen):
            # Make sure tests don't require a real key.
            with patch.dict(os.environ, {"BASESCAN_API_KEY": ""}):
                df = DataFetcher(timeout_s=0.1)
                td = df.fetch(addr)

        self.assertEqual(td.contract_address, addr)
        self.assertEqual(td.name, "Virtual")
        self.assertEqual(td.symbol, "VIRTUAL")
        self.assertTrue(td.contract_verified)
        self.assertEqual(td.creator_address, "0xcreator")
        self.assertEqual(td.tx_count_24h, 2)
        self.assertEqual(td.holder_count, 2)
        self.assertAlmostEqual(td.top10_holders_pct, 15.0)
        self.assertAlmostEqual(td.price_usd, 1.23)
        self.assertAlmostEqual(td.price_change_24h, 4.5)
        self.assertAlmostEqual(td.volume_24h, 98765.0)
        self.assertAlmostEqual(td.liquidity_usd, 123456.0)
        self.assertEqual(set(td.data_sources), {"dexscreener", "basescan"})

    def test_fetch_degrades_if_dexscreener_fails(self):
        addr = "0xabc"

        basescan_source = {
            "status": "1",
            "message": "OK",
            "result": [{"SourceCode": "contract X {}", "ABI": "[]", "ContractCreator": "0xcreator"}],
        }

        def fake_urlopen(req, timeout=0):
            url = req.full_url
            if "dexscreener.com" in url:
                raise URLError("dex down")
            if "module=contract" in url and "action=getsourcecode" in url:
                return _FakeResp(basescan_source)
            # other basescan calls can fail/empty
            return _FakeResp({"status": "0", "message": "NOTOK", "result": []})

        with patch("projects.verdictswarm.src.data_fetcher.urlopen", side_effect=fake_urlopen):
            with patch.dict(os.environ, {"BASESCAN_API_KEY": ""}):
                df = DataFetcher(timeout_s=0.1)
                td = df.fetch(addr)

        self.assertEqual(td.contract_address, addr)
        self.assertTrue(td.contract_verified)
        self.assertEqual(td.creator_address, "0xcreator")
        self.assertIn("basescan", td.data_sources)
        self.assertNotIn("dexscreener", td.data_sources)


if __name__ == "__main__":
    unittest.main()
