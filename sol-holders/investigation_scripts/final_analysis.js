import fs from "node:fs";

console.log("📊 FINAL XSOL ANALYSIS - WHALE CONTROL vs POOR ADOPTION vs MARKET MAKERS");
console.log("=" .repeat(80));

// Load all data
const holders = fs.readFileSync("xsol_holders.csv", "utf8")
  .split("\n").slice(1).filter(l => l.trim())
  .map(line => {
    const [owner, amountUI, amountRaw] = line.split(",");
    return { owner, amount: parseFloat(amountUI), raw: BigInt(amountRaw) };
  });

// Load flagged whales if exists
let flaggedWhales = [];
try {
  flaggedWhales = JSON.parse(fs.readFileSync("flagged_whales.json", "utf8"));
} catch (e) {
  console.log("No flagged whales data found");
}

console.log(`\n📈 BASIC STATISTICS`);
console.log("-".repeat(40));
const total = holders.reduce((sum, h) => sum + h.amount, 0);
const mean = total / holders.length;
const median = holders.map(h => h.amount).sort((a, b) => b - a)[Math.floor(holders.length / 2)];

console.log(`Total holders: ${holders.length.toLocaleString()}`);
console.log(`Total supply: ${total.toLocaleString()} XSOL`);
console.log(`Mean balance: ${mean.toFixed(8)} XSOL`);
console.log(`Median balance: ${median.toFixed(8)} XSOL`);

// Distribution analysis
const tiers = [
  { name: "Dust", min: 0, max: 0.01, color: "🗑️" },
  { name: "Micro", min: 0.01, max: 0.1, color: "🔸" },
  { name: "Small", min: 0.1, max: 1, color: "🟡" },
  { name: "Medium", min: 1, max: 10, color: "🟠" },
  { name: "Large", min: 10, max: 100, color: "🔴" },
  { name: "Whale", min: 100, max: 1000, color: "🐋" },
  { name: "Mega Whale", min: 1000, max: Infinity, color: "🦈" }
];

console.log(`\n🎯 DISTRIBUTION TIERS`);
console.log("-".repeat(50));
console.log("Tier".padEnd(12) + "Count".padStart(8) + "% Holders".padStart(12) + "Supply".padStart(12) + "% Supply".padStart(12));
console.log("-".repeat(50));

tiers.forEach(tier => {
  const tierHolders = holders.filter(h => h.amount > tier.min && h.amount <= tier.max);
  const tierSupply = tierHolders.reduce((sum, h) => sum + h.amount, 0);
  const holderPct = (tierHolders.length / holders.length * 100).toFixed(1);
  const supplyPct = (tierSupply / total * 100).toFixed(1);
  
  console.log(
    `${tier.color} ${tier.name}`.padEnd(12) + 
    tierHolders.length.toString().padStart(8) + 
    `${holderPct}%`.padStart(12) + 
    tierSupply.toFixed(0).padStart(12) + 
    `${supplyPct}%`.padStart(12)
  );
});

// Concentration analysis
const top10 = holders.slice(0, 10);
const top50 = holders.slice(0, 50);
const top100 = holders.slice(0, 100);
const top1pct = holders.slice(0, Math.ceil(holders.length * 0.01));
const top5pct = holders.slice(0, Math.ceil(holders.length * 0.05));

const top10Supply = top10.reduce((sum, h) => sum + h.amount, 0);
const top50Supply = top50.reduce((sum, h) => sum + h.amount, 0);
const top100Supply = top100.reduce((sum, h) => sum + h.amount, 0);
const top1pctSupply = top1pct.reduce((sum, h) => sum + h.amount, 0);
const top5pctSupply = top5pct.reduce((sum, h) => sum + h.amount, 0);

console.log(`\n🏆 CONCENTRATION ANALYSIS`);
console.log("-".repeat(40));
console.log(`Top 10 holders: ${(top10Supply/total*100).toFixed(1)}% of supply`);
console.log(`Top 50 holders: ${(top50Supply/total*100).toFixed(1)}% of supply`);
console.log(`Top 100 holders: ${(top100Supply/total*100).toFixed(1)}% of supply`);
console.log(`Top 1% (${top1pct.length}): ${(top1pctSupply/total*100).toFixed(1)}% of supply`);
console.log(`Top 5% (${top5pct.length}): ${(top5pctSupply/total*100).toFixed(1)}% of supply`);

// Gini coefficient calculation
let gini = 0;
const amounts = holders.map(h => h.amount).sort((a, b) => a - b);
for (let i = 0; i < amounts.length; i++) {
  for (let j = 0; j < amounts.length; j++) {
    gini += Math.abs(amounts[i] - amounts[j]);
  }
}
gini = gini / (2 * amounts.length * amounts.length * mean);

console.log(`Gini coefficient: ${gini.toFixed(4)} (0=perfect equality, 1=maximum inequality)`);

