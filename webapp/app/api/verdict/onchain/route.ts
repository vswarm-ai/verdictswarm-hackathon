import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { createHash } from "crypto";
import bs58 from "bs58";

const PROGRAM_ID = new PublicKey(
  "7Q7kJ2cmK8HPbv2j2mJCby3sDoRxGWyWbCxN8xbvaVSR",
);
const SOLANA_RPC =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

function getSignerKeypair(): Keypair {
  const key = process.env.SOLANA_SIGNER_KEY;
  if (!key) throw new Error("SOLANA_SIGNER_KEY not set");
  // Support both base58 and JSON array formats
  try {
    return Keypair.fromSecretKey(bs58.decode(key));
  } catch {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key)));
  }
}

function encodeString(s: string): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(s.length);
  return Buffer.concat([len, Buffer.from(s, "utf-8")]);
}

export async function POST(req: Request) {
  try {
    const {
      tokenAddress,
      chain,
      score,
      grade,
      agentCount,
      tier,
      scanData,
    } = await req.json();

    if (!tokenAddress || !chain || score == null || !grade) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const connection = new Connection(SOLANA_RPC, "confirmed");
    const signer = getSignerKeypair();

    // Compute scan hash (SHA256 of scan results)
    const scanJson = JSON.stringify(scanData || {}, null, 0);
    const scanHash = createHash("sha256").update(scanJson).digest();

    // Derive PDA — use current unix timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigInt64LE(BigInt(timestamp));

    const [verdictPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("verdict"),
        Buffer.from(tokenAddress.slice(0, 64)),
        Buffer.from(chain.slice(0, 16)),
        timestampBytes,
      ],
      PROGRAM_ID,
    );

    // Build instruction data
    // Anchor discriminator for "store_verdict"
    const discriminator = createHash("sha256")
      .update("global:store_verdict")
      .digest()
      .slice(0, 8);

    const scoreOnChain = Math.min(Math.round(score) * 10, 1000);
    const scoreBuf = Buffer.alloc(2);
    scoreBuf.writeUInt16LE(scoreOnChain);

    const data = Buffer.concat([
      discriminator,
      encodeString(tokenAddress.slice(0, 64)),
      encodeString(chain.slice(0, 16)),
      scoreBuf,
      encodeString(grade.slice(0, 4)),
      Buffer.from([Math.min(agentCount || 0, 255)]),
      encodeString((tier || "FREE").slice(0, 16)),
      scanHash,
    ]);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: signer.publicKey, isSigner: true, isWritable: true },
        { pubkey: verdictPda, isSigner: false, isWritable: true },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: PROGRAM_ID,
      data,
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = signer.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(signer);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });
    await connection.confirmTransaction(signature, "confirmed");

    return NextResponse.json({
      txSignature: signature,
      network: "devnet",
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      verdictPda: verdictPda.toBase58(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[verdict:onchain] Failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
