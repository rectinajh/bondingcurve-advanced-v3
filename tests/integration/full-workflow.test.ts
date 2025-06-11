import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Pump } from "../../target/types/pump";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";
import { 
  TestSetup, 
  TestContext, 
  TOKEN_DECIMALS, 
  INITIAL_SUPPLY, 
  INITIAL_LIQUIDITY,
  SWAP_FEE_BASIS_POINTS 
} from "../utils/test-setup";

describe("Full Workflow Integration", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await TestSetup.initialize();
  });

  it("Should complete full workflow: initialize -> create tokens -> create pool -> swap", async () => {
    // Step 1: Initialize system configuration
    console.log("Step 1: Initializing system configuration...");
    
    const configParams = {
      admin: ctx.admin.publicKey,
      feeRecipient: ctx.admin.publicKey,
      swapFeeBasisPoints: SWAP_FEE_BASIS_POINTS,
      createTokenFeeBasisPoints: 100,
      createPoolFeeLamports: new BN(1000000),
    };

    await ctx.program.methods
      .initialize(configParams)
      .accounts({
        config: ctx.config,
        admin: ctx.admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    // Verify config was created
    const configAccount = await ctx.program.account.config.fetch(ctx.config);
    expect(configAccount.admin.toString()).to.equal(ctx.admin.publicKey.toString());
    console.log("✓ System configuration initialized");

    // Step 2: Create Token A (AIW3)
    console.log("Step 2: Creating Token A (AIW3)...");
    
    const tokenMintA = Keypair.generate();
    const [tokenInfoA] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_info"), tokenMintA.publicKey.toBuffer()],
      ctx.program.programId
    );

    const creatorAtaA = await getAssociatedTokenAddress(
      tokenMintA.publicKey,
      ctx.user1.publicKey
    );

    await ctx.program.methods
      .createToken({
        name: "AIW3 Token",
        symbol: "AIW3",
        uri: "https://example.com/aiw3.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 100,
        maxFee: new BN(1000000),
        tokenType: { aiw3: {} },
      })
      .accounts({
        config: ctx.config,
        tokenMint: tokenMintA.publicKey,
        tokenInfo: tokenInfoA,
        creator: ctx.user1.publicKey,
        creatorTokenAccount: creatorAtaA,
        feeRecipient: ctx.admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.user1, tokenMintA])
      .rpc();

    // Verify Token A was created
    const tokenInfoAccountA = await ctx.program.account.tokenInfo.fetch(tokenInfoA);
    expect(tokenInfoAccountA.name).to.equal("AIW3 Token");
    expect(tokenInfoAccountA.symbol).to.equal("AIW3");
    
    const balanceA = await TestSetup.getTokenBalance(ctx.connection, creatorAtaA);
    TestSetup.expectBNEqual(balanceA, INITIAL_SUPPLY);
    console.log("✓ Token A (AIW3) created successfully");

    // Step 3: Create Token B (AI Agent)
    console.log("Step 3: Creating Token B (AI Agent)...");
    
    const tokenMintB = Keypair.generate();
    const [tokenInfoB] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_info"), tokenMintB.publicKey.toBuffer()],
      ctx.program.programId
    );

    const creatorAtaB = await getAssociatedTokenAddress(
      tokenMintB.publicKey,
      ctx.user2.publicKey
    );

    await ctx.program.methods
      .createToken({
        name: "AI Agent Token",
        symbol: "AIA",
        uri: "https://example.com/aia.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 50,
        maxFee: new BN(500000),
        tokenType: { aiAgent: {} },
      })
      .accounts({
        config: ctx.config,
        tokenMint: tokenMintB.publicKey,
        tokenInfo: tokenInfoB,
        creator: ctx.user2.publicKey,
        creatorTokenAccount: creatorAtaB,
        feeRecipient: ctx.admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.user2, tokenMintB])
      .rpc();

    // Verify Token B was created
    const tokenInfoAccountB = await ctx.program.account.tokenInfo.fetch(tokenInfoB);
    expect(tokenInfoAccountB.name).to.equal("AI Agent Token");
    expect(tokenInfoAccountB.symbol).to.equal("AIA");
    
    const balanceB = await TestSetup.getTokenBalance(ctx.connection, creatorAtaB);
    TestSetup.expectBNEqual(balanceB, INITIAL_SUPPLY);
    console.log("✓ Token B (AI Agent) created successfully");

    // Step 4: Create swap pool
    console.log("Step 4: Creating swap pool...");
    
    const [swapPool] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("swap_pool"),
        tokenMintA.publicKey.toBuffer(),
        tokenMintB.publicKey.toBuffer(),
      ],
      ctx.program.programId
    );

    const poolTokenAccountA = await getAssociatedTokenAddress(
      tokenMintA.publicKey,
      swapPool,
      true
    );

    const poolTokenAccountB = await getAssociatedTokenAddress(
      tokenMintB.publicKey,
      swapPool,
      true
    );

    // Transfer tokens between users for pool creation
    await TestSetup.mintTokens(
      ctx.connection,
      ctx.payer,
      tokenMintB.publicKey,
      creatorAtaA,
      INITIAL_LIQUIDITY.toNumber()
    );

    await ctx.program.methods
      .createPool({
        initialLiquidityA: INITIAL_LIQUIDITY,
        initialLiquidityB: INITIAL_LIQUIDITY,
        feeRecipient: ctx.admin.publicKey,
      })
      .accounts({
        config: ctx.config,
        swapPool,
        tokenMintA: tokenMintA.publicKey,
        tokenMintB: tokenMintB.publicKey,
        poolTokenAccountA,
        poolTokenAccountB,
        creatorTokenAccountA: creatorAtaA,
        creatorTokenAccountB: creatorAtaA, // User1 has both tokens now
        creator: ctx.user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.user1])
      .rpc();

    // Verify pool was created
    const swapPoolAccount = await ctx.program.account.swapPool.fetch(swapPool);
    expect(swapPoolAccount.tokenMintA.toString()).to.equal(tokenMintA.publicKey.toString());
    expect(swapPoolAccount.tokenMintB.toString()).to.equal(tokenMintB.publicKey.toString());
    TestSetup.expectBNEqual(swapPoolAccount.reserveA, INITIAL_LIQUIDITY);
    TestSetup.expectBNEqual(swapPoolAccount.reserveB, INITIAL_LIQUIDITY);
    console.log("✓ Swap pool created successfully");

    // Step 5: Perform token swap
    console.log("Step 5: Performing token swap...");
    
    const swapAmount = new BN(1000).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));
    const minAmountOut = new BN(900).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));

    // Create token accounts for swapper
    const swapperAtaA = await TestSetup.createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      tokenMintA.publicKey,
      ctx.user2.publicKey
    );

    const swapperAtaB = await getAssociatedTokenAddress(
      tokenMintB.publicKey,
      ctx.user2.publicKey
    );

    // Transfer some Token A to swapper
    await TestSetup.mintTokens(
      ctx.connection,
      ctx.payer,
      tokenMintA.publicKey,
      swapperAtaA,
      swapAmount.mul(new BN(2)).toNumber() // Give extra for multiple swaps
    );

    // Get initial balances
    const initialBalanceA = await TestSetup.getTokenBalance(ctx.connection, swapperAtaA);
    const initialBalanceB = await TestSetup.getTokenBalance(ctx.connection, swapperAtaB);

    // Create fee recipient account
    const feeRecipientAccount = await TestSetup.createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      tokenMintB.publicKey,
      ctx.admin.publicKey
    );

    // Perform swap: A -> B
    await ctx.program.methods
      .swap({
        amountIn: swapAmount,
        minAmountOut,
        direction: { aToB: {} },
      })
      .accounts({
        config: ctx.config,
        swapPool,
        tokenMintA: tokenMintA.publicKey,
        tokenMintB: tokenMintB.publicKey,
        userTokenAccountA: swapperAtaA,
        userTokenAccountB: swapperAtaB,
        poolTokenAccountA,
        poolTokenAccountB,
        feeRecipientTokenAccount: feeRecipientAccount,
        user: ctx.user2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.user2])
      .rpc();

    // Verify swap results
    const finalBalanceA = await TestSetup.getTokenBalance(ctx.connection, swapperAtaA);
    const finalBalanceB = await TestSetup.getTokenBalance(ctx.connection, swapperAtaB);

    // User should have less Token A and more Token B
    expect(finalBalanceA.lt(initialBalanceA)).to.be.true;
    expect(finalBalanceB.gt(initialBalanceB)).to.be.true;
    TestSetup.expectBNEqual(finalBalanceA, initialBalanceA.sub(swapAmount));

    console.log("✓ Token swap completed successfully");
    console.log(`   - Swapped: ${swapAmount.toString()} Token A`);
    console.log(`   - Received: ${finalBalanceB.sub(initialBalanceB).toString()} Token B`);

    // Step 6: Perform reverse swap
    console.log("Step 6: Performing reverse swap...");
    
    const reverseSwapAmount = new BN(500).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));
    const reverseMinAmountOut = new BN(450).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));

    const beforeReverseBalanceA = await TestSetup.getTokenBalance(ctx.connection, swapperAtaA);
    const beforeReverseBalanceB = await TestSetup.getTokenBalance(ctx.connection, swapperAtaB);

    // Create fee recipient account for Token A
    const feeRecipientAccountA = await TestSetup.createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      tokenMintA.publicKey,
      ctx.admin.publicKey
    );

    // Perform reverse swap: B -> A
    await ctx.program.methods
      .swap({
        amountIn: reverseSwapAmount,
        minAmountOut: reverseMinAmountOut,
        direction: { bToA: {} },
      })
      .accounts({
        config: ctx.config,
        swapPool,
        tokenMintA: tokenMintA.publicKey,
        tokenMintB: tokenMintB.publicKey,
        userTokenAccountA: swapperAtaA,
        userTokenAccountB: swapperAtaB,
        poolTokenAccountA,
        poolTokenAccountB,
        feeRecipientTokenAccount: feeRecipientAccountA,
        user: ctx.user2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.user2])
      .rpc();

    // Verify reverse swap results
    const afterReverseBalanceA = await TestSetup.getTokenBalance(ctx.connection, swapperAtaA);
    const afterReverseBalanceB = await TestSetup.getTokenBalance(ctx.connection, swapperAtaB);

    // User should have more Token A and less Token B
    expect(afterReverseBalanceA.gt(beforeReverseBalanceA)).to.be.true;
    expect(afterReverseBalanceB.lt(beforeReverseBalanceB)).to.be.true;
    TestSetup.expectBNEqual(afterReverseBalanceB, beforeReverseBalanceB.sub(reverseSwapAmount));

    console.log("✓ Reverse swap completed successfully");
    console.log(`   - Swapped: ${reverseSwapAmount.toString()} Token B`);
    console.log(`   - Received: ${afterReverseBalanceA.sub(beforeReverseBalanceA).toString()} Token A`);

    // Step 7: Verify final pool state
    console.log("Step 7: Verifying final pool state...");
    
    const finalPoolState = await ctx.program.account.swapPool.fetch(swapPool);
    console.log(`   - Final Reserve A: ${finalPoolState.reserveA.toString()}`);
    console.log(`   - Final Reserve B: ${finalPoolState.reserveB.toString()}`);
    console.log(`   - Total Volume A: ${finalPoolState.totalVolumeA.toString()}`);
    console.log(`   - Total Volume B: ${finalPoolState.totalVolumeB.toString()}`);
    console.log(`   - Total Fees A: ${finalPoolState.totalFeesA.toString()}`);
    console.log(`   - Total Fees B: ${finalPoolState.totalFeesB.toString()}`);

    // Verify volume tracking
    expect(finalPoolState.totalVolumeA.gt(new BN(0))).to.be.true;
    expect(finalPoolState.totalVolumeB.gt(new BN(0))).to.be.true;
    expect(finalPoolState.totalFeesA.gt(new BN(0))).to.be.true;
    expect(finalPoolState.totalFeesB.gt(new BN(0))).to.be.true;

    console.log("✓ Full workflow completed successfully!");
  });

  it("Should handle multiple users and concurrent operations", async () => {
    // Initialize system
    const configParams = {
      admin: ctx.admin.publicKey,
      feeRecipient: ctx.admin.publicKey,
      swapFeeBasisPoints: SWAP_FEE_BASIS_POINTS,
      createTokenFeeBasisPoints: 100,
      createPoolFeeLamports: new BN(1000000),
    };

    await ctx.program.methods
      .initialize(configParams)
      .accounts({
        config: ctx.config,
        admin: ctx.admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();

    // Create additional users
    const user3 = Keypair.generate();
    const user4 = Keypair.generate();
    await TestSetup.fundAccount(ctx.connection, ctx.payer, user3.publicKey, 5);
    await TestSetup.fundAccount(ctx.connection, ctx.payer, user4.publicKey, 5);

    // Create tokens
    const tokenMintA = Keypair.generate();
    const tokenMintB = Keypair.generate();

    // User1 creates Token A
    const [tokenInfoA] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_info"), tokenMintA.publicKey.toBuffer()],
      ctx.program.programId
    );

    await ctx.program.methods
      .createToken({
        name: "Multi Token A",
        symbol: "MTA",
        uri: "https://example.com/mta.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 100,
        maxFee: new BN(1000000),
        tokenType: { aiw3: {} },
      })
      .accounts({
        config: ctx.config,
        tokenMint: tokenMintA.publicKey,
        tokenInfo: tokenInfoA,
        creator: ctx.user1.publicKey,
        creatorTokenAccount: await getAssociatedTokenAddress(tokenMintA.publicKey, ctx.user1.publicKey),
        feeRecipient: ctx.admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.user1, tokenMintA])
      .rpc();

    // User2 creates Token B
    const [tokenInfoB] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_info"), tokenMintB.publicKey.toBuffer()],
      ctx.program.programId
    );

    await ctx.program.methods
      .createToken({
        name: "Multi Token B",
        symbol: "MTB",
        uri: "https://example.com/mtb.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 50,
        maxFee: new BN(500000),
        tokenType: { aiAgent: {} },
      })
      .accounts({
        config: ctx.config,
        tokenMint: tokenMintB.publicKey,
        tokenInfo: tokenInfoB,
        creator: ctx.user2.publicKey,
        creatorTokenAccount: await getAssociatedTokenAddress(tokenMintB.publicKey, ctx.user2.publicKey),
        feeRecipient: ctx.admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.user2, tokenMintB])
      .rpc();

    // Create pool
    const [swapPool] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("swap_pool"),
        tokenMintA.publicKey.toBuffer(),
        tokenMintB.publicKey.toBuffer(),
      ],
      ctx.program.programId
    );

    // Setup liquidity provision
    const user1AtaA = await getAssociatedTokenAddress(tokenMintA.publicKey, ctx.user1.publicKey);
    const user1AtaB = await TestSetup.createAssociatedTokenAccount(
      ctx.connection,
      ctx.payer,
      tokenMintB.publicKey,
      ctx.user1.publicKey
    );

    await TestSetup.mintTokens(
      ctx.connection,
      ctx.payer,
      tokenMintB.publicKey,
      user1AtaB,
      INITIAL_LIQUIDITY.toNumber()
    );

    await ctx.program.methods
      .createPool({
        initialLiquidityA: INITIAL_LIQUIDITY,
        initialLiquidityB: INITIAL_LIQUIDITY,
        feeRecipient: ctx.admin.publicKey,
      })
      .accounts({
        config: ctx.config,
        swapPool,
        tokenMintA: tokenMintA.publicKey,
        tokenMintB: tokenMintB.publicKey,
        poolTokenAccountA: await getAssociatedTokenAddress(tokenMintA.publicKey, swapPool, true),
        poolTokenAccountB: await getAssociatedTokenAddress(tokenMintB.publicKey, swapPool, true),
        creatorTokenAccountA: user1AtaA,
        creatorTokenAccountB: user1AtaB,
        creator: ctx.user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.user1])
      .rpc();

    // Distribute tokens to users for trading
    const users = [ctx.user2, user3, user4];
    const swapAmount = new BN(100).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));

    for (const user of users) {
      const userAtaA = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintA.publicKey,
        user.publicKey
      );
      
      const userAtaB = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintB.publicKey,
        user.publicKey
      );

      await TestSetup.mintTokens(
        ctx.connection,
        ctx.payer,
        tokenMintA.publicKey,
        userAtaA,
        swapAmount.mul(new BN(5)).toNumber()
      );

      await TestSetup.mintTokens(
        ctx.connection,
        ctx.payer,
        tokenMintB.publicKey,
        userAtaB,
        swapAmount.mul(new BN(5)).toNumber()
      );
    }

    // Perform multiple swaps concurrently
    const swapPromises = users.map(async (user, index) => {
      const direction = index % 2 === 0 ? { aToB: {} } : { bToA: {} };
      const userAtaA = await getAssociatedTokenAddress(tokenMintA.publicKey, user.publicKey);
      const userAtaB = await getAssociatedTokenAddress(tokenMintB.publicKey, user.publicKey);
      
      const feeRecipientToken = index % 2 === 0 ? tokenMintB.publicKey : tokenMintA.publicKey;
      const feeRecipientAccount = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        feeRecipientToken,
        ctx.admin.publicKey
      );

      return ctx.program.methods
        .swap({
          amountIn: swapAmount,
          minAmountOut: swapAmount.mul(new BN(8)).div(new BN(10)), // 80% minimum
          direction,
        })
        .accounts({
          config: ctx.config,
          swapPool,
          tokenMintA: tokenMintA.publicKey,
          tokenMintB: tokenMintB.publicKey,
          userTokenAccountA: userAtaA,
          userTokenAccountB: userAtaB,
          poolTokenAccountA: await getAssociatedTokenAddress(tokenMintA.publicKey, swapPool, true),
          poolTokenAccountB: await getAssociatedTokenAddress(tokenMintB.publicKey, swapPool, true),
          feeRecipientTokenAccount: feeRecipientAccount,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
    });

    // Wait for all swaps to complete
    await Promise.all(swapPromises);

    // Verify pool state after multiple trades
    const finalPoolState = await ctx.program.account.swapPool.fetch(swapPool);
    expect(finalPoolState.totalVolumeA.gt(new BN(0))).to.be.true;
    expect(finalPoolState.totalVolumeB.gt(new BN(0))).to.be.true;
    expect(finalPoolState.totalFeesA.gt(new BN(0))).to.be.true;
    expect(finalPoolState.totalFeesB.gt(new BN(0))).to.be.true;

    console.log("✓ Multiple user concurrent operations completed successfully");
  });
}); 