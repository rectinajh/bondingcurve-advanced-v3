use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEEDS_PREFIX], bump)]
    pub config: Box<Account<'info, Config>>,

    pub mop_mint: Box<Account<'info, Mint>>,

    pub fee_recipient: SystemAccount<'info>,

    #[
        account(
            init_if_needed,
            payer = admin,
            associated_token::mint = mop_mint,
            associated_token::authority = fee_recipient
        )
    ]
    pub fee_recipient_mop_vault: Box<Account<'info, TokenAccount>>,

    pub operator: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

impl Initialize<'_> {
    pub fn apply(ctx: &mut Context<Self>, params: &InitializeParams) -> Result<()> {
        let config = &mut ctx.accounts.config;

        config.admin = ctx.accounts.admin.key();
        config.operator = ctx.accounts.operator.key();
        config.fee_recipient = ctx.accounts.fee_recipient.key();
        config.bump = ctx.bumps.config;

        config.mop_mint = ctx.accounts.mop_mint.key();

        config.trade_fee_basis_points = params.trade_fee_basis_points.unwrap_or(100);
        config.pump_fee = params.pump_fee.unwrap_or(0);

        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub trade_fee_basis_points: Option<u16>,
    pub pump_fee: Option<u64>,
}
