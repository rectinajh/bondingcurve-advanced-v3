use anchor_lang::prelude::*;

#[event]
pub struct TokenCreatedEvent {
    pub token_mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub total_supply: u64,
    pub timestamp: i64,
}

#[event]
pub struct SwapEvent {
    pub user: Pubkey,
    pub aiw3_token: Pubkey,
    pub ai_agent_token: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub input_is_aiw3: bool,
    pub aw3_price: i64,
    pub pool_type: String,
    pub timestamp: i64,
}

#[event]
pub struct LiquidityAddedEvent {
    pub user: Pubkey,
    pub aiw3_token: Pubkey,
    pub ai_agent_token: Pubkey,
    pub aiw3_amount: u64,
    pub ai_agent_amount: u64,
    pub pool_type: String,
    pub timestamp: i64,
}

#[event]
pub struct PoolCreatedEvent {
    pub creator: Pubkey,
    pub aiw3_token: Pubkey,
    pub ai_agent_token: Pubkey,
    pub pool_type: String,
    pub initial_aiw3_reserves: u64,
    pub initial_ai_agent_reserves: u64,
    pub swap_fee_basis_points: u16,
    pub timestamp: i64,
}
