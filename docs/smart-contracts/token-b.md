# Token 管理智能合约文档

## 概述

Token 管理模块负责 AIW3 Token 和 AI Agent Token 的创建、配置和管理。该模块支持 SPL Token 2022 标准，包含转账费用、元数据管理和权限控制等高级功能。

## 核心功能

### 1. 代币创建
- 支持 SPL Token 2022 标准
- 自动转账费用配置
- 元数据管理
- 权限设置

### 2. 代币管理
- 铸造权限控制
- 冻结权限管理
- 转账费用调整
- 元数据更新

### 3. 安全特性
- 多重签名支持
- 权限分离
- 操作审计
- 紧急控制

## 主要指令

### 1. CreateToken 指令

**功能**: 创建新的代币

**参数**:
```rust
pub struct CreateTokenParams {
    pub name: String,                    // 代币名称
    pub symbol: String,                  // 代币符号
    pub uri: String,                     // 元数据 URI
    pub decimals: u8,                    // 小数位数
    pub initial_supply: u64,             // 初始供应量
    pub transfer_fee_basis_points: u16,  // 转账费用基点
    pub max_fee: u64,                    // 最大费用
    pub token_type: TokenType,           // 代币类型
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub enum TokenType {
    AIW3Token,      // AIW3 代币
    AIAgentToken,   // AI Agent 代币
}
```

