use anchor_lang::error_code;

#[error_code]
pub enum PumpError {
    #[msg("Not admin")]
    NotAdmin,
    #[msg("Invalid fee recipient")]
    InvalidFeeRecipient,
    #[msg("Swap pool is not active")]
    SwapPoolNotActive,
    #[msg("Insufficient amount out")]
    InsufficientAmountOut,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Amount too small")]
    AmountTooSmall,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid creator")]
    InvalidCreator,
    #[msg("Invalid operator")]
    InvalidOperator,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Invalid token reserves")]
    InvalidTokenReserves,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("Invalid price oracle")]
    InvalidPriceOracle,
    #[msg("Price too old")]
    PriceTooOld,
    #[msg("Invalid swap parameters")]
    InvalidSwapParams,
    #[msg("Pool is locked for operation")]
    PoolLocked,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Invalid pool state")]
    InvalidPoolState,
}
