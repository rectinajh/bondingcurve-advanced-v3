import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Pump } from "../../target/types/pump";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";
import { TestSetup, TestContext, TOKEN_DECIMALS, INITIAL_SUPPLY } from "../utils/test-setup";

describe("Create Token", () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await TestSetup.initialize();
    
    // Initialize config first
    const params = {
      admin: ctx.admin.publicKey,
      feeRecipient: ctx.admin.publicKey,
      swapFeeBasisPoints: 30,
      createTokenFeeBasisPoints: 100,
      createPoolFeeLamports: new BN(1000000),
    };

    await ctx.program.methods
      .initialize(params)
      .accounts({
        config: ctx.config,
        admin: ctx.admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc();
  });

  describe("Success Cases", () => {
    it("Should create AIW3 token successfully", async () => {
      const tokenMint = Keypair.generate();
      const creator = ctx.user1;
      
      const [tokenInfo] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_info"), tokenMint.publicKey.toBuffer()],
        ctx.program.programId
      );

      const creatorAta = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        creator.publicKey
      );

      const params = {
        name: "AIW3 Token",
        symbol: "AIW3",
        uri: "https://example.com/aiw3.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 100, // 1%
        maxFee: new BN(1000000), // 1 token max fee
        tokenType: { aiw3: {} },
      };

      await ctx.program.methods
        .createToken(params)
        .accounts({
          config: ctx.config,
          tokenMint: tokenMint.publicKey,
          tokenInfo,
          creator: creator.publicKey,
          creatorTokenAccount: creatorAta,
          feeRecipient: ctx.admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator, tokenMint])
        .rpc();

      // Verify token info was created correctly
      const tokenInfoAccount = await ctx.program.account.tokenInfo.fetch(tokenInfo);
      
      expect(tokenInfoAccount.name).to.equal("AIW3 Token");
      expect(tokenInfoAccount.symbol).to.equal("AIW3");
      expect(tokenInfoAccount.uri).to.equal("https://example.com/aiw3.json");
      expect(tokenInfoAccount.decimals).to.equal(TOKEN_DECIMALS);
      expect(tokenInfoAccount.creator.toString()).to.equal(creator.publicKey.toString());
      TestSetup.expectBNEqual(tokenInfoAccount.initialSupply, INITIAL_SUPPLY);
      expect(tokenInfoAccount.transferFeeBasisPoints).to.equal(100);
      TestSetup.expectBNEqual(tokenInfoAccount.maxFee, new BN(1000000));

      // Verify creator received initial supply
      const creatorBalance = await TestSetup.getTokenBalance(ctx.connection, creatorAta);
      TestSetup.expectBNEqual(creatorBalance, INITIAL_SUPPLY);
    });

    it("Should create AI Agent token successfully", async () => {
      const tokenMint = Keypair.generate();
      const creator = ctx.user2;
      
      const [tokenInfo] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_info"), tokenMint.publicKey.toBuffer()],
        ctx.program.programId
      );

      const creatorAta = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        creator.publicKey
      );

      const params = {
        name: "AI Agent Token",
        symbol: "AIA",
        uri: "https://example.com/aia.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 50, // 0.5%
        maxFee: new BN(500000), // 0.5 token max fee
        tokenType: { aiAgent: {} },
      };

      await ctx.program.methods
        .createToken(params)
        .accounts({
          config: ctx.config,
          tokenMint: tokenMint.publicKey,
          tokenInfo,
          creator: creator.publicKey,
          creatorTokenAccount: creatorAta,
          feeRecipient: ctx.admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator, tokenMint])
        .rpc();

      // Verify token info was created correctly
      const tokenInfoAccount = await ctx.program.account.tokenInfo.fetch(tokenInfo);
      
      expect(tokenInfoAccount.name).to.equal("AI Agent Token");
      expect(tokenInfoAccount.symbol).to.equal("AIA");
      expect(tokenInfoAccount.transferFeeBasisPoints).to.equal(50);
      TestSetup.expectBNEqual(tokenInfoAccount.maxFee, new BN(500000));
    });
  });

  describe("Error Cases", () => {
    it("Should fail with invalid token name (too long)", async () => {
      const tokenMint = Keypair.generate();
      const creator = ctx.user1;
      
      const [tokenInfo] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_info"), tokenMint.publicKey.toBuffer()],
        ctx.program.programId
      );

      const creatorAta = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        creator.publicKey
      );

      const params = {
        name: "This is a very long token name that exceeds the maximum allowed length for token names", // Too long
        symbol: "AIW3",
        uri: "https://example.com/aiw3.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 100,
        maxFee: new BN(1000000),
        tokenType: { aiw3: {} },
      };

      try {
        await ctx.program.methods
          .createToken(params)
          .accounts({
            config: ctx.config,
            tokenMint: tokenMint.publicKey,
            tokenInfo,
            creator: creator.publicKey,
            creatorTokenAccount: creatorAta,
            feeRecipient: ctx.admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([creator, tokenMint])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidTokenName");
      }
    });

    it("Should fail with invalid decimals", async () => {
      const tokenMint = Keypair.generate();
      const creator = ctx.user1;
      
      const [tokenInfo] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_info"), tokenMint.publicKey.toBuffer()],
        ctx.program.programId
      );

      const creatorAta = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        creator.publicKey
      );

      const params = {
        name: "Test Token",
        symbol: "TEST",
        uri: "https://example.com/test.json",
        decimals: 255, // Invalid: too high
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 100,
        maxFee: new BN(1000000),
        tokenType: { aiw3: {} },
      };

      try {
        await ctx.program.methods
          .createToken(params)
          .accounts({
            config: ctx.config,
            tokenMint: tokenMint.publicKey,
            tokenInfo,
            creator: creator.publicKey,
            creatorTokenAccount: creatorAta,
            feeRecipient: ctx.admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([creator, tokenMint])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidDecimals");
      }
    });

    it("Should fail with zero initial supply", async () => {
      const tokenMint = Keypair.generate();
      const creator = ctx.user1;
      
      const [tokenInfo] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_info"), tokenMint.publicKey.toBuffer()],
        ctx.program.programId
      );

      const creatorAta = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        creator.publicKey
      );

      const params = {
        name: "Test Token",
        symbol: "TEST",
        uri: "https://example.com/test.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: new BN(0), // Invalid: zero supply
        transferFeeBasisPoints: 100,
        maxFee: new BN(1000000),
        tokenType: { aiw3: {} },
      };

      try {
        await ctx.program.methods
          .createToken(params)
          .accounts({
            config: ctx.config,
            tokenMint: tokenMint.publicKey,
            tokenInfo,
            creator: creator.publicKey,
            creatorTokenAccount: creatorAta,
            feeRecipient: ctx.admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([creator, tokenMint])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidInitialSupply");
      }
    });

    it("Should fail with invalid transfer fee basis points", async () => {
      const tokenMint = Keypair.generate();
      const creator = ctx.user1;
      
      const [tokenInfo] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_info"), tokenMint.publicKey.toBuffer()],
        ctx.program.programId
      );

      const creatorAta = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        creator.publicKey
      );

      const params = {
        name: "Test Token",
        symbol: "TEST",
        uri: "https://example.com/test.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 10001, // Invalid: > 10000
        maxFee: new BN(1000000),
        tokenType: { aiw3: {} },
      };

      try {
        await ctx.program.methods
          .createToken(params)
          .accounts({
            config: ctx.config,
            tokenMint: tokenMint.publicKey,
            tokenInfo,
            creator: creator.publicKey,
            creatorTokenAccount: creatorAta,
            feeRecipient: ctx.admin.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([creator, tokenMint])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidFeeBasisPoints");
      }
    });
  });

  describe("Edge Cases", () => {
    it("Should create token with maximum supply", async () => {
      const tokenMint = Keypair.generate();
      const creator = ctx.user1;
      
      const [tokenInfo] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_info"), tokenMint.publicKey.toBuffer()],
        ctx.program.programId
      );

      const creatorAta = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        creator.publicKey
      );

      // Maximum supply for u64
      const maxSupply = new BN("18446744073709551615"); // 2^64 - 1

      const params = {
        name: "Max Supply Token",
        symbol: "MAX",
        uri: "https://example.com/max.json",
        decimals: 0, // Use 0 decimals to avoid overflow
        initialSupply: maxSupply,
        transferFeeBasisPoints: 0,
        maxFee: new BN(0),
        tokenType: { aiw3: {} },
      };

      await ctx.program.methods
        .createToken(params)
        .accounts({
          config: ctx.config,
          tokenMint: tokenMint.publicKey,
          tokenInfo,
          creator: creator.publicKey,
          creatorTokenAccount: creatorAta,
          feeRecipient: ctx.admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator, tokenMint])
        .rpc();

      const tokenInfoAccount = await ctx.program.account.tokenInfo.fetch(tokenInfo);
      TestSetup.expectBNEqual(tokenInfoAccount.initialSupply, maxSupply);
    });

    it("Should create token with zero transfer fee", async () => {
      const tokenMint = Keypair.generate();
      const creator = ctx.user1;
      
      const [tokenInfo] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_info"), tokenMint.publicKey.toBuffer()],
        ctx.program.programId
      );

      const creatorAta = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        creator.publicKey
      );

      const params = {
        name: "Zero Fee Token",
        symbol: "ZERO",
        uri: "https://example.com/zero.json",
        decimals: TOKEN_DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        transferFeeBasisPoints: 0, // No transfer fee
        maxFee: new BN(0),
        tokenType: { aiAgent: {} },
      };

      await ctx.program.methods
        .createToken(params)
        .accounts({
          config: ctx.config,
          tokenMint: tokenMint.publicKey,
          tokenInfo,
          creator: creator.publicKey,
          creatorTokenAccount: creatorAta,
          feeRecipient: ctx.admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator, tokenMint])
        .rpc();

      const tokenInfoAccount = await ctx.program.account.tokenInfo.fetch(tokenInfo);
      expect(tokenInfoAccount.transferFeeBasisPoints).to.equal(0);
      TestSetup.expectBNEqual(tokenInfoAccount.maxFee, new BN(0));
    });
  });
}); 