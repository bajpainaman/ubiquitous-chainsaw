import { Connection, PublicKey } from "@solana/web3.js";

const RPC = "https://mainnet.helius-rpc.com/?api-key=99a38773-defa-41b4-9e21-f8b11770aa45";
const WHALE = "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS";

console.log("🕵️  DEEP TRANSACTION INVESTIGATION");
console.log("Address:", WHALE);
console.log("Question: Why is the largest XSOL holder interacting with gambling sites?");
console.log("=" .repeat(80));

const conn = new Connection(RPC, { commitment: "confirmed" });

const SUSPICIOUS_PROGRAMS = {
  "bitoki.dev🚀best-trading-bot.sol": "Dj8H1jRSDM9z2C8KmgBJ4FVWwnBkpffqq9Wz9Wg33uSh",
  "casino🎰flip.gg": "FLipG5QHjZe1H12f6rr5LCnrmqjhwuBTBp78GwzxnwkR", 
  "casino🍀flip.gg": "FLipgewPwNeqvwPFW3CvMTLpHTvuX7BQoXC6xhrWiCR3",
  "cflip.fun🎰play-and-win🚀.sol": "BdF6PoNB1huwye99wFxtMQ97k5iR4m3CqvvipSZKsix"
};

(async () => {
  try {
    const whalePk = new PublicKey(WHALE);
    
    // Get comprehensive transaction history
    console.log("📊 FETCHING TRANSACTION HISTORY (Last 1000 transactions)");
    const signatures = await conn.getSignaturesForAddress(whalePk, { limit: 1000 });
    
    console.log(`Total transactions found: ${signatures.length}`);
    console.log(`Time range: ${new Date(signatures[signatures.length-1].blockTime * 1000).toISOString()} to ${new Date(signatures[0].blockTime * 1000).toISOString()}`);

    // Analyze transaction patterns
    let gamblingTxs = [];
    let coinbaseFunding = [];
    let suspiciousPatterns = [];
    let programInteractions = {};
    let hourlyActivity = {};
    let dailyVolume = {};

    console.log("\n🔍 ANALYZING TRANSACTION PATTERNS...");
    
    for (let i = 0; i < Math.min(200, signatures.length); i++) {
      try {
        const tx = await conn.getParsedTransaction(signatures[i].signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (!tx || !tx.meta) continue;
        
        const date = new Date(signatures[i].blockTime * 1000);
        const hour = date.getUTCHours();
        const day = date.toISOString().split('T')[0];
        
        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        dailyVolume[day] = (dailyVolume[day] || 0) + 1;
        
        // Check for suspicious program interactions
        const programsInTx = new Set();
        tx.transaction.message.instructions.forEach(ix => {
          if ('programId' in ix) {
            const programId = ix.programId.toBase58();
            programsInTx.add(programId);
            programInteractions[programId] = (programInteractions[programId] || 0) + 1;
          }
        });
        
        // Check for gambling site interactions
        let isGamblingTx = false;
        Object.entries(SUSPICIOUS_PROGRAMS).forEach(([name, address]) => {
          if (programsInTx.has(address)) {
            gamblingTxs.push({
              signature: signatures[i].signature,
              time: date.toISOString(),
              gamblingApp: name,
              programId: address
            });
            isGamblingTx = true;
          }
        });
        
        // Check transaction accounts for Coinbase patterns
        const accountKeys = tx.transaction.message.accountKeys.map(key => 
          typeof key === 'string' ? key : key.pubkey.toBase58()
        );
        
        accountKeys.forEach(account => {
          // Look for known Coinbase patterns or labels
          if (account.includes('Coinbase') || account === 'BbvE5eAArQx9CgYL23KSRUmPdpCbcxV6bWWFsKKPNnP') {
            coinbaseFunding.push({
              signature: signatures[i].signature,
              time: date.toISOString(),
              account: account
            });
          }
        });

        if (i % 50 === 0) {
          console.log(`   Processed ${i}/${Math.min(200, signatures.length)} transactions...`);
        }

      } catch (err) {
        console.log(`   Skipped transaction ${i}: ${err.message}`);
        continue;
      }
      
      // Rate limit protection
      await new Promise(r => setTimeout(r, 50));
    }

    // ANALYSIS RESULTS
    console.log("\n🎰 GAMBLING INTERACTIONS ANALYSIS");
    console.log("-".repeat(50));
    if (gamblingTxs.length > 0) {
      console.log(`🚨 FOUND ${gamblingTxs.length} GAMBLING TRANSACTIONS!`);
      console.log("Recent gambling activity:");
      gamblingTxs.slice(0, 10).forEach((tx, i) => {
        console.log(`${i+1}. ${tx.time}: ${tx.gamblingApp}`);
        console.log(`   Signature: ${tx.signature}`);
      });
    } else {
      console.log("No direct gambling transactions found in sample");
    }

    console.log("\n🏦 COINBASE CONNECTION ANALYSIS");
    console.log("-".repeat(50));
    if (coinbaseFunding.length > 0) {
      console.log(`💰 FOUND ${coinbaseFunding.length} COINBASE-RELATED TRANSACTIONS!`);
      coinbaseFunding.slice(0, 5).forEach((tx, i) => {
        console.log(`${i+1}. ${tx.time}: ${tx.account}`);
      });
    } else {
      console.log("No direct Coinbase connections found in analyzed transactions");
    }

    console.log("\n📊 ACTIVITY PATTERN ANALYSIS");
    console.log("-".repeat(50));
    
    // Hour analysis
    const topHours = Object.entries(hourlyActivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    console.log("Most active hours (UTC):");
    topHours.forEach(([hour, count]) => {
      console.log(`  ${hour}:00 - ${count} transactions`);
    });

    // Daily volume
    const totalDays = Object.keys(dailyVolume).length;
    const avgDaily = signatures.length / totalDays;
    console.log(`\nDaily activity: ${avgDaily.toFixed(1)} transactions/day average`);

    // Top programs
    console.log("\n💻 TOP PROGRAM INTERACTIONS");
    console.log("-".repeat(50));
    const topPrograms = Object.entries(programInteractions)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    topPrograms.forEach(([program, count], i) => {
      let programName = program;
      // Map known programs
      if (program === "11111111111111111111111111111111") programName = "System Program";
      else if (program === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") programName = "SPL Token";
      else if (program === "ComputeBudget111111111111111111111111111111") programName = "Compute Budget";
      else if (Object.values(SUSPICIOUS_PROGRAMS).includes(program)) {
        const suspiciousName = Object.keys(SUSPICIOUS_PROGRAMS).find(name => SUSPICIOUS_PROGRAMS[name] === program);
        programName = `🚨 ${suspiciousName}`;
      }
      
      console.log(`${i+1}. ${programName.slice(0, 40)}: ${count} interactions`);
      console.log(`   ${program}`);
    });

    console.log("\n🕵️  INVESTIGATION CONCLUSIONS");
    console.log("=" .repeat(50));
    
    let suspicionScore = 0;
    let flags = [];

    if (gamblingTxs.length > 0) {
      suspicionScore += 40;
      flags.push(`${gamblingTxs.length} gambling transactions detected`);
    }

    if (coinbaseFunding.length > 0) {
      suspicionScore += 20;
      flags.push(`${coinbaseFunding.length} Coinbase-related transactions`);
    }

    // Check for bot-like activity
    const maxHourlyActivity = Math.max(...Object.values(hourlyActivity));
    const avgHourlyActivity = signatures.length / 24;
    if (maxHourlyActivity > avgHourlyActivity * 3) {
      suspicionScore += 15;
      flags.push("Concentrated hourly activity (bot-like)");
    }

    // Check for high frequency
    if (signatures.length > 500) {
      suspicionScore += 10;
      flags.push("Extremely high transaction frequency");
    }

    console.log(`SUSPICION SCORE: ${suspicionScore}/100`);
    console.log("RED FLAGS:");
    flags.forEach(flag => console.log(`  🚩 ${flag}`));

    if (suspicionScore > 50) {
      console.log("\n🚨 VERDICT: HIGHLY SUSPICIOUS ACTIVITY");
      console.log("This does NOT match legitimate Kraken/institutional behavior");
      console.log("Evidence suggests:");
      console.log("  • Gambling/gaming activity");
      console.log("  • Automated trading patterns");  
      console.log("  • Mixed funding sources");
      console.log("  • High-frequency operations");
    } else if (suspicionScore > 25) {
      console.log("\n⚠️  VERDICT: MODERATELY SUSPICIOUS");
      console.log("Some concerning patterns detected");
    } else {
      console.log("\n✅ VERDICT: APPEARS LEGITIMATE");
      console.log("Activity patterns consistent with institutional use");
    }

    console.log(`\n📁 Investigation complete. Analyzed ${Math.min(200, signatures.length)} transactions.`);

  } catch (error) {
    console.error("Investigation failed:", error.message);
  }
})();