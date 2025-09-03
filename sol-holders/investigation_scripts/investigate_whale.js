import { Connection, PublicKey } from "@solana/web3.js";

const WHALE = "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS";
const RPC = "https://mainnet.helius-rpc.com/?api-key=99a38773-defa-41b4-9e21-f8b11770aa45";

console.log("🕵️  WHALE ADDRESS INVESTIGATION");
console.log("=" .repeat(50));
console.log(`Target: ${WHALE}`);
console.log(`Balance: 4,202.77 XSOL (10.2% of supply)`);

(async () => {
  const conn = new Connection(RPC, { commitment: "confirmed" });
  const whalePk = new PublicKey(WHALE);

  try {
    // 1. Basic account info
    console.log("\n📊 ACCOUNT ANALYSIS");
    console.log("-".repeat(30));
    
    const accountInfo = await conn.getAccountInfo(whalePk);
    if (accountInfo) {
      console.log(`Owner Program: ${accountInfo.owner.toBase58()}`);
      console.log(`Data Length: ${accountInfo.data.length} bytes`);
      console.log(`Executable: ${accountInfo.executable}`);
      console.log(`Rent Epoch: ${accountInfo.rentEpoch}`);
      
      if (accountInfo.executable) {
        console.log("🚨 EXECUTABLE ACCOUNT - This is a PROGRAM/CONTRACT");
      } else if (accountInfo.owner.toBase58() === "11111111111111111111111111111111") {
        console.log("👤 SYSTEM ACCOUNT - Regular wallet");
      } else {
        console.log(`🏗️  PROGRAM-OWNED ACCOUNT - Owned by: ${accountInfo.owner.toBase58()}`);
      }
    }

    // 2. Get all token accounts owned by this address
    console.log("\n💰 TOKEN HOLDINGS");
    console.log("-".repeat(30));
    
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(whalePk, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    });
    
    console.log(`Token accounts owned: ${tokenAccounts.value.length}`);
    
    let totalTokenTypes = 0;
    let suspiciousPatterns = [];
    
    for (const tokenAccount of tokenAccounts.value) {
      const accountData = tokenAccount.account.data.parsed.info;
      const mint = accountData.mint;
      const amount = accountData.tokenAmount.uiAmount;
      const decimals = accountData.tokenAmount.decimals;
      
      if (amount > 0) {
        totalTokenTypes++;
        console.log(`  ${mint}: ${amount} tokens (${decimals} decimals)`);
        
        // Check for round numbers or suspicious patterns
        if (amount % 1000000 === 0 && amount > 1000000) {
          suspiciousPatterns.push(`Round million: ${amount}`);
        }
      }
    }
    
    console.log(`\nTotal token types held: ${totalTokenTypes}`);
    if (suspiciousPatterns.length > 0) {
      console.log("🚨 Suspicious round amounts found:");
      suspiciousPatterns.forEach(pattern => console.log(`  - ${pattern}`));
    }

    // 3. SOL balance
    const solBalance = await conn.getBalance(whalePk);
    console.log(`SOL Balance: ${solBalance / 1000000000} SOL`);

    // 4. Transaction signature analysis (recent activity)
    console.log("\n📈 RECENT ACTIVITY");
    console.log("-".repeat(30));
    
    const signatures = await conn.getSignaturesForAddress(whalePk, { limit: 50 });
    console.log(`Recent transactions: ${signatures.length}`);
    
    if (signatures.length > 0) {
      const recentSig = signatures[0];
      console.log(`Most recent: ${recentSig.signature}`);
      console.log(`Block time: ${new Date(recentSig.blockTime * 1000).toISOString()}`);
      
      // Analyze transaction patterns
      const hourlyActivity = {};
      const dailyActivity = {};
      
      signatures.forEach(sig => {
        if (sig.blockTime) {
          const date = new Date(sig.blockTime * 1000);
          const hour = date.getUTCHours();
          const day = date.getUTCDay();
          
          hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
          dailyActivity[day] = (dailyActivity[day] || 0) + 1;
        }
      });
      
      // Find peak activity hours (could indicate automated trading)
      const peakHour = Object.entries(hourlyActivity)
        .sort(([,a], [,b]) => b - a)[0];
      
      console.log(`Peak activity hour: ${peakHour[0]}:00 UTC (${peakHour[1]} txs)`);
      
      // Check for bot-like patterns (too regular)
      const activitySpread = Object.values(hourlyActivity);
      const maxActivity = Math.max(...activitySpread);
      const minActivity = Math.min(...activitySpread);
      const activityRatio = maxActivity / Math.max(minActivity, 1);
      
      if (activityRatio > 10) {
        console.log("🤖 HIGH ACTIVITY CONCENTRATION - Possible bot behavior");
      }
    }

    // 5. Try to get detailed transaction for analysis
    if (signatures.length > 0) {
      console.log("\n🔍 TRANSACTION ANALYSIS");
      console.log("-".repeat(30));
      
      const tx = await conn.getParsedTransaction(signatures[0].signature, {
        maxSupportedTransactionVersion: 0
      });
      
      if (tx && tx.meta) {
        console.log(`Instructions: ${tx.transaction.message.instructions.length}`);
        console.log(`Accounts involved: ${tx.transaction.message.accountKeys.length}`);
        
        // Check for program interactions that might indicate CEX/DEX activity
        const programsUsed = tx.transaction.message.instructions.map(ix => {
          if ('programId' in ix) {
            return ix.programId.toBase58();
          }
          return null;
        }).filter(Boolean);
        
        const uniquePrograms = [...new Set(programsUsed)];
        console.log("Programs interacted with:");
        uniquePrograms.forEach(program => {
          console.log(`  - ${program}`);
          
          // Known program patterns
          if (program === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
            console.log("    → SPL Token Program");
          } else if (program === "11111111111111111111111111111111") {
            console.log("    → System Program");
          } else if (program === "srmqPiD2AzNmj52kcCIoZJZzb5PnhvwqCjRTVvHLtPF") {
            console.log("    → Serum DEX (Decentralized Exchange)");
          } else if (program.includes("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1")) {
            console.log("    → Possible CEX interaction");
          }
        });
      }
    }

    // 6. FINAL ASSESSMENT
    console.log("\n🎯 ASSESSMENT");
    console.log("=" .repeat(30));
    
    let walletType = "UNKNOWN";
    let suspicionLevel = "LOW";
    let reasoning = [];
    
    if (accountInfo?.executable) {
      walletType = "SMART CONTRACT";
      suspicionLevel = "LOW";
      reasoning.push("Address is executable program/contract");
    } else if (totalTokenTypes > 100) {
      walletType = "EXCHANGE/CUSTODY";
      suspicionLevel = "MEDIUM";
      reasoning.push(`Holds ${totalTokenTypes} different tokens (typical of CEX)`);
    } else if (totalTokenTypes > 20) {
      walletType = "LARGE TRADER/FUND";
      suspicionLevel = "MEDIUM";
      reasoning.push("Diverse token portfolio suggests institutional entity");
    } else if (signatures.length > 0 && signatures.length < 10) {
      walletType = "INACTIVE/WHALE";
      suspicionLevel = "HIGH";
      reasoning.push("Low transaction activity for large holdings");
    }
    
    // Check XSOL concentration
    const xsolPercent = (4202.77 / 40998.359) * 100;
    if (xsolPercent > 10) {
      suspicionLevel = "HIGH";
      reasoning.push(`Controls ${xsolPercent.toFixed(1)}% of XSOL supply`);
    }
    
    console.log(`WALLET TYPE: ${walletType}`);
    console.log(`SUSPICION LEVEL: ${suspicionLevel}`);
    console.log("REASONING:");
    reasoning.forEach(reason => console.log(`  • ${reason}`));
    
    if (suspicionLevel === "HIGH") {
      console.log("\n🚨 RED FLAGS DETECTED - INVESTIGATE FURTHER");
    }

  } catch (error) {
    console.error("Error investigating whale:", error.message);
  }
})();