**账户结构**:
```rust
#[derive(Accounts)]
#[instruction(params: CreateTokenParams)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(seeds = [CONFIG_SEEDS_PREFIX], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    
    #[account(
        init,
        payer = admin,
        mint::decimals = params.decimals,
        mint::authority = config.key(),
        mint::freeze_authority = config.key(),
        extensions::metadata_pointer::authority = config.key(),
        extensions::metadata_pointer::metadata_address = token_mint.key(),
        extensions::transfer_fee_config::transfer_fee_config_authority = config.key(),
        extensions::transfer_fee_config::withdraw_withheld_authority = config.key(),
        extensions::transfer_fee_config::transfer_fee_basis_points = params.transfer_fee_basis_points,
        extensions::transfer_fee_config::maximum_fee = params.max_fee,
    )]
    pub token_mint: Box<Account<'info, Mint>>,
    
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = token_mint,
        associated_token::authority = admin
    )]
    pub admin_token_account: Box<Account<'info, TokenAccount>>,
    
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

**实现逻辑**:

```rust
impl CreateToken<'_> {
    pub fn apply(ctx: &mut Context<Self>, params: &CreateTokenParams) -> Result<()> {
        let config = &ctx.accounts.config;
        
        // 1. 权限验证
        require!(
            ctx.accounts.admin.key() == config.admin ||
            ctx.accounts.admin.key() == config.operator,
            ErrorCode::Unauthorized
        );
        
        // 2. 参数验证
        validate_token_params(&params)?;
        
        // 3. 初始化元数据
        initialize_token_metadata(ctx, &params)?;
        
        // 4. 铸造初始供应量
        if params.initial_supply > 0 {
            mint_initial_supply(ctx, &params)?;
        }
        
        // 5. 发出事件
        emit!(TokenCreatedEvent {
            admin: ctx.accounts.admin.key(),
            token_mint: ctx.accounts.token_mint.key(),
            name: params.name.clone(),
            symbol: params.symbol.clone(),
            decimals: params.decimals,
            initial_supply: params.initial_supply,
            token_type: params.token_type,
        });
        
        Ok(())
    }
}
```

### 2. UpdateTokenMetadata 指令

**功能**: 更新代币元数据

**参数**:
```rust
pub struct UpdateTokenMetadataParams {
    pub name: Option<String>,            // 新名称
    pub symbol: Option<String>,          // 新符号
    pub uri: Option<String>,             // 新 URI
}
```

**账户结构**:
```rust
#[derive(Accounts)]
pub struct UpdateTokenMetadata<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(seeds = [CONFIG_SEEDS_PREFIX], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    
    #[account(
        mut,
        extensions::metadata_pointer::metadata_address = token_mint.key(),
    )]
    pub token_mint: Box<Account<'info, Mint>>,
    
    pub token_program: Program<'info, Token2022>,
}
```

### 3. UpdateTransferFee 指令

**功能**: 更新转账费用设置

**参数**:
```rust
pub struct UpdateTransferFeeParams {
    pub transfer_fee_basis_points: u16,  // 新费用基点
    pub maximum_fee: u64,                // 新最大费用
}
```

## 代币类型管理

### 1. AIW3 Token

**特性**:
- 固定总供应量: 1,000,000,000 个
- 小数位数: 6
- 转账费用: 可配置
- 用途: 系统价值锚定代币

**配置**:
```rust
pub const AIW3_TOKEN_CONFIG: TokenConfig = TokenConfig {
    total_supply: 1_000_000_000_000_000, // 1B with 6 decimals
    decimals: 6,
    default_transfer_fee_bp: 50, // 0.5%
    max_transfer_fee: 1_000_000, // 1 token max fee
    is_mintable: false,
    is_freezable: true,
};
```

### 2. AI Agent Token (A1 & A2)

**特性**:
- 动态供应量
- 小数位数: 6 或 9（可配置）
- 转账费用: 可配置
- 用途: 智能代理奖励代币

**配置**:
```rust
pub const AI_AGENT_TOKEN_CONFIG: TokenConfig = TokenConfig {
    total_supply: 0, // Dynamic supply
    decimals: 6,
    default_transfer_fee_bp: 30, // 0.3%
    max_transfer_fee: 500_000,   // 0.5 token max fee
    is_mintable: true,
    is_freezable: true,
};
```

## Token 2022 功能集成

### 1. 转账费用扩展

```rust
pub fn configure_transfer_fee(
    ctx: &Context<CreateToken>,
    fee_basis_points: u16,
    maximum_fee: u64,
) -> Result<()> {
    let config_seeds = &[CONFIG_SEEDS_PREFIX, &[ctx.accounts.config.bump]];
    let signer_seeds = &[&config_seeds[..]];
    
    // 设置转账费用
    token_2022::set_transfer_fee(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_2022::SetTransferFee {
                token_program_id: ctx.accounts.token_program.key(),
                mint: ctx.accounts.token_mint.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        ),
        fee_basis_points,
        maximum_fee,
    )?;
    
    Ok(())
}
```

### 2. 元数据扩展

```rust
pub fn initialize_token_metadata(
    ctx: &Context<CreateToken>,
    params: &CreateTokenParams,
) -> Result<()> {
    let config_seeds = &[CONFIG_SEEDS_PREFIX, &[ctx.accounts.config.bump]];
    let signer_seeds = &[&config_seeds[..]];
    
    // 初始化元数据
    token_metadata::initialize(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_metadata::Initialize {
                program_id: ctx.accounts.token_program.key(),
                mint: ctx.accounts.token_mint.to_account_info(),
                metadata: ctx.accounts.token_mint.to_account_info(), // Same as mint for pointer
                mint_authority: ctx.accounts.config.to_account_info(),
                update_authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        ),
        InitializeParams {
            name: params.name.clone(),
            symbol: params.symbol.clone(),
            uri: params.uri.clone(),
        },
    )?;
    
    Ok(())
}
```

### 3. 权限管理

```rust
pub fn transfer_mint_authority(
    ctx: &Context<TransferMintAuthority>,
    new_authority: Option<Pubkey>,
) -> Result<()> {
    let config = &ctx.accounts.config;
    
    // 权限验证
    require!(
        ctx.accounts.current_authority.key() == config.admin,
        ErrorCode::Unauthorized
    );
    
    let config_seeds = &[CONFIG_SEEDS_PREFIX, &[config.bump]];
    let signer_seeds = &[&config_seeds[..]];
    
    // 转移铸造权限
    token::set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::SetAuthority {
                current_authority: config.to_account_info(),
                account_or_mint: ctx.accounts.token_mint.to_account_info(),
            },
            signer_seeds,
        ),
        token::spl_token::instruction::AuthorityType::MintTokens,
        new_authority,
    )?;
    
    Ok(())
}
```

## 供应量管理

### 1. 铸造功能

```rust
pub fn mint_tokens(
    ctx: &Context<MintTokens>,
    amount: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let config_seeds = &[CONFIG_SEEDS_PREFIX, &[config.bump]];
    let signer_seeds = &[&config_seeds[..]];
    
    // 验证铸造权限
    require!(
        ctx.accounts.authority.key() == config.admin ||
        ctx.accounts.authority.key() == config.operator,
        ErrorCode::Unauthorized
    );
    
    // 检查供应量限制
    validate_mint_amount(&ctx.accounts.token_mint, amount)?;
    
    // 执行铸造
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: config.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;
    
    // 发出事件
    emit!(TokenMintedEvent {
        mint: ctx.accounts.token_mint.key(),
        destination: ctx.accounts.destination.key(),
        amount,
        total_supply: ctx.accounts.token_mint.supply,
    });
    
    Ok(())
}
```

### 2. 销毁功能

```rust
pub fn burn_tokens(
    ctx: &Context<BurnTokens>,
    amount: u64,
) -> Result<()> {
    // 验证权限
    require!(
        ctx.accounts.owner.key() == ctx.accounts.source.owner ||
        ctx.accounts.owner.key() == ctx.accounts.config.admin,
        ErrorCode::Unauthorized
    );
    
    // 检查余额
    require!(
        ctx.accounts.source.amount >= amount,
        ErrorCode::InsufficientBalance
    );
    
    // 执行销毁
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.token_mint.to_account_info(),
                from: ctx.accounts.source.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
    )?;
    
    // 发出事件
    emit!(TokenBurnedEvent {
        mint: ctx.accounts.token_mint.key(),
        source: ctx.accounts.source.key(),
        amount,
        total_supply: ctx.accounts.token_mint.supply,
    });
    
    Ok(())
}
```

## 费用计算和处理

### 1. 转账费用计算

```rust
pub fn calculate_transfer_fee(
    mint: &Account<'_, Mint>,
    amount: u64,
) -> Result<u64> {
    let transfer_fee_config = mint.get_extension::<TransferFeeConfig>()?;
    
    let fee = transfer_fee_config
        .calculate_fee(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    
    Ok(fee)
}
```

### 2. 费用提取

```rust
pub fn withdraw_withheld_tokens(
    ctx: &Context<WithdrawWithheldTokens>,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let config_seeds = &[CONFIG_SEEDS_PREFIX, &[config.bump]];
    let signer_seeds = &[&config_seeds[..]];
    
    // 权限验证
    require!(
        ctx.accounts.authority.key() == config.admin,
        ErrorCode::Unauthorized
    );
    
    // 提取暂扣费用
    token_2022::withdraw_withheld_tokens_from_mint(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token_2022::WithdrawWithheldTokensFromMint {
                token_program_id: ctx.accounts.token_program.key(),
                mint: ctx.accounts.token_mint.to_account_info(),
                destination: ctx.accounts.destination.to_account_info(),
                authority: config.to_account_info(),
            },
            signer_seeds,
        ),
    )?;
    
    Ok(())
}
```

## 安全特性

### 1. 权限分离

```rust
pub struct TokenAuthorities {
    pub mint_authority: Pubkey,          // 铸造权限
    pub freeze_authority: Pubkey,        // 冻结权限
    pub transfer_fee_authority: Pubkey,  // 费用权限
    pub metadata_authority: Pubkey,      // 元数据权限
}

