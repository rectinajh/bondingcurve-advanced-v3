import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Pump } from "../target/types/pump";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createInitializeMintInstruction,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

export interface TestContext {
  provider: anchor.AnchorProvider;
  program: Program<Pump>;
  connection: Connection;
  payer: Keypair;
  admin: Keypair;
  user1: Keypair;
  user2: Keypair;
  config: PublicKey;
  tokenMintA: Keypair;
  tokenMintB: Keypair;
  swapPool: PublicKey;
}

export class TestSetup {
  static async initialize(): Promise<TestContext> {
    // Configure the client to use the local cluster
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = anchor.getProvider() as anchor.AnchorProvider;
    const program = anchor.workspace.Pump as Program<Pump>;
    const connection = provider.connection;

    // Generate test keypairs
    const payer = provider.wallet.payer;
    const admin = Keypair.generate();
    const user1 = Keypair.generate();
    const user2 = Keypair.generate();

    // Fund test accounts
    await TestSetup.fundAccount(connection, payer, admin.publicKey, 10);
    await TestSetup.fundAccount(connection, payer, user1.publicKey, 5);
    await TestSetup.fundAccount(connection, payer, user2.publicKey, 5);

    // Generate token mints
    const tokenMintA = Keypair.generate();
    const tokenMintB = Keypair.generate();

    // Derive config PDA
    const [config] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    // Derive swap pool PDA
    const [swapPool] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("swap_pool"),
        tokenMintA.publicKey.toBuffer(),
        tokenMintB.publicKey.toBuffer(),
      ],
      program.programId
    );

    return {
      provider,
      program,
      connection,
      payer,
      admin,
      user1,
      user2,
      config,
      tokenMintA,
      tokenMintB,
      swapPool,
    };
  }

  static async fundAccount(
    connection: Connection,
    payer: Keypair,
    account: PublicKey,
    solAmount: number
  ): Promise<void> {
    const lamports = solAmount * anchor.web3.LAMPORTS_PER_SOL;
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: account,
        lamports,
      })
    );
    await sendAndConfirmTransaction(connection, tx, [payer]);
  }

  static async createToken(
    connection: Connection,
    payer: Keypair,
    mint: Keypair,
    decimals: number = 9
  ): Promise<void> {
    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        payer.publicKey,
        payer.publicKey
      )
    );

    await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  }

  static async createAssociatedTokenAccount(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    const ata = await getAssociatedTokenAddress(mint, owner);
    
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        mint
      )
    );

    await sendAndConfirmTransaction(connection, tx, [payer]);
    return ata;
  }

  static async mintTokens(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    destination: PublicKey,
    amount: number
  ): Promise<void> {
    const tx = new Transaction().add(
      createMintToInstruction(mint, destination, payer.publicKey, amount)
    );
    await sendAndConfirmTransaction(connection, tx, [payer]);
  }

  static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static expectBNEqual(actual: BN, expected: BN, message?: string): void {
    expect(actual.toString()).to.equal(expected.toString(), message);
  }

  static expectBNClose(
    actual: BN,
    expected: BN,
    tolerance: BN,
    message?: string
  ): void {
    const diff = actual.sub(expected).abs();
    expect(diff.lte(tolerance)).to.be.true;
  }

  static async getTokenBalance(
    connection: Connection,
    tokenAccount: PublicKey
  ): Promise<BN> {
    const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
    return new BN(accountInfo.value.amount);
  }

  static async getAccountInfo(
    program: Program<Pump>,
    account: PublicKey
  ): Promise<any> {
    return await program.account.fetch(account);
  }
}

export const SWAP_FEE_BASIS_POINTS = 30; // 0.3%
export const MAX_FEE_BASIS_POINTS = 10000;
export const TOKEN_DECIMALS = 9;
export const INITIAL_SUPPLY = new BN(1_000_000).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));
export const INITIAL_LIQUIDITY = new BN(100_000).mul(new BN(10).pow(new BN(TOKEN_DECIMALS))); 