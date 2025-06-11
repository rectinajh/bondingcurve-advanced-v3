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

describe("Swap", () => {
  let ctx: TestContext;
  let tokenMintA: Keypair;
  let tokenMintB: Keypair;
  let swapPool: PublicKey;

  before(async () => {
    ctx = await TestSetup.initialize();
    
    // Initialize config
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

    // Create tokens
    tokenMintA = Keypair.generate();
    tokenMintB = Keypair.generate();

    // Create Token A (AIW3)
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

    // Create Token B (AI Agent)
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

    // Create swap pool
    swapPool = PublicKey.findProgramAddressSync(
      [
        Buffer.from("swap_pool"),
        tokenMintA.publicKey.toBuffer(),
        tokenMintB.publicKey.toBuffer(),
      ],
      ctx.program.programId
    )[0];

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
        creatorTokenAccountB: creatorAtaB,
        creator: ctx.user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ctx.user1])
      .rpc();
  });

  describe("Success Cases", () => {
    it("Should swap Token A for Token B successfully", async () => {
      const swapAmount = new BN(1000).mul(new BN(10).pow(new BN(TOKEN_DECIMALS))); // 1000 tokens
      const minAmountOut = new BN(900).mul(new BN(10).pow(new BN(TOKEN_DECIMALS))); // 900 tokens minimum

      // Create token accounts for user
      const userTokenAccountA = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintA.publicKey,
        ctx.user1.publicKey
      );

      const userTokenAccountB = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintB.publicKey,
        ctx.user1.publicKey
      );

      // Transfer some tokens to user for swapping
      const userAtaA = await getAssociatedTokenAddress(
        tokenMintA.publicKey,
        ctx.user1.publicKey
      );

      // Get initial balances
      const initialBalanceA = await TestSetup.getTokenBalance(ctx.connection, userAtaA);
      const initialBalanceB = await TestSetup.getTokenBalance(ctx.connection, userTokenAccountB);

      // Get pool token accounts
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

      // Perform swap
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
          userTokenAccountA: userAtaA,
          userTokenAccountB: userTokenAccountB,
          poolTokenAccountA,
          poolTokenAccountB,
          feeRecipientTokenAccount: await getAssociatedTokenAddress(
            tokenMintB.publicKey,
            ctx.admin.publicKey
          ),
          user: ctx.user1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([ctx.user1])
        .rpc();

      // Verify balances changed correctly
      const finalBalanceA = await TestSetup.getTokenBalance(ctx.connection, userAtaA);
      const finalBalanceB = await TestSetup.getTokenBalance(ctx.connection, userTokenAccountB);

      // User should have less Token A
      TestSetup.expectBNEqual(finalBalanceA, initialBalanceA.sub(swapAmount));
      
      // User should have more Token B (accounting for fees)
      expect(finalBalanceB.gt(initialBalanceB)).to.be.true;
      expect(finalBalanceB.gte(initialBalanceB.add(minAmountOut))).to.be.true;
    });

    it("Should swap Token B for Token A successfully", async () => {
      const swapAmount = new BN(500).mul(new BN(10).pow(new BN(TOKEN_DECIMALS))); // 500 tokens
      const minAmountOut = new BN(450).mul(new BN(10).pow(new BN(TOKEN_DECIMALS))); // 450 tokens minimum

      // Create token accounts for user2
      const userTokenAccountA = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintA.publicKey,
        ctx.user2.publicKey
      );

      const userTokenAccountB = await getAssociatedTokenAddress(
        tokenMintB.publicKey,
        ctx.user2.publicKey
      );

      // Get initial balances
      const initialBalanceA = await TestSetup.getTokenBalance(ctx.connection, userTokenAccountA);
      const initialBalanceB = await TestSetup.getTokenBalance(ctx.connection, userTokenAccountB);

      // Get pool token accounts
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

      // Perform swap
      await ctx.program.methods
        .swap({
          amountIn: swapAmount,
          minAmountOut,
          direction: { bToA: {} },
        })
        .accounts({
          config: ctx.config,
          swapPool,
          tokenMintA: tokenMintA.publicKey,
          tokenMintB: tokenMintB.publicKey,
          userTokenAccountA,
          userTokenAccountB,
          poolTokenAccountA,
          poolTokenAccountB,
          feeRecipientTokenAccount: await getAssociatedTokenAddress(
            tokenMintA.publicKey,
            ctx.admin.publicKey
          ),
          user: ctx.user2.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([ctx.user2])
        .rpc();

      // Verify balances changed correctly
      const finalBalanceA = await TestSetup.getTokenBalance(ctx.connection, userTokenAccountA);
      const finalBalanceB = await TestSetup.getTokenBalance(ctx.connection, userTokenAccountB);

      // User should have less Token B
      TestSetup.expectBNEqual(finalBalanceB, initialBalanceB.sub(swapAmount));
      
      // User should have more Token A (accounting for fees)
      expect(finalBalanceA.gt(initialBalanceA)).to.be.true;
      expect(finalBalanceA.gte(initialBalanceA.add(minAmountOut))).to.be.true;
    });
  });

  describe("Error Cases", () => {
    it("Should fail with insufficient balance", async () => {
      const swapAmount = new BN(1000000).mul(new BN(10).pow(new BN(TOKEN_DECIMALS))); // Very large amount
      const minAmountOut = new BN(1);

      const userTokenAccountA = await getAssociatedTokenAddress(
        tokenMintA.publicKey,
        ctx.user1.publicKey
      );

      const userTokenAccountB = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintB.publicKey,
        ctx.user1.publicKey
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

      try {
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
            userTokenAccountA,
            userTokenAccountB,
            poolTokenAccountA,
            poolTokenAccountB,
            feeRecipientTokenAccount: await getAssociatedTokenAddress(
              tokenMintB.publicKey,
              ctx.admin.publicKey
            ),
            user: ctx.user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InsufficientBalance");
      }
    });

    it("Should fail with slippage protection", async () => {
      const swapAmount = new BN(100).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));
      const minAmountOut = new BN(1000000).mul(new BN(10).pow(new BN(TOKEN_DECIMALS))); // Unrealistically high

      const userTokenAccountA = await getAssociatedTokenAddress(
        tokenMintA.publicKey,
        ctx.user1.publicKey
      );

      const userTokenAccountB = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintB.publicKey,
        ctx.user1.publicKey
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

      try {
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
            userTokenAccountA,
            userTokenAccountB,
            poolTokenAccountA,
            poolTokenAccountB,
            feeRecipientTokenAccount: await getAssociatedTokenAddress(
              tokenMintB.publicKey,
              ctx.admin.publicKey
            ),
            user: ctx.user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("SlippageExceeded");
      }
    });

    it("Should fail with zero amount", async () => {
      const swapAmount = new BN(0); // Zero amount
      const minAmountOut = new BN(1);

      const userTokenAccountA = await getAssociatedTokenAddress(
        tokenMintA.publicKey,
        ctx.user1.publicKey
      );

      const userTokenAccountB = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintB.publicKey,
        ctx.user1.publicKey
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

      try {
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
            userTokenAccountA,
            userTokenAccountB,
            poolTokenAccountA,
            poolTokenAccountB,
            feeRecipientTokenAccount: await getAssociatedTokenAddress(
              tokenMintB.publicKey,
              ctx.admin.publicKey
            ),
            user: ctx.user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("Should fail when pool is paused", async () => {
      // First pause the pool (admin only)
      await ctx.program.methods
        .updateConfig({
          admin: null,
          feeRecipient: null,
          swapFeeBasisPoints: null,
          createTokenFeeBasisPoints: null,
          createPoolFeeLamports: null,
          paused: true,
        })
        .accounts({
          config: ctx.config,
          admin: ctx.admin.publicKey,
        })
        .signers([ctx.admin])
        .rpc();

      const swapAmount = new BN(100).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));
      const minAmountOut = new BN(90).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));

      const userTokenAccountA = await getAssociatedTokenAddress(
        tokenMintA.publicKey,
        ctx.user1.publicKey
      );

      const userTokenAccountB = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintB.publicKey,
        ctx.user1.publicKey
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

      try {
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
            userTokenAccountA,
            userTokenAccountB,
            poolTokenAccountA,
            poolTokenAccountB,
            feeRecipientTokenAccount: await getAssociatedTokenAddress(
              tokenMintB.publicKey,
              ctx.admin.publicKey
            ),
            user: ctx.user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.user1])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("SystemPaused");
      }

      // Unpause for other tests
      await ctx.program.methods
        .updateConfig({
          admin: null,
          feeRecipient: null,
          swapFeeBasisPoints: null,
          createTokenFeeBasisPoints: null,
          createPoolFeeLamports: null,
          paused: false,
        })
        .accounts({
          config: ctx.config,
          admin: ctx.admin.publicKey,
        })
        .signers([ctx.admin])
        .rpc();
    });
  });

  describe("Fee Calculation", () => {
    it("Should correctly calculate and collect swap fees", async () => {
      const swapAmount = new BN(1000).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));
      const expectedFee = swapAmount.mul(new BN(SWAP_FEE_BASIS_POINTS)).div(new BN(10000));
      const amountAfterFee = swapAmount.sub(expectedFee);
      
      // Get fee recipient initial balance
      const feeRecipientAccount = await getAssociatedTokenAddress(
        tokenMintB.publicKey,
        ctx.admin.publicKey
      );

      let initialFeeBalance = new BN(0);
      try {
        initialFeeBalance = await TestSetup.getTokenBalance(ctx.connection, feeRecipientAccount);
      } catch (error) {
        // Account might not exist yet
        await TestSetup.createAssociatedTokenAccount(
          ctx.connection,
          ctx.payer,
          tokenMintB.publicKey,
          ctx.admin.publicKey
        );
      }

      const userTokenAccountA = await getAssociatedTokenAddress(
        tokenMintA.publicKey,
        ctx.user1.publicKey
      );

      const userTokenAccountB = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintB.publicKey,
        ctx.user1.publicKey
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

      // Perform swap
      await ctx.program.methods
        .swap({
          amountIn: swapAmount,
          minAmountOut: new BN(1), // Very low to avoid slippage issues
          direction: { aToB: {} },
        })
        .accounts({
          config: ctx.config,
          swapPool,
          tokenMintA: tokenMintA.publicKey,
          tokenMintB: tokenMintB.publicKey,
          userTokenAccountA,
          userTokenAccountB,
          poolTokenAccountA,
          poolTokenAccountB,
          feeRecipientTokenAccount: feeRecipientAccount,
          user: ctx.user1.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([ctx.user1])
        .rpc();

      // Verify fee was collected
      const finalFeeBalance = await TestSetup.getTokenBalance(ctx.connection, feeRecipientAccount);
      expect(finalFeeBalance.gt(initialFeeBalance)).to.be.true;
    });
  });

  describe("Edge Cases", () => {
    it("Should handle very small swap amounts", async () => {
      const swapAmount = new BN(1); // 1 wei
      const minAmountOut = new BN(0);

      const userTokenAccountA = await getAssociatedTokenAddress(
        tokenMintA.publicKey,
        ctx.user1.publicKey
      );

      const userTokenAccountB = await TestSetup.createAssociatedTokenAccount(
        ctx.connection,
        ctx.payer,
        tokenMintB.publicKey,
        ctx.user1.publicKey
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

      // This should work or fail gracefully
      try {
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
            userTokenAccountA,
            userTokenAccountB,
            poolTokenAccountA,
            poolTokenAccountB,
            feeRecipientTokenAccount: await getAssociatedTokenAddress(
              tokenMintB.publicKey,
              ctx.admin.publicKey
            ),
            user: ctx.user1.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([ctx.user1])
          .rpc();
      } catch (error) {
        // Small amounts might be rejected due to minimum thresholds
        expect(error.message).to.include("InvalidAmount");
      }
    });
  });
}); 