// Pattern analysis for market manipulation vs natural distribution
console.log(`\n🔍 PATTERN ANALYSIS`);
console.log("-".repeat(40));

// Check for suspicious round numbers
const roundNumbers = holders.filter(h => {
  return (h.amount % 1 === 0 && h.amount >= 10) || 
         (h.amount % 10 === 0 && h.amount >= 100) ||
         (h.amount % 100 === 0 && h.amount >= 1000);
}).length;

console.log(`Round number holdings: ${roundNumbers} (${(roundNumbers/holders.length*100).toFixed(1)}%)`);

// Check for identical amounts (farming)
const amountCounts = {};
holders.forEach(h => {
  const rounded = Math.round(h.amount * 1000000) / 1000000;
  amountCounts[rounded] = (amountCounts[rounded] || 0) + 1;
});

const identicalClusters = Object.entries(amountCounts)
  .filter(([amt, count]) => count >= 10 && parseFloat(amt) > 0)
  .length;

console.log(`Identical amount clusters (≥10 holders): ${identicalClusters}`);

// Market maker indicators
const whales = holders.filter(h => h.amount >= 100);
const megaWhales = holders.filter(h => h.amount >= 1000);
const dustAccounts = holders.filter(h => h.amount <= 0.01);

console.log(`Potential market makers (≥100): ${whales.length}`);
console.log(`Mega whales (≥1000): ${megaWhales.length}`);
console.log(`Dust accounts (≤0.01): ${dustAccounts.length} (${(dustAccounts.length/holders.length*100).toFixed(1)}%)`);

// Health score calculation
let healthScore = 100;
let healthReasons = [];

if (gini > 0.8) {
  healthScore -= 30;
  healthReasons.push("Extreme inequality (Gini > 0.8)");
}
if ((top10Supply/total) > 50) {
  healthScore -= 25;
  healthReasons.push("Top 10 control >50% of supply");
}
if ((dustAccounts.length/holders.length) > 50) {
  healthScore -= 20;
  healthReasons.push("Majority are dust accounts");
}
if (identicalClusters > 20) {
  healthScore -= 15;
  healthReasons.push("High farming/bot activity");
}
if (megaWhales.length > 5) {
  healthScore -= 10;
  healthReasons.push("Too many mega whales");
}

console.log(`\n📊 TOKEN HEALTH SCORE: ${Math.max(healthScore, 0)}/100`);
console.log("Issues identified:");
healthReasons.forEach(reason => console.log(`  • ${reason}`));

// Final verdict
console.log(`\n🎯 FINAL VERDICT`);
console.log("=".repeat(50));

let verdict = "";
let classification = "";

if (healthScore < 30) {
  verdict = "🚨 CRITICAL - AVOID";
  classification = "MANIPULATION/SCAM";
} else if (healthScore < 50) {
  verdict = "⚠️  HIGH RISK";
  classification = "WHALE CONTROLLED";
} else if (healthScore < 70) {
  verdict = "🟡 MODERATE RISK";
  classification = "POOR ADOPTION";
} else {
  verdict = "✅ ACCEPTABLE";
  classification = "HEALTHY DISTRIBUTION";
}

console.log(`Verdict: ${verdict}`);
console.log(`Classification: ${classification}`);

// Determine primary issue
if ((top10Supply/total) > 70) {
  console.log(`Primary Issue: EXTREME WHALE CONTROL (Top 10 = ${(top10Supply/total*100).toFixed(1)}%)`);
} else if ((dustAccounts.length/holders.length) > 70) {
  console.log(`Primary Issue: POOR ADOPTION (${(dustAccounts.length/holders.length*100).toFixed(1)}% dust accounts)`);
} else if (identicalClusters > 50) {
  console.log(`Primary Issue: BOT/FARMING MANIPULATION (${identicalClusters} clusters)`);
} else if (whales.length < 10 && megaWhales.length === 0) {
  console.log(`Primary Issue: POOR ADOPTION (No significant holders)`);
} else {
  console.log(`Primary Issue: MIXED FACTORS (Whale control + Poor adoption)`);
}

// Export summary data
const summary = {
  totalHolders: holders.length,
  totalSupply: total,
  giniCoefficient: gini,
  healthScore,
  verdict,
  classification,
  distribution: {
    top10Percent: (top10Supply/total*100),
    top1PercentHolders: top1pct.length,
    top1PercentSupply: (top1pctSupply/total*100),
    dustAccountPercent: (dustAccounts.length/holders.length*100)
  },
  risks: healthReasons,
  whaleCount: whales.length,
  megaWhaleCount: megaWhales.length,
  suspiciousClusters: identicalClusters
};

fs.writeFileSync("token_analysis_summary.json", JSON.stringify(summary, null, 2));
console.log(`\n📁 Exported: token_analysis_summary.json`);