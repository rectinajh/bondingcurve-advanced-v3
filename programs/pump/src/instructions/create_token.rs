use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::{
        initialize_mint2, initialize_account3,
        spl_token_2022::{
            extension::{
                transfer_fee::instruction::initialize_transfer_fee_config,
                ExtensionType,
            },
            state::Mint as MintState,
        },
        InitializeMint2, InitializeAccount3,
    },
    token_interface::{
        Mint, TokenAccount, TokenInterface,
    },
};

use anchor_lang::system_program::{create_account, CreateAccount};
use crate::*;

#[derive(Clone, AnchorDeserialize, AnchorSerialize)]
pub struct CreateTokenParams {
    pub transfer_fee_basis_points: u16,
    pub max_fee: u64,
    #[max_len(20)]
    pub name: String,
    #[max_len(10)]
    pub symbol: String,
    pub decimals: u8,
    pub initial_supply: u64,
}

#[derive(Accounts)]
#[instruction(params: CreateTokenParams)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        seeds = [CONFIG_SEEDS_PREFIX],
        bump,
    )]
    pub config: Box<Account<'info, Config>>,

    /// The new token mint to be created
    #[account(
        mut,
        seeds = [creator.key().as_ref(), params.symbol.as_bytes()],
        bump,
    )]
    pub token_mint: UncheckedAccount<'info>,

    /// Pool to hold liquidity for this token
    #[account(
        init,
        payer = creator,
        seeds = [SWAP_POOL_SEEDS_PREFIX, token_mint.key().as_ref()],
        bump,
        space = 8 + SwapPool::INIT_SPACE
    )]
    pub swap_pool: Box<Account<'info, SwapPool>>,

    /// Token vault for the pool
    #[account(
        mut,
        seeds = [swap_pool.key().as_ref(), token_mint.key().as_ref()],
        bump
    )]
    pub pool_token_vault: UncheckedAccount<'info>,

    /// Creator's token account to receive initial supply
    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = creator,
        associated_token::token_program = token_program_2022
    )]
    pub creator_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Fee recipient account
    #[account(mut)]
    pub fee_recipient: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program_2022: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> CreateToken<'info> {
    pub fn apply(
        ctx: &mut Context<'_, '_, '_, 'info, CreateToken<'info>>,
        params: &CreateTokenParams,
    ) -> Result<()> {
        let creator_key = ctx.accounts.creator.key();
        let symbol_bytes = params.symbol.as_bytes();
        
        // Verify the mint PDA
        let (mint_pda, mint_bump) = Pubkey::find_program_address(
            &[creator_key.as_ref(), symbol_bytes],
            &id(),
        );
        require_keys_eq!(mint_pda, ctx.accounts.token_mint.key(), PumpError::InvalidTokenMint);

        // Calculate mint account size with transfer fee extension
        let mint_size = ExtensionType::try_calculate_account_len::<MintState>(&[
            ExtensionType::TransferFeeConfig,
        ])?;

        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(mint_size);

        // Create mint account
        let mint_signer_seeds = &[
            creator_key.as_ref(),
            symbol_bytes,
            &[mint_bump],
        ];

        create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                CreateAccount {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.token_mint.to_account_info(),
                },
                &[mint_signer_seeds],
            ),
            lamports,
            mint_size as u64,
            &ctx.accounts.token_program_2022.key(),
        )?;

        // Initialize transfer fee extension
        let transfer_fee_config_ix = initialize_transfer_fee_config(
            &ctx.accounts.token_program_2022.key(),
            &ctx.accounts.token_mint.key(),
            Some(&ctx.accounts.config.fee_recipient),
            Some(&ctx.accounts.creator.key()),
            params.transfer_fee_basis_points,
            params.max_fee,
        )?;

        solana_program::program::invoke_signed(
            &transfer_fee_config_ix,
            &[
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.config.to_account_info(),
            ],
            &[mint_signer_seeds],
        )?;

        // Initialize mint
        initialize_mint2(
            CpiContext::new_with_signer(
                ctx.accounts.token_program_2022.to_account_info(),
                InitializeMint2 {
                    mint: ctx.accounts.token_mint.to_account_info(),
                },
                &[mint_signer_seeds],
            ),
            params.decimals,
            &ctx.accounts.swap_pool.key(),
            Some(&ctx.accounts.creator.key()),
        )?;

        // Initialize swap pool state
        let swap_pool = &mut ctx.accounts.swap_pool;
        swap_pool.creator = ctx.accounts.creator.key();
        swap_pool.token_mint = ctx.accounts.token_mint.key();
        swap_pool.token_a1_reserves = 0;
        swap_pool.token_a2_reserves = 0;
        swap_pool.fee_rate = params.transfer_fee_basis_points;
        swap_pool.is_active = true;
        swap_pool.bump = ctx.bumps.swap_pool;

        // Create pool token vault
        let vault_size = TokenAccount::LEN;
        let vault_lamports = rent.minimum_balance(vault_size);

        let pool_key = ctx.accounts.swap_pool.key();
        let token_mint_key = ctx.accounts.token_mint.key();
        let vault_signer_seeds = &[
            pool_key.as_ref(),
            token_mint_key.as_ref(),
            &[ctx.bumps.pool_token_vault],
        ];

        create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                CreateAccount {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.pool_token_vault.to_account_info(),
                },
                &[vault_signer_seeds],
            ),
            vault_lamports,
            vault_size as u64,
            &ctx.accounts.token_program_2022.key(),
        )?;

        // Initialize pool token vault
        initialize_account3(
            CpiContext::new_with_signer(
                ctx.accounts.token_program_2022.to_account_info(),
                InitializeAccount3 {
                    account: ctx.accounts.pool_token_vault.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    authority: ctx.accounts.swap_pool.to_account_info(),
                },
                &[vault_signer_seeds],
            ),
        )?;

        // Emit token creation event
        emit!(TokenCreatedEvent {
            creator: ctx.accounts.creator.key(),
            token_mint: ctx.accounts.token_mint.key(),
            swap_pool: ctx.accounts.swap_pool.key(),
            name: params.name.clone(),
            symbol: params.symbol.clone(),
            decimals: params.decimals,
            transfer_fee_basis_points: params.transfer_fee_basis_points,
            max_fee: params.max_fee,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
} 