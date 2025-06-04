use anchor_lang::prelude::*;

use crate::*;

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut,
        seeds = [CONFIG_SEEDS_PREFIX],
        bump = config.bump,
        has_one = admin @ PumpError::NotAdmin,
    )]
    pub config: Box<Account<'info, Config>>,
}

impl TransferOwnership<'_> {
    pub fn apply(
        ctx: &mut Context<TransferOwnership>,
        params: TransferOwnershipParams,
    ) -> Result<()> {
        ctx.accounts.config.admin = params.new_admin;

        msg!("transfer ownership to {}", ctx.accounts.config.admin,);

        Ok(())
    }
}

#[derive(Clone, AnchorDeserialize, AnchorSerialize)]
pub struct TransferOwnershipParams {
    pub new_admin: Pubkey,
}
