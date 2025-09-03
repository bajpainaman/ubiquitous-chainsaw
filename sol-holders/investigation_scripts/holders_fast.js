// holders_fast.js
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "node:fs";

/*
Usage:
  RPC=https://your.rpc node holders_fast.js <MINT> [OUT.csv]
Example:
  RPC=https://api.mainnet-beta.solana.com node holders_fast.js XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB holders.csv
*/

const MINT = process.argv[2];
const OUT = process.argv[3] || "holders.csv";
const RPC = process.env.RPC || "https://api.mainnet-beta.solana.com";

if (!MINT) {
  console.error("Usage: RPC=<rpc> node holders_fast.js <MINT> [OUT.csv]");
  process.exit(1);
}

(async () => {
  const conn = new Connection(RPC, { commitment: "confirmed" });
  const mintPk = new PublicKey(MINT);

  // Mint account (to get program + decimals)
  const mintAcc = await conn.getAccountInfo(mintPk);
  if (!mintAcc) throw new Error("Mint not found");
  const tokenProgramId = mintAcc.owner;
  const decimals = mintAcc.data[44]; // SPL Mint: decimals at byte offset 44

  // Pull all token-accounts for this mint, but only the first 73 bytes:
  //   [0..31]=mint, [32..63]=owner, [64..71]=amount (u64 LE)
  console.error("Fetching token accounts...");
  let gpa;
  try {
    gpa = await conn.getProgramAccounts(tokenProgramId, {
      filters: [{ memcmp: { offset: 0, bytes: mintPk.toBase58() } }],
      dataSlice: { offset: 0, length: 73 },
    });
  } catch (error) {
    if (error.message.includes("410") || error.message.includes("disabled")) {
      console.error("❌ getProgramAccounts is disabled on this RPC endpoint");
      console.error("💡 Use a premium RPC like:");
      console.error("   - Helius: https://rpc.helius.xyz?api-key=YOUR_KEY");
      console.error("   - QuickNode: https://your-endpoint.quiknode.pro/YOUR_KEY");
      console.error("   - Alchemy: https://solana-mainnet.alchemyapi.io/v2/YOUR_KEY");
      process.exit(1);
    }
    throw error;
  }

  const byOwner = new Map(); // owner -> BigInt(raw amount)
  for (const { account } of gpa) {
    const buf = account.data; // Buffer
    const owner = new PublicKey(buf.subarray(32, 64)).toBase58();
    const raw = buf.readBigUInt64LE(64);
    if (raw === 0n) continue;
    byOwner.set(owner, (byOwner.get(owner) || 0n) + raw);
  }

  // Build CSV (sorted by raw balance desc)
  const factor = 10n ** BigInt(decimals);
  const lines = [];
  for (const [owner, raw] of byOwner.entries()) {
    const whole = raw / factor;
    const frac = raw % factor;
    const ui =
      decimals === 0
        ? whole.toString()
        : `${whole}.${frac.toString().padStart(decimals, "0")}`.replace(/\.?0+$/, "");
    lines.push({ owner, ui, rawStr: raw.toString() });
  }
  lines.sort((a, b) => (BigInt(b.rawStr) > BigInt(a.rawStr) ? 1 : -1));

  const out = ["owner,amount_ui,amount_raw", ...lines.map(r => `${r.owner},${r.ui},${r.rawStr}`)].join("\n");
  fs.writeFileSync(OUT, out, "utf8");

  console.error(
    `holders=${lines.length}, program=${tokenProgramId.toBase58()}, decimals=${decimals}, wrote=${OUT}`
  );
})();