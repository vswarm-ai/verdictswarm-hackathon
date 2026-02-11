import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("5bd26batPQg9ZXWSrXp3G6V2kP9wNpEz2TPZkiytV4Tq");

interface VerdictData {
  address: string;
  chain: string;
  score: number;
  grade: string;
  agentCount: number;
  tier: string;
  fullReport?: Record<string, unknown>;
}

function tierToU8(tier: string): number {
  const map: Record<string, number> = {
    FREE: 0,
    TIER_1: 1,
    TIER_2: 2,
    TIER_3: 3,
    SWARM_DEBATE: 4,
  };
  return map[tier] ?? 0;
}

async function buildScanHash(v: VerdictData): Promise<Buffer> {
  // Hash the full report if available — this makes the on-chain record
  // a verifiable proof of the complete scan results
  const reportData = v.fullReport
    ? JSON.stringify({
        address: v.address,
        chain: v.chain,
        score: v.score,
        grade: v.grade,
        agentCount: v.agentCount,
        tier: v.tier,
        breakdown: v.fullReport.breakdown,
        summary: v.fullReport.summary,
        timestamp: Date.now(),
      })
    : `${v.address}:${v.chain}:${v.score}:${Date.now()}`;
  const encoded = new TextEncoder().encode(reportData);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", encoded as unknown as BufferSource);
  return Buffer.from(new Uint8Array(hashBuffer));
}

export async function storeVerdictOnchain(
  connection: Connection,
  payerPublicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  verdict: VerdictData
): Promise<{ txSignature: string; explorerUrl: string; verdictPda: string } | null> {
  try {
    const scanHash = await buildScanHash(verdict);

    const [verdictPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("v"), scanHash],
      PROGRAM_ID
    );

    const instrData = Buffer.alloc(40);
    scanHash.copy(instrData, 0);
    instrData.writeUInt16LE(Math.round(verdict.score * 10), 32);
    const gradeBytes = Buffer.alloc(4);
    Buffer.from(verdict.grade.slice(0, 4)).copy(gradeBytes);
    gradeBytes.copy(instrData, 34);
    instrData.writeUInt8(verdict.agentCount, 38);
    instrData.writeUInt8(tierToU8(verdict.tier), 39);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: verdictPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instrData,
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = payerPublicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const signed = await signTransaction(tx);
    const txSignature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    // Don't block on confirmation — tx is already sent
    connection.confirmTransaction(txSignature, "confirmed").catch(() => {});

    const result = {
      txSignature,
      explorerUrl: `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
      verdictPda: verdictPda.toBase58(),
    };
    console.log("[VerdictSwarm] On-chain verdict stored!", result);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to store verdict on-chain:", msg, err);
    // Surface error to user briefly
    if (typeof window !== "undefined") {
      console.warn(`[VerdictSwarm] On-chain storage failed: ${msg}`);
    }
    return null;
  }
}
