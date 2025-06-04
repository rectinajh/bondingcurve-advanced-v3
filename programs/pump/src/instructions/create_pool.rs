use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{states::swap_pool::PoolType, *};

#[derive(Clone, AnchorDeserialize, AnchorSerialize)]
pub struct CreatePoolParams {
    pub pool_type: PoolType,  // Use enum instead of string
    pub initial_aiw3_amount: u64,
    pub initial_ai_agent_amount: u64,
    pub swap_fee_basis_points: u16,
}

#[derive(Accounts)]
#[instruction(params: CreatePoolParams)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        seeds = [CONFIG_SEEDS_PREFIX],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, Config>>,

    /// AIW3 Token mint (platform token)
    pub aiw3_token_mint: Box<InterfaceAccount<'info, Mint>>,
    
    /// AI Agent Token mint (project token)  
    pub ai_agent_token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = creator,
        space = SwapPool::SIZE,
        seeds = [SWAP_POOL_SEEDS_PREFIX, aiw3_token_mint.key().as_ref(), ai_agent_token_mint.key().as_ref()],
        bump,
    )]
    pub swap_pool: Box<Account<'info, SwapPool>>,

    /// Creator's AIW3 token account
    #[account(
        mut,
        token::mint = aiw3_token_mint,
        token::authority = creator,
        token::token_program = token_program_2022
    )]
    pub creator_aiw3_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Creator's AI Agent token account
    #[account(
        mut,
        token::mint = ai_agent_token_mint,
        token::authority = creator,
        token::token_program = token_program_2022
    )]
    pub creator_ai_agent_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Pool's AIW3 token vault
    #[account(
        init,
        payer = creator,
        token::mint = aiw3_token_mint,
        token::authority = swap_pool,
        token::token_program = token_program_2022
    )]
    pub pool_aiw3_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Pool's AI Agent token vault
    #[account(
        init,
        payer = creator,
        token::mint = ai_agent_token_mint,
        token::authority = swap_pool,
        token::token_program = token_program_2022
    )]
    pub pool_ai_agent_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program_2022: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl CreatePool<'_> {
    pub fn apply(ctx: &mut Context<CreatePool>, params: &CreatePoolParams) -> Result<()> {
        // Validate pool type (enum validation is automatic)
        // Additional validation for fee bounds
        require!(
            params.swap_fee_basis_points <= MAX_SWAP_FEE_BASIS_POINTS,
            PumpError::InvalidSwapParams
        );

        require!(
            params.initial_aiw3_amount >= MIN_POOL_RESERVES && 
            params.initial_ai_agent_amount >= MIN_POOL_RESERVES,
            PumpError::InvalidTokenReserves
        );

        // Prevent creating pools with the same token
        require!(
            ctx.accounts.aiw3_token_mint.key() != ctx.accounts.ai_agent_token_mint.key(),
            PumpError::InvalidTokenMint
        );

        // Validate token mints are actually mints
        require!(
            ctx.accounts.aiw3_token_mint.supply > 0 && 
            ctx.accounts.ai_agent_token_mint.supply > 0,
            PumpError::InvalidTokenMint
        );

        let swap_pool = &mut ctx.accounts.swap_pool;
        let bump = ctx.bumps.swap_pool;

        // Initialize swap pool
        swap_pool.creator = ctx.accounts.creator.key();
        swap_pool.aiw3_token_mint = ctx.accounts.aiw3_token_mint.key();
        swap_pool.ai_agent_token_mint = ctx.accounts.ai_agent_token_mint.key();
        swap_pool.aiw3_reserves = params.initial_aiw3_amount;
        swap_pool.ai_agent_reserves = params.initial_ai_agent_amount;
        swap_pool.swap_fee_basis_points = params.swap_fee_basis_points;
        swap_pool.aiw3_transfer_fee_basis_points = 0; // Will be updated when tokens are transferred
        swap_pool.ai_agent_transfer_fee_basis_points = 0; // Will be updated when tokens are transferred
        swap_pool.pool_type = params.pool_type.clone();
        swap_pool.is_active = true;
        swap_pool.is_locked = false; // Initialize as unlocked
        swap_pool.bump = bump;
        swap_pool.created_timestamp = Clock::get()?.unix_timestamp;
        swap_pool.last_update_timestamp = Clock::get()?.unix_timestamp;

        // Transfer initial liquidity from creator to pool
        Self::transfer_initial_liquidity(ctx, params)?;

        // Emit pool created event
        emit!(PoolCreatedEvent {
            creator: ctx.accounts.creator.key(),
            aiw3_token: ctx.accounts.aiw3_token_mint.key(),
            ai_agent_token: ctx.accounts.ai_agent_token_mint.key(),
            pool_type: format!("{:?}", params.pool_type), // Convert enum to string for event
            initial_aiw3_reserves: params.initial_aiw3_amount,
            initial_ai_agent_reserves: params.initial_ai_agent_amount,
            swap_fee_basis_points: params.swap_fee_basis_points,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    fn transfer_initial_liquidity(
        ctx: &Context<CreatePool>,
        params: &CreatePoolParams,
    ) -> Result<()> {
        use anchor_spl::token_interface::{transfer_checked, TransferChecked};

        // Transfer AIW3 tokens from creator to pool vault
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program_2022.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.creator_aiw3_account.to_account_info(),
                    mint: ctx.accounts.aiw3_token_mint.to_account_info(),
                    to: ctx.accounts.pool_aiw3_vault.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            params.initial_aiw3_amount,
            ctx.accounts.aiw3_token_mint.decimals,
        )?;

        // Transfer AI Agent tokens from creator to pool vault
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program_2022.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.creator_ai_agent_account.to_account_info(),
                    mint: ctx.accounts.ai_agent_token_mint.to_account_info(),
                    to: ctx.accounts.pool_ai_agent_vault.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            params.initial_ai_agent_amount,
            ctx.accounts.ai_agent_token_mint.decimals,
        )?;

        Ok(())
    }
} 