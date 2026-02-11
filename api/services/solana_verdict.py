"""On-chain verdict storage via Solana.

Stores scan verdicts as Solana accounts using our Anchor program.
This is NON-FATAL — if it fails, the scan result still returns normally.

Network: Devnet for hackathon, mainnet-beta for production.
"""

import hashlib
import json
import os
import struct
import time
from typing import Optional

# Lazy imports — these are heavy and only needed when storing on-chain
_solana_available = None


def _check_solana_deps() -> bool:
    """Check if Solana dependencies are available."""
    global _solana_available
    if _solana_available is not None:
        return _solana_available
    try:
        import solders  # noqa: F401
        import solana  # noqa: F401
        _solana_available = True
    except ImportError:
        print("[WARN] Solana dependencies not installed (solders, solana). On-chain verdicts disabled.")
        _solana_available = False
    return _solana_available


async def store_verdict_onchain(scan_result: dict) -> Optional[dict]:
    """Store a verdict on-chain. Returns tx info dict or None on failure.

    Returns:
        {
            "txSignature": "5abc...",
            "network": "devnet",
            "explorerUrl": "https://explorer.solana.com/tx/5abc...?cluster=devnet"
        }
        or None if storage fails.
    """
    if not _check_solana_deps():
        return None

    try:
        from solders.keypair import Keypair
        from solders.pubkey import Pubkey
        from solders.system_program import ID as SYSTEM_PROGRAM_ID
        from solders.instruction import Instruction, AccountMeta
        from solders.transaction import Transaction
        from solders.message import Message
        from solders.hash import Hash
        from solana.rpc.async_api import AsyncClient
        from solana.rpc.commitment import Confirmed

        # Config
        network = os.getenv("SOLANA_NETWORK", "devnet")
        rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
        keypair_path = os.getenv("SOLANA_KEYPAIR_PATH", "")
        program_id_str = os.getenv("VERDICTSWARM_PROGRAM_ID", "")

        if not keypair_path or not program_id_str:
            print("[WARN] SOLANA_KEYPAIR_PATH or VERDICTSWARM_PROGRAM_ID not set. Skipping on-chain storage.")
            return None

        # Load keypair
        with open(keypair_path, "r") as f:
            keypair_bytes = json.load(f)
        authority = Keypair.from_bytes(bytes(keypair_bytes))

        program_id = Pubkey.from_string(program_id_str)

        # Extract scan data
        token_address = str(scan_result.get("address", ""))[:64]
        chain = str(scan_result.get("chain", ""))[:16]
        score = min(int(float(scan_result.get("score", 0)) * 10), 1000)  # 61.5 → 615
        grade = str(scan_result.get("grade", "N/A"))[:4]
        agent_count = min(int(scan_result.get("agentCount", 0) or len(scan_result.get("bots", {}))), 255)
        tier = str(scan_result.get("tier", "FREE"))[:16]

        # Hash the full scan result
        scan_json = json.dumps(scan_result, sort_keys=True, default=str)
        scan_hash = hashlib.sha256(scan_json.encode()).digest()

        # Derive PDA
        timestamp = int(time.time())
        timestamp_bytes = struct.pack("<q", timestamp)  # i64 little-endian

        seeds = [
            b"verdict",
            token_address.encode(),
            chain.encode(),
            timestamp_bytes,
        ]
        verdict_pda, bump = Pubkey.find_program_address(seeds, program_id)

        # Build instruction data (Anchor discriminator + args)
        # Anchor discriminator = first 8 bytes of SHA256("global:store_verdict")
        discriminator = hashlib.sha256(b"global:store_verdict").digest()[:8]

        # Serialize args manually (Borsh encoding)
        def encode_string(s: str) -> bytes:
            encoded = s.encode("utf-8")
            return struct.pack("<I", len(encoded)) + encoded

        ix_data = (
            discriminator
            + encode_string(token_address)
            + encode_string(chain)
            + struct.pack("<H", score)
            + encode_string(grade)
            + struct.pack("<B", agent_count)
            + encode_string(tier)
            + scan_hash  # [u8; 32] — raw bytes
        )

        # Build instruction
        accounts = [
            AccountMeta(pubkey=authority.pubkey(), is_signer=True, is_writable=True),
            AccountMeta(pubkey=verdict_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ]

        ix = Instruction(program_id=program_id, accounts=accounts, data=ix_data)

        # Send transaction
        async with AsyncClient(rpc_url) as client:
            recent_blockhash_resp = await client.get_latest_blockhash(commitment=Confirmed)
            recent_blockhash = recent_blockhash_resp.value.blockhash

            msg = Message.new_with_blockhash([ix], authority.pubkey(), recent_blockhash)
            tx = Transaction.new_unsigned(msg)
            tx.sign([authority], recent_blockhash)

            result = await client.send_transaction(tx)
            tx_sig = str(result.value)

            cluster_param = f"?cluster={network}" if network != "mainnet-beta" else ""
            explorer_url = f"https://explorer.solana.com/tx/{tx_sig}{cluster_param}"

            print(f"[INFO] Verdict stored on-chain: {explorer_url}")

            return {
                "txSignature": tx_sig,
                "network": network,
                "explorerUrl": explorer_url,
                "verdictPda": str(verdict_pda),
            }

    except Exception as e:
        print(f"[WARN] On-chain verdict storage failed: {e}")
        return None
