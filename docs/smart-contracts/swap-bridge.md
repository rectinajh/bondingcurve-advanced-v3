# Swap Bridge 智能合约文档

## 概述

Swap Bridge 是 Token Swap Program 的核心交换模块，负责处理 AIW3 Token 和 AI Agent Token 之间的直接交换。该模块集成了 Pyth Oracle 价格数据，提供实时价格发现和安全的代币交换服务。

## 核心功能

### 1. 代币交换
- 支持 AIW3 ↔ AI Agent Token 双向交换
- 基于 Pyth Oracle 实时价格计算
- 自动手续费计算和扣除
- 滑点保护机制

### 2. 价格发现
- 集成 Pyth Oracle 实时价格流
- 价格有效性验证
- 价格年龄检查
- 异常价格处理

### 3. 安全保护
- 重入攻击保护
- 数学运算安全检查
- 输入参数验证
- 权限访问控制

## 主要指令

### 1. Swap 指令

**功能**: 执行代币交换操作

**参数**:
```rust
pub struct SwapParams {
    pub amount_in: u64,              // 输入代币数量
    pub minimum_amount_out: u64,     // 最小输出数量（滑点保护）
    pub input_is_aiw3: bool,         // 是否输入 AIW3 代币
}
```

**账户**:
```rust
#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(seeds = [CONFIG_SEEDS_PREFIX], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    
    #[account(
        mut,
        seeds = [
            SWAP_POOL_SEEDS_PREFIX,
            swap_pool.pool_type.as_bytes(),
            swap_pool.aiw3_token_mint.as_ref(),
            swap_pool.ai_agent_token_mint.as_ref()
        ],
        bump = swap_pool.bump
    )]
    pub swap_pool: Box<Account<'info, SwapPool>>,
    
    pub aiw3_token_mint: Box<Account<'info, Mint>>,
    pub ai_agent_token_mint: Box<Account<'info, Mint>>,
    
    // 用户代币账户
    #[account(
        mut,
        associated_token::mint = aiw3_token_mint,
        associated_token::authority = user
    )]
    pub user_aiw3_token_account: Box<Account<'info, TokenAccount>>,
    
    #[account(
        mut,
        associated_token::mint = ai_agent_token_mint,
        associated_token::authority = user
    )]
    pub user_ai_agent_token_account: Box<Account<'info, TokenAccount>>,
    
    // 池金库账户
    #[account(
        mut,
        seeds = [
            TOKEN_VAULT_SEEDS_PREFIX,
            swap_pool.key().as_ref(),
            aiw3_token_mint.key().as_ref()
        ],
        bump
    )]
    pub aiw3_token_vault: Box<Account<'info, TokenAccount>>,
    
    #[account(
        mut,
        seeds = [
            TOKEN_VAULT_SEEDS_PREFIX,
            swap_pool.key().as_ref(),
            ai_agent_token_mint.key().as_ref()
        ],
        bump
    )]
    pub ai_agent_token_vault: Box<Account<'info, TokenAccount>>,
    
    // 手续费接收账户
    #[account(
        mut,
        associated_token::mint = mop_mint,
        associated_token::authority = config.fee_recipient
    )]
    pub fee_recipient_mop_vault: Box<Account<'info, TokenAccount>>,
    
    pub mop_mint: Box<Account<'info, Mint>>,
    
    // Pyth Oracle 账户
    /// CHECK: This is validated in the instruction logic
    pub pyth_price_account: UncheckedAccount<'info>,
    
    // 程序
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

**实现逻辑**:

```rust
impl Swap<'_> {
    pub fn apply(ctx: &mut Context<Self>, params: &SwapParams) -> Result<()> {
        let swap_pool = &mut ctx.accounts.swap_pool;
        
        // 1. 重入保护
        require!(!swap_pool.is_locked, ErrorCode::PoolLocked);
        swap_pool.is_locked = true;
        
        // 2. 输入验证
        require!(params.amount_in > 0, ErrorCode::InvalidAmount);
        require!(
            params.amount_in >= MINIMUM_SWAP_AMOUNT,
            ErrorCode::AmountTooSmall
        );
        
        // 3. 获取 Oracle 价格
        let aiw3_price = get_pyth_price(&ctx.accounts.pyth_price_account)?;
        
        // 4. 计算输出数量
        let (amount_out_before_fee, fee_amount) = if params.input_is_aiw3 {
            // AIW3 -> AI Agent Token
            calculate_aiw3_to_agent_output(
                params.amount_in,
                aiw3_price,
                swap_pool.fee_basis_points,
            )?
        } else {
            // AI Agent Token -> AIW3
            calculate_agent_to_aiw3_output(
                params.amount_in,
                aiw3_price,
                swap_pool.fee_basis_points,
            )?
        };
        
        let amount_out = amount_out_before_fee.saturating_sub(fee_amount);
        
        // 5. 滑点保护
        require!(
            amount_out >= params.minimum_amount_out,
            ErrorCode::SlippageExceeded
        );
        
        // 6. 检查池储备
        if params.input_is_aiw3 {
            require!(
                ctx.accounts.ai_agent_token_vault.amount >= amount_out,
                ErrorCode::InsufficientLiquidity
            );
        } else {
            require!(
                ctx.accounts.aiw3_token_vault.amount >= amount_out,
                ErrorCode::InsufficientLiquidity
            );
        }
        
        // 7. 执行代币转移
        execute_swap_transfers(ctx, params, amount_out, fee_amount)?;
        
        // 8. 更新池状态
        update_pool_reserves(swap_pool, params, amount_out)?;
        
        // 9. 解除锁定
        swap_pool.is_locked = false;
        
        // 10. 发出事件
        emit!(SwapEvent {
            user: ctx.accounts.user.key(),
            pool: swap_pool.key(),
            input_is_aiw3: params.input_is_aiw3,
            amount_in: params.amount_in,
            amount_out,
            fee_amount,
            aiw3_price,
        });
        
        Ok(())
    }
}
```

## 核心算法

### 1. 价格获取算法

```rust
pub fn get_pyth_price(price_account: &UncheckedAccount) -> Result<u64> {
    let price_feed = load_price_feed_from_account_info(price_account)?;
    let current_timestamp = Clock::get()?.unix_timestamp;
    
    // 检查价格是否过期
    let price_age = current_timestamp.saturating_sub(price_feed.timestamp);
    require!(
        price_age <= MAXIMUM_AGE as i64,
        ErrorCode::PriceDataStale
    );
    
    // 获取价格
    let price = price_feed.get_current_price()
        .ok_or(ErrorCode::InvalidPriceData)?;
    
    // 价格范围检查
    require!(price.price > 0, ErrorCode::InvalidPriceData);
    require!(price.conf >= 0, ErrorCode::InvalidPriceData);
    
    // 转换为程序所需格式
    let normalized_price = normalize_price(price.price, price.expo)?;
    
    Ok(normalized_price)
}
```

### 2. 输出数量计算

```rust
pub fn calculate_aiw3_to_agent_output(
    amount_in: u64,
    aiw3_price: u64,
    fee_basis_points: u16,
) -> Result<(u64, u64)> {
    // 基本价值计算
    let base_value = amount_in
        .checked_mul(aiw3_price)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(PRICE_PRECISION)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 计算手续费
    let fee_amount = base_value
        .checked_mul(fee_basis_points as u64)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 输出数量
    let amount_out = base_value
        .checked_sub(fee_amount)
        .ok_or(ErrorCode::MathOverflow)?;
    
    Ok((amount_out, fee_amount))
}

