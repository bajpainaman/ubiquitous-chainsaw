import fs from "node:fs";

const csvFile = process.argv[2] || "xsol_holders.csv";
const data = fs.readFileSync(csvFile, "utf8");
const lines = data.split("\n").slice(1).filter(l => l.trim());

console.log("📊 XSOL Token Distribution Analysis");
console.log("=" .repeat(50));

// Parse data
const holders = lines.map(line => {
  const [owner, amountUI, amountRaw] = line.split(",");
  return {
    owner,
    amount: parseFloat(amountUI),
    raw: BigInt(amountRaw)
  };
});

console.log(`Total holders: ${holders.length.toLocaleString()}`);

// Basic stats
const amounts = holders.map(h => h.amount).sort((a, b) => b - a);
const total = amounts.reduce((sum, amt) => sum + amt, 0);
const mean = total / amounts.length;
const median = amounts[Math.floor(amounts.length / 2)];

console.log(`Total supply held: ${total.toLocaleString()} XSOL`);
console.log(`Mean balance: ${mean.toFixed(8)} XSOL`);
console.log(`Median balance: ${median.toFixed(8)} XSOL`);

// Distribution analysis
console.log("\n🔍 DISTRIBUTION ANALYSIS");
console.log("-".repeat(30));

// Whale analysis
const whales = holders.filter(h => h.amount >= 1000);
const whaleSupply = whales.reduce((sum, h) => sum + h.amount, 0);
console.log(`🐋 Whales (≥1000): ${whales.length} (${(whales.length/holders.length*100).toFixed(2)}%)`);
console.log(`   Supply: ${whaleSupply.toFixed(2)} (${(whaleSupply/total*100).toFixed(2)}%)`);

// Power law distribution check (Pareto principle)
const top1pct = Math.ceil(holders.length * 0.01);
const top5pct = Math.ceil(holders.length * 0.05);
const top10pct = Math.ceil(holders.length * 0.10);

const top1Supply = holders.slice(0, top1pct).reduce((sum, h) => sum + h.amount, 0);
const top5Supply = holders.slice(0, top5pct).reduce((sum, h) => sum + h.amount, 0);
const top10Supply = holders.slice(0, top10pct).reduce((sum, h) => sum + h.amount, 0);

console.log(`📈 Top 1% (${top1pct}): ${(top1Supply/total*100).toFixed(2)}% of supply`);
console.log(`📈 Top 5% (${top5pct}): ${(top5Supply/total*100).toFixed(2)}% of supply`);
console.log(`📈 Top 10% (${top10pct}): ${(top10Supply/total*100).toFixed(2)}% of supply`);

// Gini coefficient (wealth inequality)
let gini = 0;
for (let i = 0; i < amounts.length; i++) {
  for (let j = 0; j < amounts.length; j++) {
    gini += Math.abs(amounts[i] - amounts[j]);
  }
}
gini = gini / (2 * amounts.length * amounts.length * mean);
console.log(`📊 Gini coefficient: ${gini.toFixed(4)} (0=equal, 1=one holder has all)`);

// Distribution tiers
const tiers = [
  { name: "Dust (≤0.01)", min: 0, max: 0.01 },
  { name: "Micro (0.01-1)", min: 0.01, max: 1 },
  { name: "Small (1-10)", min: 1, max: 10 },
  { name: "Medium (10-100)", min: 10, max: 100 },
  { name: "Large (100-1000)", min: 100, max: 1000 },
  { name: "Whale (≥1000)", min: 1000, max: Infinity }
];

console.log("\n🎯 HOLDER TIERS");
console.log("-".repeat(30));
tiers.forEach(tier => {
  const tierHolders = holders.filter(h => h.amount > tier.min && h.amount <= tier.max);
  const tierSupply = tierHolders.reduce((sum, h) => sum + h.amount, 0);
  console.log(`${tier.name.padEnd(16)}: ${tierHolders.length.toString().padStart(5)} holders (${(tierHolders.length/holders.length*100).toFixed(1).padStart(4)}%) - ${tierSupply.toFixed(0).padStart(8)} supply (${(tierSupply/total*100).toFixed(1).padStart(4)}%)`);
});

// Potential issues detection
console.log("\n🚨 POTENTIAL ISSUES");
console.log("-".repeat(30));

// Check for zero balances (should be filtered out)
const zeros = holders.filter(h => h.amount === 0);
if (zeros.length > 0) {
  console.log(`❌ Found ${zeros.length} zero-balance holders (data collection issue)`);
}

// Check for duplicate addresses
const uniqueOwners = new Set(holders.map(h => h.owner));
if (uniqueOwners.size !== holders.length) {
  console.log(`❌ Duplicate addresses found: ${holders.length - uniqueOwners.size} duplicates`);
}

// Check for potential centralized exchange wallets (very high balances)
const suspiciousCEX = holders.filter(h => h.amount > 2000);
console.log(`🏦 Potential CEX wallets (>2000): ${suspiciousCEX.length}`);
suspiciousCEX.slice(0, 5).forEach((h, i) => {
  console.log(`   ${i+1}. ${h.owner}: ${h.amount.toFixed(2)} XSOL`);
});

// Check for round numbers (might indicate airdrops or manual distributions)
const roundAmounts = holders.filter(h => h.amount % 1 === 0 && h.amount >= 10);
console.log(`🎯 Round number holders (≥10, whole numbers): ${roundAmounts.length}`);

// Standard deviation analysis
const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) / amounts.length;
const stdDev = Math.sqrt(variance);
const coefficientOfVariation = stdDev / mean;

console.log(`📏 Standard deviation: ${stdDev.toFixed(8)}`);
console.log(`📏 Coefficient of variation: ${coefficientOfVariation.toFixed(4)} (${coefficientOfVariation > 1 ? 'high' : 'low'} variability)`);

// Potential bot/airdrop farmers (many small identical amounts)
const amountCounts = {};
holders.forEach(h => {
  const rounded = Math.round(h.amount * 100) / 100; // Round to 2 decimals
  amountCounts[rounded] = (amountCounts[rounded] || 0) + 1;
});

const suspiciousAmounts = Object.entries(amountCounts)
  .filter(([amt, count]) => count >= 10 && parseFloat(amt) > 0)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10);

if (suspiciousAmounts.length > 0) {
  console.log(`🤖 Potential bot/farmer clusters:`);
  suspiciousAmounts.forEach(([amt, count]) => {
    console.log(`   ${count} holders with exactly ${amt} XSOL`);
  });
}

console.log(`\n✅ Analysis complete. Data quality: ${zeros.length === 0 && uniqueOwners.size === holders.length ? 'GOOD' : 'ISSUES FOUND'}`);