use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::instructions::*;
use crate::states::*;

mod constants;
mod errors;
mod events;
mod instructions;
mod states;
mod utils;

declare_id!("HbJP9MaXcEC4ja3zoSKo4qCQmgE6ZVeQMRVHueNipvGc");

#[program]
pub mod pump {
    use super::*;

    pub fn initialize(mut ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        Initialize::apply(&mut ctx, &params)
    }

    pub fn create_token(mut ctx: Context<CreateToken>, params: CreateTokenParams) -> Result<()> {
        CreateToken::apply(&mut ctx, &params)
    }

    pub fn create_pool(mut ctx: Context<CreatePool>, params: CreatePoolParams) -> Result<()> {
        CreatePool::apply(&mut ctx, &params)
    }

    pub fn swap(mut ctx: Context<Swap>, params: SwapParams) -> Result<()> {
        Swap::apply(&mut ctx, &params)
    }

    pub fn update_config(mut ctx: Context<UpdateConfig>, params: UpdateConfigParams) -> Result<()> {
        UpdateConfig::apply(&mut ctx, params)
    }

    pub fn transfer_ownership(
        mut ctx: Context<TransferOwnership>,
        params: TransferOwnershipParams,
    ) -> Result<()> {
        TransferOwnership::apply(&mut ctx, params)
    }
}