pub fn calculate_agent_to_aiw3_output(
    amount_in: u64,
    aiw3_price: u64,
    fee_basis_points: u16,
) -> Result<(u64, u64)> {
    // 基本价值计算（反向）
    let base_value = amount_in
        .checked_mul(PRICE_PRECISION)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(aiw3_price)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 计算手续费
    let fee_amount = base_value
        .checked_mul(fee_basis_points as u64)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::MathOverflow)?;
    
    // 输出数量
    let amount_out = base_value
        .checked_sub(fee_amount)
        .ok_or(ErrorCode::MathOverflow)?;
    
    Ok((amount_out, fee_amount))
}
```

### 3. 代币转移执行

```rust
fn execute_swap_transfers(
    ctx: &mut Context<Swap>,
    params: &SwapParams,
    amount_out: u64,
    fee_amount: u64,
) -> Result<()> {
    let swap_pool = &ctx.accounts.swap_pool;
    let pool_seeds = &[
        SWAP_POOL_SEEDS_PREFIX,
        swap_pool.pool_type.as_bytes(),
        swap_pool.aiw3_token_mint.as_ref(),
        swap_pool.ai_agent_token_mint.as_ref(),
        &[swap_pool.bump],
    ];
    let signer_seeds = &[&pool_seeds[..]];
    
    if params.input_is_aiw3 {
        // 用户转入 AIW3
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_aiw3_token_account.to_account_info(),
                    to: ctx.accounts.aiw3_token_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            params.amount_in,
        )?;
        
        // 池转出 AI Agent Token
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.ai_agent_token_vault.to_account_info(),
                    to: ctx.accounts.user_ai_agent_token_account.to_account_info(),
                    authority: swap_pool.to_account_info(),
                },
                signer_seeds,
            ),
            amount_out,
        )?;
    } else {
        // 用户转入 AI Agent Token
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_ai_agent_token_account.to_account_info(),
                    to: ctx.accounts.ai_agent_token_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            params.amount_in,
        )?;
        
        // 池转出 AIW3
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.aiw3_token_vault.to_account_info(),
                    to: ctx.accounts.user_aiw3_token_account.to_account_info(),
                    authority: swap_pool.to_account_info(),
                },
                signer_seeds,
            ),
            amount_out,
        )?;
    }
    
    // 转移手续费到费用接收账户
    if fee_amount > 0 {
        // 实现费用转移逻辑
        transfer_fees(ctx, fee_amount, signer_seeds)?;
    }
    
    Ok(())
}
```

## 错误处理

### 1. 自定义错误码

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Pool is currently locked")]
    PoolLocked,
    
    #[msg("Invalid amount specified")]
    InvalidAmount,
    
    #[msg("Amount too small for swap")]
    AmountTooSmall,
    
    #[msg("Price data is stale")]
    PriceDataStale,
    
    #[msg("Invalid price data")]
    InvalidPriceData,
    
    #[msg("Math operation overflow")]
    MathOverflow,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    
    #[msg("Insufficient liquidity in pool")]
    InsufficientLiquidity,
    
    #[msg("Pool type mismatch")]
    PoolTypeMismatch,
    
    #[msg("Unauthorized access")]
    Unauthorized,
}
```

