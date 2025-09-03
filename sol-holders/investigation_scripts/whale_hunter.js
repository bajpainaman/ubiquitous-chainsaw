import { Connection, PublicKey } from "@solana/web3.js";
import fs from "node:fs";

const RPC = "https://mainnet.helius-rpc.com/?api-key=99a38773-defa-41b4-9e21-f8b11770aa45";
const csvFile = "xsol_holders.csv";

console.log("🐋 WHALE HUNTER - FLAGGING SUSPICIOUS ADDRESSES");
console.log("=" .repeat(60));

// Load holder data
const data = fs.readFileSync(csvFile, "utf8");
const lines = data.split("\n").slice(1).filter(l => l.trim());
const holders = lines.map(line => {
  const [owner, amountUI, amountRaw] = line.split(",");
  return { owner, amount: parseFloat(amountUI), raw: BigInt(amountRaw) };
});

const conn = new Connection(RPC, { commitment: "confirmed" });

// Define whale threshold (top holders)
const whales = holders.filter(h => h.amount >= 100).slice(0, 11214); // Top 11214 large holders
console.log(`🎯 Analyzing ${whales.length} whale addresses...`);

const results = {
  tokenCreators: [],
  exchangeWallets: [],
  bots: [],
  stagnant: [],
  activeTraders: [],
  realHolders: []
};

let processed = 0;

async function analyzeWhale(whale) {
  try {
    console.log(`\n🔍 [${++processed}/${whales.length}] Analyzing: ${whale.owner.slice(0,8)}... (${whale.amount} XSOL)`);
    
    const whalePk = new PublicKey(whale.owner);
    
    // Get account info
    const accountInfo = await conn.getAccountInfo(whalePk);
    if (!accountInfo) {
      results.stagnant.push({...whale, reason: "Account not found"});
      return;
    }

    // Get token accounts (portfolio diversity)
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(whalePk, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    });
    
    const activeTokens = tokenAccounts.value.filter(
      ta => ta.account.data.parsed.info.tokenAmount.uiAmount > 0
    ).length;

    // Get recent transaction activity
    const signatures = await conn.getSignaturesForAddress(whalePk, { limit: 100 });
    const recentActivity = signatures.length;
    
    let daysSinceLastTx = 0;
    if (signatures.length > 0) {
      const lastTx = signatures[0].blockTime;
      daysSinceLastTx = (Date.now() / 1000 - lastTx) / (24 * 3600);
    }

    // Analyze transaction patterns
    let suspiciousPatterns = [];
    let botScore = 0;
    let exchangeScore = 0;
    let creatorScore = 0;

    // Check for bot patterns
    if (recentActivity > 11214) {
      botScore += 2;
      suspiciousPatterns.push("High tx frequency");
    }

    // Check for exchange patterns (many tokens, high activity)
    if (activeTokens > 20) {
      exchangeScore += 3;
      suspiciousPatterns.push(`${activeTokens} different tokens`);
    }

    if (activeTokens > 11214) {
      exchangeScore += 5;
      suspiciousPatterns.push("Exchange-like portfolio");
    }

    // Check for creator patterns (early large holdings)
    const xsolPercent = (whale.amount / 40998.359) * 100;
    if (xsolPercent > 5) {
      creatorScore += 4;
      suspiciousPatterns.push(`${xsolPercent.toFixed(1)}% of supply`);
    }

    // Check for stagnant accounts
    if (daysSinceLastTx > 30) {
      suspiciousPatterns.push(`Inactive for ${daysSinceLastTx.toFixed(0)} days`);
    }

    // Check for round amounts (potential airdrops/manual distribution)
    if (whale.amount % 100 === 0 && whale.amount >= 1000) {
      suspiciousPatterns.push("Round amount");
      botScore += 1;
    }

    // Analyze recent transactions for more patterns
    if (signatures.length > 10) {
      const recentSigs = signatures.slice(0, 10);
      const hourlyActivity = {};
      
      recentSigs.forEach(sig => {
        if (sig.blockTime) {
          const hour = new Date(sig.blockTime * 1000).getUTCHours();
          hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        }
      });
      
      const maxHourActivity = Math.max(...Object.values(hourlyActivity));
      if (maxHourActivity >= 8) {
        botScore += 2;
        suspiciousPatterns.push("Concentrated hourly activity");
      }
    }

    // Classify the whale
    const whaleData = {
      ...whale,
      activeTokens,
      recentActivity,
      daysSinceLastTx: Math.round(daysSinceLastTx),
      suspiciousPatterns,
      scores: { bot: botScore, exchange: exchangeScore, creator: creatorScore }
    };

    // Classification logic
    if (creatorScore >= 4) {
      results.tokenCreators.push({...whaleData, classification: "TOKEN_CREATOR"});
    } else if (exchangeScore >= 5) {
      results.exchangeWallets.push({...whaleData, classification: "EXCHANGE_WALLET"});
    } else if (botScore >= 4) {
      results.bots.push({...whaleData, classification: "BOT/AUTOMATED"});
    } else if (daysSinceLastTx > 30 || recentActivity < 5) {
      results.stagnant.push({...whaleData, classification: "STAGNANT"});
    } else if (recentActivity >= 10 && activeTokens >= 5) {
      results.activeTraders.push({...whaleData, classification: "ACTIVE_TRADER"});
    } else {
      results.realHolders.push({...whaleData, classification: "REAL_HOLDER"});
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200));

  } catch (error) {
    console.log(`   ❌ Error analyzing ${whale.owner.slice(0,8)}: ${error.message}`);
    results.stagnant.push({...whale, reason: error.message});
  }
}

