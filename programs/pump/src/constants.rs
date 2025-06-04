use solana_program::native_token::LAMPORTS_PER_SOL;
use anchor_lang::solana_program::pubkey::Pubkey;

pub const CONFIG_SEEDS_PREFIX: &[u8] = b"config";
pub const SWAP_POOL_SEEDS_PREFIX: &[u8] = b"swap_pool";
pub const TOKEN_VAULT_SEEDS_PREFIX: &[u8] = b"token_vault";

pub const DECIMALS: u8 = 6;

// Swap constants
pub const DEFAULT_SWAP_FEE_BASIS_POINTS: u16 = 30; // 0.3%
pub const MAX_SWAP_FEE_BASIS_POINTS: u16 = 1000;  // 10%

// AW3 Token constants 
pub const AW3_TOKEN_DECIMALS: u8 = 6;
pub const TOTAL_SUPPLY: u64 = 1_000_000_000u64.saturating_mul(10u64.pow(DECIMALS as u32));

// Minimum swap amounts
pub const MINIMUM_SWAP_AMOUNT: u64 = 1000; // Minimum tokens to swap

// Price Oracle constants
// Feed ID for AW3/USD price feed - you'll need to replace with actual Pyth feed ID
pub const AW3_FEED_ID: &str = "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"; // Example AW3 price feed
pub const MAXIMUM_AGE: u64 = 300; // 5 minutes maximum age for price data

// Default pool ratios (can be adjusted)
pub const INITIAL_A1_RESERVES: u64 = 1_000_000u64.saturating_mul(10u64.pow(DECIMALS as u32));
pub const INITIAL_A2_RESERVES: u64 = 1_000_000u64.saturating_mul(10u64.pow(DECIMALS as u32));

// pub const REWARD_FEE: u64 = 5 * LAMPORTS_PER_SOL / 10;

pub const EXECUTE_FEE: u64 = LAMPORTS_PER_SOL / 10;

pub const PROTOCOL_FEE: u64 = 25 * LAMPORTS_PER_SOL / 10;

pub const INIT_VIRTUAL_SOL_AMOUNT: u64 = 34_000_000_000u64;

pub const INIT_VIRTUAL_TOKEN_AMOUNT: u64 =
    1_073_017_645u64.saturating_mul(10u64.pow(DECIMALS as u32));

pub const QUOTE_AMOUNT: u64 = 164 * LAMPORTS_PER_SOL;

pub const COMPLETED_TOKEN_AMOUNT: u64 = TOTAL_SUPPLY * 30 / 100;
pub const VESTING_AMOUNT: u64 = TOTAL_SUPPLY * 10 / 100;

pub const BURN_AMOUNT: u64 = 5_825_082_690_385u64;

pub const MINIMUM_SOL_BUY_AMOUNT: u64 = 204 * LAMPORTS_PER_SOL / 100000;

pub const SOL_DECIMALS: u8 = 9;

// Vesting constants - Time in seconds
pub const SECONDS_PER_DAY: u64 = 86400;
pub const SECONDS_PER_MONTH: u64 = SECONDS_PER_DAY * 30;
pub const LOCK_PERIOD: u64 = SECONDS_PER_MONTH * 3; // 3 months
pub const VESTING_PERIOD: u64 = SECONDS_PER_MONTH * 24; // 24 months
pub const FULL_UNLOCK_PERIOD: u64 = LOCK_PERIOD + VESTING_PERIOD; // 27 months

// Pool types
pub const INTERNAL_POOL_TYPE: &str = "internal";   // AIW3 Token / AI Agent Token (A1)
pub const EXTERNAL_POOL_TYPE: &str = "external";   // AIW3 Token / AI Agent Token (A2)

// Token program constants
pub const TOKEN_2022_PROGRAM_ID: Pubkey = anchor_spl::token_2022::ID;

// Decimals
pub const DEFAULT_TOKEN_DECIMALS: u8 = 9;

// Pool configuration
pub const MIN_POOL_RESERVES: u64 = 1_000_000;      // Minimum reserves to maintain liquidity
pub const MAX_PRICE_IMPACT: u16 = 500;             // 5% maximum price impact per swap

// Price precision
pub const PRICE_PRECISION: u64 = 1_000_000;        // 6 decimal places for price calculations

// Administrative constants
pub const MAX_TRANSFER_FEE_BASIS_POINTS: u16 = 1000; // 10% maximum transfer fee
