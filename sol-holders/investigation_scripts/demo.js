// demo.js - Demo with simulated data
import fs from "node:fs";

console.log("🚀 Solana Token Holders Tracker - Demo Mode");
console.log("Note: Public RPC endpoints often block getProgramAccounts");
console.log("For production use, get a premium RPC from Helius/QuickNode/Alchemy");

// Simulated token holder data for demo
const mockHolders = [
  { owner: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", rawAmount: 1000000000000n, decimals: 9 },
  { owner: "GDvnbJqBfxQjD6YpUjCbZcJeHvFvW4BTvL7dKCqLn3dV", rawAmount: 500000000000n, decimals: 9 },
  { owner: "EhYXDTeyVQ3PGRYYhSEfGrGvfhfkxLh1R6zMnN3YKJzV", rawAmount: 250000000000n, decimals: 9 },
  { owner: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", rawAmount: 100000000000n, decimals: 9 },
  { owner: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", rawAmount: 75000000000n, decimals: 9 },
  { owner: "BgvY9xr4yevL6hzKqNVSDQxHsfrGXJcfh1hM6K2mGhZ1", rawAmount: 50000000000n, decimals: 9 },
  { owner: "AxN2RFtZzVgQrHt3grGhWfqXxjjGsL4p4Jk2nYPKsE7V", rawAmount: 25000000000n, decimals: 9 },
  { owner: "CTMdrvU8j6qN1VKJMzLDx4kK6xPRBJkGhKNjLdA2aXS3", rawAmount: 10000000000n, decimals: 9 },
];

// Process the data
const decimals = 9;
const factor = 10n ** BigInt(decimals);
const lines = [];

for (const { owner, rawAmount } of mockHolders) {
  const whole = rawAmount / factor;
  const frac = rawAmount % factor;
  const ui = `${whole}.${frac.toString().padStart(decimals, "0")}`.replace(/\.?0+$/, "");
  lines.push({ owner, ui, rawStr: rawAmount.toString() });
}

// Sort by balance (desc)
lines.sort((a, b) => (BigInt(b.rawStr) > BigInt(a.rawStr) ? 1 : -1));

// Generate CSV
const csv = ["owner,amount_ui,amount_raw", ...lines.map(r => `${r.owner},${r.ui},${r.rawStr}`)].join("\n");
fs.writeFileSync("demo_holders.csv", csv, "utf8");

console.log(`✅ Created demo_holders.csv with ${lines.length} holders`);
console.log("📊 Top 3 holders:");
lines.slice(0, 3).forEach((holder, i) => {
  console.log(`  ${i + 1}. ${holder.owner} - ${holder.ui} tokens`);
});

console.log("\n💡 To use with real data:");
console.log("  RPC=https://your-premium-rpc.com node holders_fast.js <MINT_ADDRESS> output.csv");