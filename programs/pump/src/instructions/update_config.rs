use anchor_lang::prelude::*;

use crate::*;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut,
        seeds = [CONFIG_SEEDS_PREFIX],
        bump = config.bump,
        has_one = admin @ PumpError::NotAdmin,
    )]
    pub config: Box<Account<'info, Config>>,
}

impl UpdateConfig<'_> {
    pub fn apply(ctx: &mut Context<UpdateConfig>, params: UpdateConfigParams) -> Result<()> {
        if let Some(fee_recipient) = params.fee_recipient {
            ctx.accounts.config.fee_recipient = fee_recipient;
        }

        if let Some(operator) = params.operator {
            ctx.accounts.config.operator = operator;
        }

        if let Some(trade_fee_basis_points) = params.trade_fee_basis_points {
            ctx.accounts.config.trade_fee_basis_points = trade_fee_basis_points;
        }

        if let Some(pump_fee) = params.pump_fee {
            ctx.accounts.config.pump_fee = pump_fee;
        }

        msg!(
            "Config updated: fee_recipient {}, operator {}, trade_fee_basis_points {}, pump_fee {}",
            ctx.accounts.config.fee_recipient,
            ctx.accounts.config.operator,
            ctx.accounts.config.trade_fee_basis_points,
            ctx.accounts.config.pump_fee
        );

        Ok(())
    }
}

#[derive(Clone, AnchorDeserialize, AnchorSerialize)]
pub struct UpdateConfigParams {
    pub fee_recipient: Option<Pubkey>,
    pub operator: Option<Pubkey>,
    pub trade_fee_basis_points: Option<u16>,
    pub pump_fee: Option<u64>,
}