impl TokenAuthorities {
    pub fn admin_controlled(admin: Pubkey) -> Self {
        Self {
            mint_authority: admin,
            freeze_authority: admin,
            transfer_fee_authority: admin,
            metadata_authority: admin,
        }
    }
    
    pub fn distributed(
        admin: Pubkey,
        operator: Pubkey,
        fee_manager: Pubkey,
    ) -> Self {
        Self {
            mint_authority: admin,
            freeze_authority: admin,
            transfer_fee_authority: fee_manager,
            metadata_authority: operator,
        }
    }
}
```

### 2. 操作审计

```rust
#[event]
pub struct TokenOperationEvent {
    pub operation_type: String,
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub details: String,
    pub timestamp: i64,
}

pub fn log_token_operation(
    operation: &str,
    authority: Pubkey,
    mint: Pubkey,
    details: &str,
) -> Result<()> {
    emit!(TokenOperationEvent {
        operation_type: operation.to_string(),
        authority,
        token_mint: mint,
        details: details.to_string(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}
```

### 3. 紧急控制

```rust
pub fn emergency_freeze_token(
    ctx: &Context<EmergencyFreezeToken>,
) -> Result<()> {
    let config = &ctx.accounts.config;
    
    // 仅管理员可执行紧急冻结
    require!(
        ctx.accounts.authority.key() == config.admin,
        ErrorCode::Unauthorized
    );
    
    let config_seeds = &[CONFIG_SEEDS_PREFIX, &[config.bump]];
    let signer_seeds = &[&config_seeds[..]];
    
    // 冻结所有账户
    token::freeze_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::FreezeAccount {
                account: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                authority: config.to_account_info(),
            },
            signer_seeds,
        ),
    )?;
    
    // 记录紧急操作
    log_token_operation(
        "emergency_freeze",
        ctx.accounts.authority.key(),
        ctx.accounts.token_mint.key(),
        "Emergency freeze activated",
    )?;
    
    Ok(())
}
```

## 事件系统

### 1. 代币创建事件

```rust
#[event]
pub struct TokenCreatedEvent {
    pub admin: Pubkey,
    pub token_mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub initial_supply: u64,
    pub token_type: TokenType,
}
```

### 2. 铸造/销毁事件

```rust
#[event]
pub struct TokenMintedEvent {
    pub mint: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub total_supply: u64,
}

#[event]
pub struct TokenBurnedEvent {
    pub mint: Pubkey,
    pub source: Pubkey,
    pub amount: u64,
    pub total_supply: u64,
}
```

### 3. 元数据更新事件

```rust
#[event]
pub struct MetadataUpdatedEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub field: String,
    pub old_value: String,
    pub new_value: String,
}
```

## 错误处理

### 1. 自定义错误

```rust
#[error_code]
pub enum TokenError {
    #[msg("Invalid token parameters")]
    InvalidTokenParams,
    
