# AMM 智能合约文档

## 概述

AMM (Automated Market Maker) 模块负责管理代币交换池的流动性，支持 AIW3 Token 和 AI Agent Token 之间的自动化市场做市。该模块提供流动性池创建、流动性添加/移除、以及池参数管理等功能。

## 核心功能

### 1. 流动性池管理
- 双池架构（内部池/外部池）
- 自动流动性平衡
- 价格影响控制
- 最小流动性保护

### 2. 流动性提供
- LP 代币机制
- 比例化添加/移除
- 手续费分配
- 无常损失保护

### 3. 池状态监控
- 储备量跟踪
- 价格监控
- 交易量统计
- 性能指标

## 主要指令

### 1. CreatePool 指令

**功能**: 创建新的流动性池

**参数**:
```rust
pub struct CreatePoolParams {
    pub pool_type: String,               // 池类型 ("internal" 或 "external")
    pub initial_aiw3_amount: u64,        // 初始 AIW3 数量
    pub initial_ai_agent_amount: u64,    // 初始 AI Agent 数量
    pub fee_basis_points: u16,           // 交易手续费基点
}
```

**账户结构**:
```rust
#[derive(Accounts)]
#[instruction(params: CreatePoolParams)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(seeds = [CONFIG_SEEDS_PREFIX], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + SwapPool::INIT_SPACE,
        seeds = [
            SWAP_POOL_SEEDS_PREFIX,
            params.pool_type.as_bytes(),
            aiw3_token_mint.key().as_ref(),
            ai_agent_token_mint.key().as_ref()
        ],
        bump
    )]
    pub swap_pool: Box<Account<'info, SwapPool>>,
    
    pub aiw3_token_mint: Box<Account<'info, Mint>>,
    pub ai_agent_token_mint: Box<Account<'info, Mint>>,
    
    // 流动性提供者代币账户
    #[account(
        mut,
        associated_token::mint = aiw3_token_mint,
        associated_token::authority = creator
    )]
    pub creator_aiw3_account: Box<Account<'info, TokenAccount>>,
    
    #[account(
        mut,
        associated_token::mint = ai_agent_token_mint,
        associated_token::authority = creator
    )]
    pub creator_ai_agent_account: Box<Account<'info, TokenAccount>>,
    
    // 池金库账户
    #[account(
        init,
        payer = creator,
        seeds = [
            TOKEN_VAULT_SEEDS_PREFIX,
            swap_pool.key().as_ref(),
            aiw3_token_mint.key().as_ref()
        ],
        bump,
        token::mint = aiw3_token_mint,
        token::authority = swap_pool
    )]
    pub aiw3_token_vault: Box<Account<'info, TokenAccount>>,
    
    #[account(
        init,
        payer = creator,
        seeds = [
            TOKEN_VAULT_SEEDS_PREFIX,
            swap_pool.key().as_ref(),
            ai_agent_token_mint.key().as_ref()
        ],
        bump,
        token::mint = ai_agent_token_mint,
        token::authority = swap_pool
    )]
    pub ai_agent_token_vault: Box<Account<'info, TokenAccount>>,
    
    // LP 代币
    #[account(
        init,
        payer = creator,
        seeds = [
            b"lp_token",
            swap_pool.key().as_ref()
        ],
        bump,
        mint::decimals = 6,
        mint::authority = swap_pool
    )]
    pub lp_token_mint: Box<Account<'info, Mint>>,
    
    #[account(
        init,
        payer = creator,
        associated_token::mint = lp_token_mint,
        associated_token::authority = creator
    )]
    pub creator_lp_account: Box<Account<'info, TokenAccount>>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

**实现逻辑**:

```rust
impl CreatePool<'_> {
    pub fn apply(ctx: &mut Context<Self>, params: &CreatePoolParams) -> Result<()> {
        let swap_pool = &mut ctx.accounts.swap_pool;
        
        // 1. 权限验证
        require!(
            ctx.accounts.creator.key() == ctx.accounts.config.admin ||
            ctx.accounts.creator.key() == ctx.accounts.config.operator,
            ErrorCode::Unauthorized
        );
        
        // 2. 参数验证
        validate_pool_params(&params)?;
        
        // 3. 初始化池状态
        swap_pool.pool_type = params.pool_type.clone();
        swap_pool.aiw3_token_mint = ctx.accounts.aiw3_token_mint.key();
        swap_pool.ai_agent_token_mint = ctx.accounts.ai_agent_token_mint.key();
        swap_pool.aiw3_token_vault = ctx.accounts.aiw3_token_vault.key();
        swap_pool.ai_agent_token_vault = ctx.accounts.ai_agent_token_vault.key();
        swap_pool.lp_token_mint = ctx.accounts.lp_token_mint.key();
        swap_pool.fee_basis_points = params.fee_basis_points;
        swap_pool.aiw3_reserves = 0;
        swap_pool.ai_agent_reserves = 0;
        swap_pool.lp_token_supply = 0;
        swap_pool.is_locked = false;
        swap_pool.bump = ctx.bumps.swap_pool;
        
        // 4. 添加初始流动性
        if params.initial_aiw3_amount > 0 && params.initial_ai_agent_amount > 0 {
            add_initial_liquidity(ctx, &params)?;
        }
        
        // 5. 发出事件
        emit!(PoolCreatedEvent {
            creator: ctx.accounts.creator.key(),
            pool: swap_pool.key(),
            pool_type: params.pool_type.clone(),
            aiw3_mint: ctx.accounts.aiw3_token_mint.key(),
            ai_agent_mint: ctx.accounts.ai_agent_token_mint.key(),
            initial_aiw3_amount: params.initial_aiw3_amount,
            initial_ai_agent_amount: params.initial_ai_agent_amount,
        });
        
        Ok(())
    }
}
```

### 2. AddLiquidity 指令

**功能**: 向流动性池添加流动性

**参数**:
```rust
pub struct AddLiquidityParams {
    pub aiw3_amount: u64,                // AIW3 数量
    pub ai_agent_amount: u64,            // AI Agent 数量
    pub min_lp_tokens: u64,              // 最小 LP 代币数量
}
```

**核心算法**:

```rust
pub fn calculate_lp_tokens_to_mint(
    aiw3_amount: u64,
    ai_agent_amount: u64,
    aiw3_reserves: u64,
    ai_agent_reserves: u64,
    lp_supply: u64,
) -> Result<u64> {
    if lp_supply == 0 {
        // 初始流动性：使用几何平均数
        let lp_tokens = (aiw3_amount as u128)
            .checked_mul(ai_agent_amount as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // 计算平方根
        let lp_tokens = sqrt(lp_tokens)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // 减去最小流动性锁定
        Ok(lp_tokens.saturating_sub(MINIMUM_LIQUIDITY))
    } else {
        // 现有流动性：按比例计算
        let lp_from_aiw3 = (aiw3_amount as u128)
            .checked_mul(lp_supply as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(aiw3_reserves as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let lp_from_ai_agent = (ai_agent_amount as u128)
            .checked_mul(lp_supply as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(ai_agent_reserves as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // 取较小值确保比例正确
        Ok(std::cmp::min(lp_from_aiw3, lp_from_ai_agent) as u64)
    }
}
```

### 3. RemoveLiquidity 指令

**功能**: 从流动性池移除流动性

**参数**:
```rust
pub struct RemoveLiquidityParams {
    pub lp_token_amount: u64,            // LP 代币数量
    pub min_aiw3_amount: u64,            // 最小 AIW3 数量
    pub min_ai_agent_amount: u64,        // 最小 AI Agent 数量
}
```

**核心算法**:

```rust
pub fn calculate_tokens_to_withdraw(
    lp_token_amount: u64,
    lp_total_supply: u64,
    aiw3_reserves: u64,
    ai_agent_reserves: u64,
) -> Result<(u64, u64)> {
    let aiw3_amount = (lp_token_amount as u128)
        .checked_mul(aiw3_reserves as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(lp_total_supply as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    let ai_agent_amount = (lp_token_amount as u128)
        .checked_mul(ai_agent_reserves as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(lp_total_supply as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    Ok((aiw3_amount, ai_agent_amount))
}
```

## 池类型管理

### 1. 内部池 (Internal Pool)

**特性**:
- 用于系统内部交换
- 较低的手续费率
- 优先流动性分配
- 紧密价格控制

**配置**:
```rust
pub const INTERNAL_POOL_CONFIG: PoolConfig = PoolConfig {
    pool_type: "internal",
    default_fee_bp: 20,      // 0.2%
    min_reserves: 10_000_000, // 10 tokens minimum
    max_price_impact: 200,   // 2% max price impact
    priority: 1,             // High priority
};
```

### 2. 外部池 (External Pool)

**特性**:
- 对外部 DEX 开放
- 标准手续费率
- 常规流动性管理
- 市场价格跟踪

**配置**:
```rust
pub const EXTERNAL_POOL_CONFIG: PoolConfig = PoolConfig {
    pool_type: "external",
    default_fee_bp: 30,      // 0.3%
    min_reserves: 5_000_000, // 5 tokens minimum
    max_price_impact: 500,   // 5% max price impact
    priority: 2,             // Normal priority
};
```

## 价格机制

### 1. 恒定乘积公式

```rust
pub fn calculate_constant_product_output(
    input_amount: u64,
    input_reserve: u64,
    output_reserve: u64,
    fee_basis_points: u16,
) -> Result<u64> {
    // 扣除手续费
    let input_amount_after_fee = input_amount
        .checked_mul(10000_u64.saturating_sub(fee_basis_points as u64))
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 计算输出数量: output = (input * output_reserve) / (input_reserve + input)
    let numerator = (input_amount_after_fee as u128)
        .checked_mul(output_reserve as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    
    let denominator = (input_reserve as u128)
        .checked_add(input_amount_after_fee as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    
    let output_amount = numerator
        .checked_div(denominator)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    Ok(output_amount)
}
```

### 2. 价格影响计算

```rust
pub fn calculate_price_impact(
    input_amount: u64,
    input_reserve: u64,
    output_amount: u64,
    output_reserve: u64,
) -> Result<u16> {
    // 计算交换前价格
    let price_before = (output_reserve as u128)
        .checked_mul(PRICE_PRECISION as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(input_reserve as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 计算交换后价格
    let new_input_reserve = input_reserve.checked_add(input_amount)
        .ok_or(ErrorCode::MathOverflow)?;
    let new_output_reserve = output_reserve.checked_sub(output_amount)
        .ok_or(ErrorCode::MathOverflow)?;
    
    let price_after = (new_output_reserve as u128)
        .checked_mul(PRICE_PRECISION as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(new_input_reserve as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 计算价格影响百分比
    let price_impact = if price_before > price_after {
        (price_before.saturating_sub(price_after))
            .checked_mul(10000)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(price_before)
            .ok_or(ErrorCode::MathOverflow)?
    } else {
        0
    };
    
    Ok(price_impact as u16)
}
```

## 流动性激励机制

### 1. 手续费分配

```rust
pub fn distribute_trading_fees(
    ctx: &Context<DistributeFees>,
    fee_amount: u64,
) -> Result<()> {
    let swap_pool = &ctx.accounts.swap_pool;
    
    // 70% 给流动性提供者
    let lp_fee = fee_amount
        .checked_mul(70)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 20% 给协议金库
    let protocol_fee = fee_amount
        .checked_mul(20)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 10% 给开发团队
    let dev_fee = fee_amount.saturating_sub(lp_fee).saturating_sub(protocol_fee);
    
    // 分配费用
    accumulate_lp_fees(swap_pool, lp_fee)?;
    transfer_protocol_fees(ctx, protocol_fee)?;
    transfer_dev_fees(ctx, dev_fee)?;
    
    Ok(())
}
```

### 2. LP 奖励计算

```rust
pub fn calculate_lp_rewards(
    lp_balance: u64,
    total_lp_supply: u64,
    accumulated_fees: u64,
) -> Result<u64> {
    if total_lp_supply == 0 {
        return Ok(0);
    }
    
    let reward = (lp_balance as u128)
        .checked_mul(accumulated_fees as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(total_lp_supply as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    Ok(reward)
}
```

## 风险管理

### 1. 滑点保护

```rust
pub fn validate_slippage(
    expected_output: u64,
    actual_output: u64,
    max_slippage_bp: u16,
) -> Result<()> {
    let slippage = if expected_output > actual_output {
        (expected_output.saturating_sub(actual_output) as u128)
            .checked_mul(10000)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(expected_output as u128)
            .ok_or(ErrorCode::MathOverflow)? as u16
    } else {
        0
    };
    
    require!(
        slippage <= max_slippage_bp,
        ErrorCode::SlippageExceeded
    );
    
    Ok(())
}
```

### 2. 最小流动性保护

```rust
pub fn validate_minimum_liquidity(
    aiw3_reserves: u64,
    ai_agent_reserves: u64,
) -> Result<()> {
    require!(
        aiw3_reserves >= MIN_POOL_RESERVES,
        ErrorCode::InsufficientLiquidity
    );
    
    require!(
        ai_agent_reserves >= MIN_POOL_RESERVES,
        ErrorCode::InsufficientLiquidity
    );
    
    Ok(())
}
```

### 3. 价格影响限制

```rust
pub fn validate_price_impact(
    price_impact: u16,
    max_price_impact: u16,
) -> Result<()> {
    require!(
        price_impact <= max_price_impact,
        ErrorCode::PriceImpactTooHigh
    );
    
    Ok(())
}
```

## 池状态监控

### 1. 储备量跟踪

```rust
#[account]
pub struct PoolMetrics {
    pub pool: Pubkey,
    pub total_volume_aiw3: u64,      // 累计 AIW3 交易量
    pub total_volume_ai_agent: u64,  // 累计 AI Agent 交易量
    pub total_fees_collected: u64,   // 累计手续费
    pub total_swaps: u64,            // 累计交换次数
    pub average_trade_size: u64,     // 平均交易规模
    pub last_price: u64,             // 最新价格
    pub price_volatility: u16,       // 价格波动率
    pub liquidity_utilization: u16,  // 流动性利用率
}
```

### 2. 性能指标计算

```rust
pub fn update_pool_metrics(
    metrics: &mut PoolMetrics,
    trade_amount: u64,
    fee_amount: u64,
    new_price: u64,
) -> Result<()> {
    // 更新交易量
    metrics.total_volume_aiw3 = metrics.total_volume_aiw3
        .checked_add(trade_amount)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 更新手续费
    metrics.total_fees_collected = metrics.total_fees_collected
        .checked_add(fee_amount)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 更新交换次数
    metrics.total_swaps = metrics.total_swaps
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 更新平均交易规模
    metrics.average_trade_size = metrics.total_volume_aiw3
        .checked_div(metrics.total_swaps)
        .unwrap_or(0);
    
    // 更新价格波动率
    if metrics.last_price > 0 {
        let price_change = if new_price > metrics.last_price {
            new_price.saturating_sub(metrics.last_price)
        } else {
            metrics.last_price.saturating_sub(new_price)
        };
        
        let volatility = (price_change as u128)
            .checked_mul(10000)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(metrics.last_price as u128)
            .ok_or(ErrorCode::MathOverflow)? as u16;
        
        // 使用指数移动平均
        metrics.price_volatility = (metrics.price_volatility as u128)
            .checked_mul(9)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_add(volatility as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10)
            .ok_or(ErrorCode::MathOverflow)? as u16;
    }
    
    metrics.last_price = new_price;
    
    Ok(())
}
```

## 事件系统

### 1. 池创建事件

```rust
#[event]
pub struct PoolCreatedEvent {
    pub creator: Pubkey,
    pub pool: Pubkey,
    pub pool_type: String,
    pub aiw3_mint: Pubkey,
    pub ai_agent_mint: Pubkey,
    pub initial_aiw3_amount: u64,
    pub initial_ai_agent_amount: u64,
}
```

### 2. 流动性事件

```rust
#[event]
pub struct LiquidityAddedEvent {
    pub provider: Pubkey,
    pub pool: Pubkey,
    pub aiw3_amount: u64,
    pub ai_agent_amount: u64,
    pub lp_tokens_minted: u64,
}

#[event]
pub struct LiquidityRemovedEvent {
    pub provider: Pubkey,
    pub pool: Pubkey,
    pub lp_tokens_burned: u64,
    pub aiw3_amount: u64,
    pub ai_agent_amount: u64,
}
```

### 3. 费用分配事件

```rust
#[event]
pub struct FeesDistributedEvent {
    pub pool: Pubkey,
    pub total_fees: u64,
    pub lp_fees: u64,
    pub protocol_fees: u64,
    pub dev_fees: u64,
}
```

## 错误处理

```rust
#[error_code]
pub enum AMMError {
    #[msg("Invalid pool parameters")]
    InvalidPoolParams,
    
    #[msg("Insufficient liquidity in pool")]
    InsufficientLiquidity,
    
    #[msg("Price impact too high")]
    PriceImpactTooHigh,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    
    #[msg("Pool ratio imbalanced")]
    PoolRatioImbalanced,
    
    #[msg("Minimum liquidity not met")]
    MinimumLiquidityNotMet,
    
    #[msg("LP token balance insufficient")]
    InsufficientLPBalance,
    
    #[msg("Pool already exists")]
    PoolAlreadyExists,
    
    #[msg("Pool not found")]
    PoolNotFound,
    
    #[msg("Invalid pool type")]
    InvalidPoolType,
}
```

## 最佳实践

### 1. 流动性提供建议

- 提供平衡的双边流动性
- 监控无常损失风险
- 定期重新平衡持仓
- 关注手续费收入

### 2. 风险管理

- 设置合理的滑点保护
- 监控价格影响
- 分散流动性提供
- 建立止损机制

### 3. 池管理

- 定期监控池状态
- 调整手续费参数
- 管理流动性激励
- 维护价格稳定 