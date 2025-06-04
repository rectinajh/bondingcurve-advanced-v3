use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub fee_recipient: Pubkey,
    pub operator: Pubkey,
    pub bump: u8,
    pub trade_fee_basis_points: u16,

    pub pump_fee: u64,
    pub mop_mint: Pubkey,
    pub _padding: [u8; 100],
}

impl Config {
    pub fn trade_fee(&self, amount: u64) -> u64 {
        amount
            .saturating_mul(self.trade_fee_basis_points as u64)
            .saturating_div(10000)
    }
}
