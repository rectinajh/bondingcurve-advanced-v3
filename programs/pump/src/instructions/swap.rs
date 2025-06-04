use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::{
        spl_token_2022::extension::transfer_fee::TransferFee,
        transfer_checked_with_fee, TransferCheckedWithFee,
    },
    token_interface::{
        transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
    },
};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::*;

#[derive(Clone, AnchorDeserialize, AnchorSerialize)]
pub struct SwapParams {
    pub amount_in: u64,
    pub minimum_amount_out: u64,
    pub input_is_aiw3: bool,  // true if swapping AIW3 -> AI Agent, false if AI Agent -> AIW3
}

#[derive(Accounts)]
#[instruction(params: SwapParams)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
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
        mut,
        seeds = [SWAP_POOL_SEEDS_PREFIX, aiw3_token_mint.key().as_ref(), ai_agent_token_mint.key().as_ref()],
        bump = swap_pool.bump,
        constraint = swap_pool.aiw3_token_mint == aiw3_token_mint.key() @ PumpError::InvalidTokenMint,
        constraint = swap_pool.ai_agent_token_mint == ai_agent_token_mint.key() @ PumpError::InvalidTokenMint,
    )]
    pub swap_pool: Box<Account<'info, SwapPool>>,

    /// User's AIW3 token account
    #[account(
        mut,
        token::mint = aiw3_token_mint,
        token::authority = user,
        token::token_program = token_program_2022
    )]
    pub user_aiw3_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// User's AI Agent token account
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = ai_agent_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program_2022
    )]
    pub user_ai_agent_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Pool's AIW3 token vault
    #[account(
        mut,
        token::mint = aiw3_token_mint,
        token::authority = swap_pool,
        token::token_program = token_program_2022
    )]
    pub pool_aiw3_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Pool's AI Agent token vault
    #[account(
        mut,
        token::mint = ai_agent_token_mint,
        token::authority = swap_pool,
        token::token_program = token_program_2022
    )]
    pub pool_ai_agent_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Fee recipient account (for swap fees)
    #[account(
        mut,
        constraint = fee_recipient.owner == config.fee_recipient @ PumpError::InvalidFeeRecipient
    )]
    pub fee_recipient: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Pyth price oracle for AW3 token pricing
    pub aw3_price_oracle: Account<'info, PriceUpdateV2>,

    pub token_program_2022: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl Swap<'_> {
    pub fn apply(ctx: &mut Context<Swap>, params: &SwapParams) -> Result<()> {
        let swap_pool = &mut ctx.accounts.swap_pool;
        
        // Reentrancy protection
        require!(
            !swap_pool.is_locked,
            PumpError::SwapPoolNotActive
        );
        
        require!(
            swap_pool.is_active,
            PumpError::SwapPoolNotActive
        );

        require!(
            params.amount_in >= MINIMUM_SWAP_AMOUNT,
            PumpError::AmountTooSmall
        );

        // Additional input validation
        require!(
            params.amount_in <= u64::MAX / 2, // Prevent potential overflow
            PumpError::AmountTooSmall
        );

        require!(
            params.minimum_amount_out <= params.amount_in * 2, // Reasonable slippage bounds
            PumpError::InvalidSwapParams
        );

        // Lock the pool to prevent reentrancy
        swap_pool.is_locked = true;

        // Validate user has sufficient balance before attempting swap
        let user_balance = if params.input_is_aiw3 {
            ctx.accounts.user_aiw3_account.amount
        } else {
            ctx.accounts.user_ai_agent_account.amount
        };

        require!(
            user_balance >= params.amount_in,
            PumpError::InsufficientBalance
        );

        // Get AW3 token price from Pyth oracle
        let aw3_price = get_aw3_price(&ctx.accounts.aw3_price_oracle)?;

        // Calculate swap output using the new pool logic
        let amount_out = swap_pool.calculate_swap_output(
            params.amount_in,
            params.input_is_aiw3,
            aw3_price,
        )?;

        require!(
            amount_out >= params.minimum_amount_out,
            PumpError::InsufficientAmountOut
        );

        // Perform the token transfers based on swap direction
        let result = if params.input_is_aiw3 {
            // AIW3 -> AI Agent Token
            Self::transfer_aiw3_to_agent(ctx, params.amount_in, amount_out)
        } else {
            // AI Agent Token -> AIW3
            Self::transfer_agent_to_aiw3(ctx, params.amount_in, amount_out)
        };

        // Always unlock the pool, even if transfer fails
        swap_pool.is_locked = false;

        // Check if transfers were successful
        result?;

        // Update reserves only after successful transfers
        if params.input_is_aiw3 {
            swap_pool.aiw3_reserves = swap_pool.aiw3_reserves
                .checked_add(params.amount_in)
                .ok_or(PumpError::MathOverflow)?;
            swap_pool.ai_agent_reserves = swap_pool.ai_agent_reserves
                .checked_sub(amount_out)
                .ok_or(PumpError::InsufficientLiquidity)?;
        } else {
            swap_pool.ai_agent_reserves = swap_pool.ai_agent_reserves
                .checked_add(params.amount_in)
                .ok_or(PumpError::MathOverflow)?;
            swap_pool.aiw3_reserves = swap_pool.aiw3_reserves
                .checked_sub(amount_out)
                .ok_or(PumpError::InsufficientLiquidity)?;
        }

        // Update timestamp
        swap_pool.last_update_timestamp = Clock::get()?.unix_timestamp;

        // Emit swap event
        emit!(SwapEvent {
            user: ctx.accounts.user.key(),
            aiw3_token: ctx.accounts.aiw3_token_mint.key(),
            ai_agent_token: ctx.accounts.ai_agent_token_mint.key(),
            amount_in: params.amount_in,
            amount_out,
            input_is_aiw3: params.input_is_aiw3,
            aw3_price,
            pool_type: swap_pool.pool_type.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    fn transfer_aiw3_to_agent(
        ctx: &Context<Swap>,
        aiw3_amount_in: u64,
        agent_amount_out: u64,
    ) -> Result<()> {
        let swap_pool = &ctx.accounts.swap_pool;

        // Calculate transfer fees
        let aiw3_transfer_fee = calculate_transfer_fee_from_mint(
            &ctx.accounts.aiw3_token_mint,
            aiw3_amount_in,
        )?;
        
        let agent_transfer_fee = calculate_transfer_fee_from_mint(
            &ctx.accounts.ai_agent_token_mint,
            agent_amount_out,
        )?;

        // Transfer AIW3 from user to pool
        transfer_checked_with_fee(
            CpiContext::new(
                ctx.accounts.token_program_2022.to_account_info(),
                TransferCheckedWithFee {
                    from: ctx.accounts.user_aiw3_account.to_account_info(),
                    mint: ctx.accounts.aiw3_token_mint.to_account_info(),
                    to: ctx.accounts.pool_aiw3_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            aiw3_amount_in,
            ctx.accounts.aiw3_token_mint.decimals,
            aiw3_transfer_fee,
        )?;

        // Transfer AI Agent tokens from pool to user
        let pool_signer_seeds = &[
            SWAP_POOL_SEEDS_PREFIX,
            ctx.accounts.aiw3_token_mint.key().as_ref(),
            ctx.accounts.ai_agent_token_mint.key().as_ref(),
            &[swap_pool.bump],
        ];

        transfer_checked_with_fee(
            CpiContext::new_with_signer(
                ctx.accounts.token_program_2022.to_account_info(),
                TransferCheckedWithFee {
                    from: ctx.accounts.pool_ai_agent_vault.to_account_info(),
                    mint: ctx.accounts.ai_agent_token_mint.to_account_info(),
                    to: ctx.accounts.user_ai_agent_account.to_account_info(),
                    authority: swap_pool.to_account_info(),
                },
                &[pool_signer_seeds],
            ),
            agent_amount_out,
            ctx.accounts.ai_agent_token_mint.decimals,
            agent_transfer_fee,
        )?;

        Ok(())
    }

    fn transfer_agent_to_aiw3(
        ctx: &Context<Swap>,
        agent_amount_in: u64,
        aiw3_amount_out: u64,
    ) -> Result<()> {
        let swap_pool = &ctx.accounts.swap_pool;

        // Calculate transfer fees
        let agent_transfer_fee = calculate_transfer_fee_from_mint(
            &ctx.accounts.ai_agent_token_mint,
            agent_amount_in,
        )?;
        
        let aiw3_transfer_fee = calculate_transfer_fee_from_mint(
            &ctx.accounts.aiw3_token_mint,
            aiw3_amount_out,
        )?;

        // Transfer AI Agent tokens from user to pool
        transfer_checked_with_fee(
            CpiContext::new(
                ctx.accounts.token_program_2022.to_account_info(),
                TransferCheckedWithFee {
                    from: ctx.accounts.user_ai_agent_account.to_account_info(),
                    mint: ctx.accounts.ai_agent_token_mint.to_account_info(),
                    to: ctx.accounts.pool_ai_agent_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            agent_amount_in,
            ctx.accounts.ai_agent_token_mint.decimals,
            agent_transfer_fee,
        )?;

        // Transfer AIW3 from pool to user
        let pool_signer_seeds = &[
            SWAP_POOL_SEEDS_PREFIX,
            ctx.accounts.aiw3_token_mint.key().as_ref(),
            ctx.accounts.ai_agent_token_mint.key().as_ref(),
            &[swap_pool.bump],
        ];

        transfer_checked_with_fee(
            CpiContext::new_with_signer(
                ctx.accounts.token_program_2022.to_account_info(),
                TransferCheckedWithFee {
                    from: ctx.accounts.pool_aiw3_vault.to_account_info(),
                    mint: ctx.accounts.aiw3_token_mint.to_account_info(),
                    to: ctx.accounts.user_aiw3_account.to_account_info(),
                    authority: swap_pool.to_account_info(),
                },
                &[pool_signer_seeds],
            ),
            aiw3_amount_out,
            ctx.accounts.aiw3_token_mint.decimals,
            aiw3_transfer_fee,
        )?;

        Ok(())
    }
}

fn get_aw3_price(price_oracle: &Account<PriceUpdateV2>) -> Result<i64> {
    use crate::utils::get_validated_price;
    
    // Use the validated price function with proper feed ID verification
    let price = get_validated_price(price_oracle, AW3_FEED_ID, MAXIMUM_AGE)?;
    
    // Additional validation: ensure price is positive and reasonable
    require!(
        price > 0,
        PumpError::InvalidPriceOracle
    );
    
    // Add bounds check for price (adjust these based on expected AW3 price range)
    require!(
        price >= 1_000 && price <= 1_000_000_000, // $0.01 to $10,000 range
        PumpError::InvalidPriceOracle
    );
    
    Ok(price)
}

fn calculate_transfer_fee_from_mint(mint: &InterfaceAccount<Mint>, amount: u64) -> Result<u64> {
    // This should extract the actual transfer fee from the Token 2022 mint
    // For now, using a simplified approach
    use crate::utils::calculate_transfer_fee;
    calculate_transfer_fee(&mint.to_account_info(), amount)
} 