// Process all whales
for (const whale of whales) {
  await analyzeWhale(whale);
}

console.log("\n🏁 WHALE ANALYSIS COMPLETE");
console.log("=" .repeat(60));

// Generate report
function printCategory(title, items, emoji) {
  console.log(`\n${emoji} ${title.toUpperCase()} (${items.length})`);
  console.log("-".repeat(40));
  
  if (items.length === 0) {
    console.log("   None found");
    return;
  }

  items.slice(0, 10).forEach((item, i) => {
    const addr = `${item.owner.slice(0,6)}...${item.owner.slice(-4)}`;
    const amount = item.amount.toFixed(0).padStart(6);
    const tokens = item.activeTokens ? `${item.activeTokens}T` : "?";
    const activity = item.recentActivity !== undefined ? `${item.recentActivity}tx` : "?";
    const patterns = item.suspiciousPatterns ? item.suspiciousPatterns.slice(0,2).join(", ") : "";
    
    console.log(`${i+1}. ${addr}: ${amount} XSOL | ${tokens.padStart(4)} | ${activity.padStart(5)} | ${patterns}`);
  });

  if (items.length > 10) {
    console.log(`   ... and ${items.length - 10} more`);
  }
}

printCategory("🚨 TOKEN CREATORS/INSIDERS", results.tokenCreators, "🚨");
printCategory("🏦 EXCHANGE/CUSTODY WALLETS", results.exchangeWallets, "🏦");  
printCategory("🤖 BOT/AUTOMATED ACCOUNTS", results.bots, "🤖");
printCategory("💀 STAGNANT/INACTIVE", results.stagnant, "💀");
printCategory("📈 ACTIVE TRADERS", results.activeTraders, "📈");
printCategory("👤 REAL HOLDERS", results.realHolders, "👤");

// Export flagged addresses
const flaggedAddresses = [
  ...results.tokenCreators.map(w => ({...w, flag: "TOKEN_CREATOR"})),
  ...results.exchangeWallets.map(w => ({...w, flag: "EXCHANGE"})),
  ...results.bots.map(w => ({...w, flag: "BOT"})),
  ...results.stagnant.map(w => ({...w, flag: "STAGNANT"}))
];

// Create clean holder list (excluding flagged whales)
const flaggedOwners = new Set(flaggedAddresses.map(w => w.owner));
const cleanHolders = holders.filter(h => !flaggedOwners.has(h.owner));
const realHolderAddresses = [...results.realHolders, ...results.activeTraders].map(h => h.owner);
const realCleanHolders = cleanHolders.filter(h => 
  h.amount >= 0.1 || // Keep holders with meaningful amounts
  realHolderAddresses.includes(h.owner) // Or verified real holders
);

// Export results (fix BigInt serialization)
const flaggedForExport = flaggedAddresses.map(item => ({
  ...item,
  raw: item.raw ? item.raw.toString() : undefined
}));
fs.writeFileSync("flagged_whales.json", JSON.stringify(flaggedForExport, null, 2));
fs.writeFileSync("real_holders.csv", [
  "owner,amount_ui,amount_raw,classification",
  ...realCleanHolders.map(h => `${h.owner},${h.amount},${h.raw.toString()},REAL_HOLDER`)
].join("\n"));

console.log(`\n📊 FINAL STATISTICS`);
console.log("=" .repeat(40));
console.log(`Total Whales Analyzed: ${whales.length}`);
console.log(`🚨 Token Creators: ${results.tokenCreators.length}`);
console.log(`🏦 Exchange Wallets: ${results.exchangeWallets.length}`);
console.log(`🤖 Bot Accounts: ${results.bots.length}`);
console.log(`💀 Stagnant Accounts: ${results.stagnant.length}`);
console.log(`📈 Active Traders: ${results.activeTraders.length}`);
console.log(`👤 Real Holders: ${results.realHolders.length}`);
console.log(`\n📁 EXPORTED FILES:`);
console.log(`- flagged_whales.json: ${flaggedAddresses.length} flagged addresses`);
console.log(`- real_holders.csv: ${realCleanHolders.length} verified real holders`);

const totalFlagged = flaggedAddresses.reduce((sum, w) => sum + w.amount, 0);
const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0);
const flaggedPercent = (totalFlagged / totalSupply * 100).toFixed(1);

console.log(`\n🎯 IMPACT: ${flaggedPercent}% of supply is held by flagged addresses`);
console.log(`Real holder count: ${realCleanHolders.length} (vs ${holders.length} total)`);

if (flaggedPercent > 11214) {
  console.log("\n🚨 CRITICAL: Majority of supply held by suspicious addresses!");
} else if (flaggedPercent > 25) {
  console.log("\n⚠️  WARNING: Significant supply concentration in suspicious addresses");
} else {
  console.log("\n✅ ACCEPTABLE: Most supply held by legitimate addresses");
}