import { Connection, PublicKey } from "@solana/web3.js";

const RPC = "https://mainnet.helius-rpc.com/?api-key=99a38773-defa-41b4-9e21-f8b11770aa45";
const TX_SIGNATURE = "5Z5UA1NxbR7HUM8DXhC5jRZHvLkvbHEpNEB8uhzKLvGBYZk5QxasztQiwcFYvBt6nuJgaSnQMueNdNkFFmrWi58J";

console.log("🔍 INVESTIGATING SPECIFIC TRANSACTION");
console.log("Signature:", TX_SIGNATURE);
console.log("=" .repeat(80));

(async () => {
  try {
    const conn = new Connection(RPC, { commitment: "confirmed" });
    
    console.log("📊 FETCHING TRANSACTION DETAILS...");
    const tx = await conn.getParsedTransaction(TX_SIGNATURE, {
      maxSupportedTransactionVersion: 0
    });
    
    if (!tx || !tx.meta) {
      console.log("❌ Transaction not found or failed");
      return;
    }

    console.log(`\n✅ TRANSACTION FOUND`);
    console.log(`Block: ${tx.slot}`);
    console.log(`Status: ${tx.meta.err ? 'FAILED' : 'SUCCESS'}`);
    console.log(`Fee: ${tx.meta.fee} lamports`);
    
    // Get all accounts involved
    console.log(`\n👥 ACCOUNTS INVOLVED:`);
    const accounts = tx.transaction.message.accountKeys;
    accounts.forEach((account, i) => {
      const addr = typeof account === 'string' ? account : account.pubkey.toBase58();
      const writable = typeof account === 'string' ? false : account.writable;
      const signer = typeof account === 'string' ? false : account.signer;
      
      console.log(`${i}: ${addr} ${signer ? '(signer)' : ''} ${writable ? '(writable)' : '(readonly)'}`);
      
      // Check if this is our whale
      if (addr === "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS") {
        console.log("   🐋 THIS IS THE WHALE ADDRESS!");
      }
    });

    // Analyze instructions
    console.log(`\n💻 INSTRUCTIONS (${tx.transaction.message.instructions.length}):`);
    tx.transaction.message.instructions.forEach((ix, i) => {
      if ('programId' in ix) {
        const programId = ix.programId.toBase58();
        console.log(`${i+1}. Program: ${programId}`);
        
        // Check for known programs
        if (programId === "11111111111111111111111111111111") {
          console.log("   → System Program");
        } else if (programId === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
          console.log("   → SPL Token Program");
        } else if (programId === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") {
          console.log("   → Token Extensions Program");
        } else if (programId === "ComputeBudget111111111111111111111111111111") {
          console.log("   → Compute Budget Program");
        } else if (programId === "Dj8H1jRSDM9z2C8KmgBJ4FVWhnBkpffqq9Wz9Wg33uSh") {
          console.log("   🚨 GAMBLING PROGRAM: bitoki.dev🚀best-trading-bot.sol");
        } else {
          console.log("   → Unknown/Custom Program");
        }
      }
    });

    // Check for token transfers
    console.log(`\n💰 TOKEN TRANSFERS:`);
    if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
      const preBalances = tx.meta.preTokenBalances;
      const postBalances = tx.meta.postTokenBalances;
      
      // Match pre and post balances
      postBalances.forEach(post => {
        const pre = preBalances.find(p => 
          p.accountIndex === post.accountIndex && 
          p.mint === post.mint
        );
        
        if (pre) {
          const preAmount = parseFloat(pre.uiTokenAmount.uiAmountString || '0');
          const postAmount = parseFloat(post.uiTokenAmount.uiAmountString || '0');
          const change = postAmount - preAmount;
          
          if (Math.abs(change) > 0.000001) { // Ignore dust
            const direction = change > 0 ? '+' : '';
            console.log(`   Account ${post.accountIndex}: ${direction}${change.toFixed(8)} ${post.mint.slice(0,8)}...`);
            
            // Check if this involves XSOL
            if (post.mint === "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB") {
              console.log("   🎯 XSOL TRANSFER DETECTED!");
            }
          }
        }
      });
    }

    // Check logs for additional info
    console.log(`\n📝 TRANSACTION LOGS:`);
    if (tx.meta.logMessages && tx.meta.logMessages.length > 0) {
      tx.meta.logMessages.forEach((log, i) => {
        if (!log.includes("Program log: Instruction:") && 
            !log.includes("Program 11111111") &&
            !log.includes("Program TokenkegQ")) {
          console.log(`${i+1}. ${log}`);
        }
      });
    } else {
      console.log("No significant logs found");
    }

    // Balance changes analysis
    console.log(`\n⚖️  SOL BALANCE CHANGES:`);
    if (tx.meta.preBalances && tx.meta.postBalances) {
      tx.meta.preBalances.forEach((preBalance, i) => {
        const postBalance = tx.meta.postBalances[i];
        const change = postBalance - preBalance;
        
        if (change !== 0) {
          const account = accounts[i];
          const addr = typeof account === 'string' ? account : account.pubkey.toBase58();
          const changeSOL = change / 1000000000;
          const direction = change > 0 ? '+' : '';
          
          console.log(`   ${addr.slice(0,8)}...${addr.slice(-4)}: ${direction}${changeSOL.toFixed(9)} SOL`);
          
          if (addr === "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS") {
            console.log("   🐋 WHALE SOL BALANCE CHANGE!");
          }
        }
      });
    }

    // Final analysis
    console.log(`\n🕵️  ANALYSIS SUMMARY:`);
    let suspiciousActivity = [];
    
    // Check for gambling programs
    const hasGamblingProgram = tx.transaction.message.instructions.some(ix => 
      'programId' in ix && ix.programId.toBase58() === "Dj8H1jRSDM9z2C8KmgBJ4FVWhnBkpffqq9Wz9Wg33uSh"
    );
    
    if (hasGamblingProgram) {
      suspiciousActivity.push("🚨 Gambling program interaction detected");
    }

    // Check for whale involvement
    const whaleInvolved = accounts.some(account => {
      const addr = typeof account === 'string' ? account : account.pubkey.toBase58();
      return addr === "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS";
    });
    
    if (whaleInvolved) {
      suspiciousActivity.push("🐋 Whale address directly involved");
    }

    if (suspiciousActivity.length > 0) {
      console.log("SUSPICIOUS ACTIVITY:");
      suspiciousActivity.forEach(activity => console.log(`  ${activity}`));
    } else {
      console.log("No obviously suspicious activity detected");
    }

  } catch (error) {
    console.error("Investigation failed:", error.message);
  }
})();