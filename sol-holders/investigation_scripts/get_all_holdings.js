import { Connection, PublicKey } from "@solana/web3.js";
import fs from "node:fs";

const RPC = "https://mainnet.helius-rpc.com/?api-key=99a38773-defa-41b4-9e21-f8b11770aa45";
const csvFile = "xsol_holders.csv";

console.log("💰 EXTRACTING ALL TOKEN HOLDINGS FOR ALL XSOL HOLDERS");
console.log("=" .repeat(60));

// Load all holder data
const data = fs.readFileSync(csvFile, "utf8");
const lines = data.split("\n").slice(1).filter(l => l.trim());
const holders = lines.map(line => {
  const [owner, amountUI, amountRaw] = line.split(",");
  return { owner, xsol_amount: parseFloat(amountUI), raw: BigInt(amountRaw) };
});

const conn = new Connection(RPC, { commitment: "confirmed" });

// We'll process in batches to avoid rate limits
const BATCH_SIZE = 5;
const DELAY = 2000; // ms between requests

let allHoldings = [];
let processed = 0;
let errors = 0;

async function getHolderTokens(holder) {
  try {
    const holderPk = new PublicKey(holder.owner);
    
    // Get all token accounts
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(holderPk, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    });

    const holdings = {
      owner: holder.owner,
      xsol_amount: holder.xsol_amount,
      total_tokens: 0,
      tokens: []
    };

    for (const tokenAccount of tokenAccounts.value) {
      const accountData = tokenAccount.account.data.parsed.info;
      const mint = accountData.mint;
      const amount = accountData.tokenAmount.uiAmount;
      const decimals = accountData.tokenAmount.decimals;
      
      if (amount > 0) {
        holdings.total_tokens++;
        holdings.tokens.push({
          mint,
          amount,
          decimals,
          raw: accountData.tokenAmount.amount
        });
      }
    }

    // Get SOL balance too
    const solBalance = await conn.getBalance(holderPk);
    holdings.sol_balance = solBalance / 1000000000;

    processed++;
    if (processed % 25 === 0) {
      console.log(`📊 Processed ${processed}/${holders.length} (${(processed/holders.length*100).toFixed(1)}%)`);
    }

    // Additional delay for individual requests
    await new Promise(r => setTimeout(r, 100));

    return holdings;

  } catch (error) {
    errors++;
    console.log(`❌ Error processing ${holder.owner.slice(0,8)}: ${error.message}`);
    return {
      owner: holder.owner,
      xsol_amount: holder.xsol_amount,
      total_tokens: 0,
      tokens: [],
      error: error.message
    };
  }
}

async function processBatch(batch) {
  const promises = batch.map(holder => getHolderTokens(holder));
  const results = await Promise.all(promises);
  allHoldings.push(...results);
  
  // Small delay between batches
  await new Promise(r => setTimeout(r, DELAY));
}

console.log(`🎯 Processing ${holders.length} holders in batches of ${BATCH_SIZE}...`);

// Process all holders in batches
for (let i = 0; i < holders.length; i += BATCH_SIZE) {
  const batch = holders.slice(i, i + BATCH_SIZE);
  await processBatch(batch);
}

console.log("\n🏁 PROCESSING COMPLETE");
console.log("=" .repeat(40));
console.log(`Total holders processed: ${processed}`);
console.log(`Errors encountered: ${errors}`);

// Analyze the data
const holdersWithTokens = allHoldings.filter(h => h.total_tokens > 0);
const totalUniqueTokens = new Set();
const tokenFrequency = {};

allHoldings.forEach(holder => {
  holder.tokens.forEach(token => {
    totalUniqueTokens.add(token.mint);
    tokenFrequency[token.mint] = (tokenFrequency[token.mint] || 0) + 1;
  });
});

// Find most common tokens
const commonTokens = Object.entries(tokenFrequency)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 20);

console.log(`\n📊 SUMMARY STATISTICS`);
console.log("-".repeat(30));
console.log(`Holders with tokens: ${holdersWithTokens.length}`);
console.log(`Total unique tokens found: ${totalUniqueTokens.size}`);
console.log(`Average tokens per holder: ${(holdersWithTokens.reduce((sum, h) => sum + h.total_tokens, 0) / holdersWithTokens.length).toFixed(2)}`);

console.log(`\n🔥 TOP 20 MOST HELD TOKENS`);
console.log("-".repeat(40));
commonTokens.forEach(([mint, count], i) => {
  const shortMint = `${mint.slice(0,6)}...${mint.slice(-4)}`;
  console.log(`${i+1}. ${shortMint}: ${count} holders`);
});

// Export detailed CSV
const csvHeaders = [
  "owner",
  "xsol_amount", 
  "sol_balance",
  "total_token_types",
  "top_token_1_mint",
  "top_token_1_amount",
  "top_token_2_mint", 
  "top_token_2_amount",
  "top_token_3_mint",
  "top_token_3_amount",
  "all_tokens_json"
];

const csvRows = allHoldings.map(holder => {
  const sortedTokens = holder.tokens.sort((a, b) => b.amount - a.amount);
  
  return [
    holder.owner,
    holder.xsol_amount,
    holder.sol_balance || 0,
    holder.total_tokens,
    sortedTokens[0]?.mint || "",
    sortedTokens[0]?.amount || 0,
    sortedTokens[1]?.mint || "",
    sortedTokens[1]?.amount || 0,
    sortedTokens[2]?.mint || "",
    sortedTokens[2]?.amount || 0,
    JSON.stringify(holder.tokens.map(t => ({m: t.mint, a: t.amount, d: t.decimals})))
  ].join(",");
});

const fullCsv = [csvHeaders.join(","), ...csvRows].join("\\n");
fs.writeFileSync("all_token_holdings.csv", fullCsv);

// Export just the flagged whales with their full portfolios
const flaggedData = JSON.parse(fs.readFileSync("flagged_whales.json", "utf8"));
const flaggedOwners = new Set(flaggedData.map(w => w.owner));
const flaggedHoldings = allHoldings.filter(h => flaggedOwners.has(h.owner));

fs.writeFileSync("flagged_whale_portfolios.json", JSON.stringify(flaggedHoldings, null, 2));

console.log(`\n📁 EXPORTED FILES:`);
console.log(`- all_token_holdings.csv: ${allHoldings.length} holders with full portfolios`);
console.log(`- flagged_whale_portfolios.json: ${flaggedHoldings.length} flagged whale portfolios`);

// Identify potential exchange wallets by token diversity
const exchangeLike = allHoldings
  .filter(h => h.total_tokens > 100)
  .sort((a, b) => b.total_tokens - a.total_tokens)
  .slice(0, 20);

console.log(`\n🏦 POTENTIAL EXCHANGE WALLETS (>100 tokens)`);
console.log("-".repeat(50));
exchangeLike.forEach((holder, i) => {
  const addr = `${holder.owner.slice(0,6)}...${holder.owner.slice(-4)}`;
  console.log(`${i+1}. ${addr}: ${holder.total_tokens} tokens, ${holder.xsol_amount} XSOL`);
});

if (exchangeLike.length > 0) {
  console.log(`\n🚨 Found ${exchangeLike.length} potential exchange/custody wallets`);
  console.log(`These may represent thousands of individual retail holders`);
}