    #[msg("Token name too long")]
    TokenNameTooLong,
    
    #[msg("Token symbol too long")]
    TokenSymbolTooLong,
    
    #[msg("Invalid decimal places")]
    InvalidDecimals,
    
    #[msg("Supply limit exceeded")]
    SupplyLimitExceeded,
    
    #[msg("Transfer fee too high")]
    TransferFeeTooHigh,
    
    #[msg("Insufficient balance for operation")]
    InsufficientBalance,
    
    #[msg("Token is frozen")]
    TokenFrozen,
    
    #[msg("Mint authority required")]
    MintAuthorityRequired,
    
    #[msg("Metadata update failed")]
    MetadataUpdateFailed,
}
```

### 2. 参数验证

```rust
pub fn validate_token_params(params: &CreateTokenParams) -> Result<()> {
    // 名称长度检查
    require!(
        params.name.len() <= 32,
        TokenError::TokenNameTooLong
    );
    
    // 符号长度检查
    require!(
        params.symbol.len() <= 10,
        TokenError::TokenSymbolTooLong
    );
    
    // 小数位数检查
    require!(
        params.decimals <= 9,
        TokenError::InvalidDecimals
    );
    
    // 转账费用检查
    require!(
        params.transfer_fee_basis_points <= MAX_TRANSFER_FEE_BASIS_POINTS,
        TokenError::TransferFeeTooHigh
    );
    
    // 供应量检查
    if params.token_type == TokenType::AIW3Token {
        require!(
            params.initial_supply <= TOTAL_SUPPLY,
            TokenError::SupplyLimitExceeded
        );
    }
    
    Ok(())
}
```

## 最佳实践

### 1. 代币配置建议

- 使用合理的转账费用（通常 0.1% - 1%）
- 设置适当的最大费用限制
- 保留足够的管理权限用于紧急情况
- 定期审查和更新元数据

### 2. 安全建议

- 使用多重签名管理关键权限
- 定期备份私钥和配置
- 监控异常的铸造和销毁活动
- 建立紧急响应机制

### 3. 运维建议

- 监控代币供应量变化
- 跟踪转账费用收入
- 定期检查权限配置
- 建立操作日志和审计机制 