### 2. 错误处理策略

- **输入验证**: 所有用户输入都进行严格验证
- **数学安全**: 使用检查运算防止溢出
- **状态一致性**: 确保状态更新的原子性
- **回滚机制**: 错误时自动回滚状态变更

## 事件系统

### 1. SwapEvent

```rust
#[event]
pub struct SwapEvent {
    pub user: Pubkey,            // 用户地址
    pub pool: Pubkey,            // 池地址
    pub input_is_aiw3: bool,     // 输入代币类型
    pub amount_in: u64,          // 输入数量
    pub amount_out: u64,         // 输出数量
    pub fee_amount: u64,         // 手续费数量
    pub aiw3_price: u64,         // 使用的 AIW3 价格
}
```

## 安全考虑

### 1. 重入保护
- 使用池锁定机制防止重入攻击
- 操作开始时加锁，完成时解锁
- 异常情况下自动解锁

### 2. 数学安全
- 所有算术运算使用检查方法
- 防止整数溢出和下溢
- 精度损失处理

### 3. Oracle 安全
- 价格数据时效性检查
- 价格合理性验证
- 异常价格处理机制

### 4. 权限控制
- 严格的账户验证
- PDA 种子验证
- 签名者权限检查

## 性能优化

### 1. 计算优化
- 减少不必要的计算
- 使用高效的数学运算
- 最小化内存分配

### 2. 存储优化
- 紧凑的数据结构
- 减少账户读取次数
- 批量状态更新

### 3. Gas 优化
- 简化指令逻辑
- 减少跨程序调用
- 优化账户布局

## 测试策略

### 1. 单元测试
- 价格计算测试
- 数学运算测试
- 错误处理测试

### 2. 集成测试
- 完整交换流程测试
- Oracle 集成测试
- 多池交互测试

### 3. 压力测试
- 大额交换测试
- 极端价格测试
- 并发访问测试

## 监控指标

### 1. 交换指标
- 交换数量统计
- 交换金额统计
- 手续费收入统计

### 2. 性能指标
- 交换延迟
- 失败率
- Gas 消耗

### 3. 安全指标
- 异常交易检测
- 价格偏差监控
- 流动性监控

## 最佳实践

### 1. 使用建议
- 设置合理的滑点保护
- 监控 Oracle 价格有效性
- 定期检查池流动性

### 2. 风险管理
- 分散交换时间
- 避免大额单笔交换
- 关注价格波动

### 3. 故障处理
- 了解常见错误类型
- 准备备用交换方案
- 建立监控和告警机制 