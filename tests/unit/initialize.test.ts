import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Pump } from "../../target/types/pump";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";
import { TestSetup, TestContext } from "../utils/test-setup";

describe("Initialize", () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await TestSetup.initialize();
  });

  describe("Success Cases", () => {
    it("Should initialize config successfully", async () => {
      const params = {
        admin: ctx.admin.publicKey,
        feeRecipient: ctx.admin.publicKey,
        swapFeeBasisPoints: 30, // 0.3%
        createTokenFeeBasisPoints: 100, // 1%
        createPoolFeeLamports: new BN(1000000), // 0.001 SOL
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

      // Verify config was created correctly
      const configAccount = await ctx.program.account.config.fetch(ctx.config);
      
      expect(configAccount.admin.toString()).to.equal(ctx.admin.publicKey.toString());
      expect(configAccount.feeRecipient.toString()).to.equal(ctx.admin.publicKey.toString());
      expect(configAccount.swapFeeBasisPoints).to.equal(30);
      expect(configAccount.createTokenFeeBasisPoints).to.equal(100);
      TestSetup.expectBNEqual(configAccount.createPoolFeeLamports, new BN(1000000));
    });
  });

  describe("Error Cases", () => {
    it("Should fail when initializing config twice", async () => {
      const params = {
        admin: ctx.admin.publicKey,
        feeRecipient: ctx.admin.publicKey,
        swapFeeBasisPoints: 30,
        createTokenFeeBasisPoints: 100,
        createPoolFeeLamports: new BN(1000000),
      };

      try {
        await ctx.program.methods
          .initialize(params)
          .accounts({
            config: ctx.config,
            admin: ctx.admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([ctx.admin])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("already in use");
      }
    });

    it("Should fail with invalid fee basis points", async () => {
      const newAdmin = Keypair.generate();
      await TestSetup.fundAccount(ctx.connection, ctx.payer, newAdmin.publicKey, 1);

      const [newConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), newAdmin.publicKey.toBuffer()],
        ctx.program.programId
      );

      const params = {
        admin: newAdmin.publicKey,
        feeRecipient: newAdmin.publicKey,
        swapFeeBasisPoints: 10001, // Invalid: > 10000
        createTokenFeeBasisPoints: 100,
        createPoolFeeLamports: new BN(1000000),
      };

      try {
        await ctx.program.methods
          .initialize(params)
          .accounts({
            config: newConfig,
            admin: newAdmin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([newAdmin])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidFeeBasisPoints");
      }
    });

    it("Should fail with zero admin address", async () => {
      const newAdmin = Keypair.generate();
      await TestSetup.fundAccount(ctx.connection, ctx.payer, newAdmin.publicKey, 1);

      const [newConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), newAdmin.publicKey.toBuffer()],
        ctx.program.programId
      );

      const params = {
        admin: PublicKey.default, // Invalid: zero address
        feeRecipient: newAdmin.publicKey,
        swapFeeBasisPoints: 30,
        createTokenFeeBasisPoints: 100,
        createPoolFeeLamports: new BN(1000000),
      };

      try {
        await ctx.program.methods
          .initialize(params)
          .accounts({
            config: newConfig,
            admin: newAdmin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([newAdmin])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidAdmin");
      }
    });
  });

  describe("Edge Cases", () => {
    it("Should initialize with maximum valid fee basis points", async () => {
      const newAdmin = Keypair.generate();
      await TestSetup.fundAccount(ctx.connection, ctx.payer, newAdmin.publicKey, 1);

      const [newConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), newAdmin.publicKey.toBuffer()],
        ctx.program.programId
      );

      const params = {
        admin: newAdmin.publicKey,
        feeRecipient: newAdmin.publicKey,
        swapFeeBasisPoints: 10000, // 100% - maximum valid
        createTokenFeeBasisPoints: 10000, // 100% - maximum valid
        createPoolFeeLamports: new BN(1000000),
      };

      await ctx.program.methods
        .initialize(params)
        .accounts({
          config: newConfig,
          admin: newAdmin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newAdmin])
        .rpc();

      const configAccount = await ctx.program.account.config.fetch(newConfig);
      expect(configAccount.swapFeeBasisPoints).to.equal(10000);
      expect(configAccount.createTokenFeeBasisPoints).to.equal(10000);
    });

    it("Should initialize with zero fee basis points", async () => {
      const newAdmin = Keypair.generate();
      await TestSetup.fundAccount(ctx.connection, ctx.payer, newAdmin.publicKey, 1);

      const [newConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), newAdmin.publicKey.toBuffer()],
        ctx.program.programId
      );

      const params = {
        admin: newAdmin.publicKey,
        feeRecipient: newAdmin.publicKey,
        swapFeeBasisPoints: 0, // 0% - minimum valid
        createTokenFeeBasisPoints: 0, // 0% - minimum valid
        createPoolFeeLamports: new BN(0), // Zero fee
      };

      await ctx.program.methods
        .initialize(params)
        .accounts({
          config: newConfig,
          admin: newAdmin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newAdmin])
        .rpc();

      const configAccount = await ctx.program.account.config.fetch(newConfig);
      expect(configAccount.swapFeeBasisPoints).to.equal(0);
      expect(configAccount.createTokenFeeBasisPoints).to.equal(0);
      TestSetup.expectBNEqual(configAccount.createPoolFeeLamports, new BN(0));
    });
  });
}); 