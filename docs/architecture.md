# 系统架构文档

## 概述

Token Swap Program 是一个基于 Solana 区块链的去中心化代币交换系统，集成了 Pyth Oracle 实时价格数据，支持 AIW3 Token 和 AI Agent Token 之间的直接交换。该系统从复杂的联合曲线机制简化为基于 Oracle 价格的直接交换模式。

## 核心架构

### 1. 程序架构层次

```
┌─────────────────────────────────────────────────────────────┐
│                     应用层 (Application Layer)                 │
├─────────────────────────────────────────────────────────────┤
│  Web UI / SDK    │  CLI Tools   │  Third-party Integrations  │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    接口层 (Interface Layer)                   │
├─────────────────────────────────────────────────────────────┤
│       RPC Endpoints       │        REST API Services         │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    业务逻辑层 (Business Logic)                 │
├─────────────────────────────────────────────────────────────┤
│  Swap Logic  │ Pool Management │ Fee Calculation │ Validation │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (Data Layer)                        │
├─────────────────────────────────────────────────────────────┤
│   Config State   │  SwapPool State  │  Token Accounts       │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                   基础设施层 (Infrastructure)                  │
├─────────────────────────────────────────────────────────────┤
│  Solana Runtime  │  Token Program  │  Pyth Oracle Network   │
└─────────────────────────────────────────────────────────────┘
```

### 2. 核心组件

#### 2.1 智能合约 (Solana Program)
- **Program ID**: 主程序标识符
- **Instructions**: 程序指令集合
- **State Management**: 程序状态管理
- **Error Handling**: 错误处理机制

#### 2.2 状态管理
- **Config**: 全局配置状态
- **SwapPool**: 交换池状态
- **Token Accounts**: 代币账户管理

#### 2.3 外部集成
- **Pyth Oracle**: 实时价格数据源
- **Token Program**: Solana Token 2022 支持
- **Associated Token Program**: 关联代币账户

## 详细组件设计

### 1. Config 配置组件

```rust
pub struct Config {
    pub admin: Pubkey,                    // 管理员地址
    pub operator: Pubkey,                 // 操作员地址
    pub fee_recipient: Pubkey,            // 手续费接收地址
    pub mop_mint: Pubkey,                 // MOP 代币地址
    pub trade_fee_basis_points: u16,      // 交易手续费 (基点)
    pub pump_fee: u64,                    // 泵费用
    pub bump: u8,                         // PDA bump seed
}
```

**职责**:
- 全局系统参数管理
- 管理员权限控制
- 手续费配置
- 系统升级控制

### 2. SwapPool 交换池组件

```rust
pub struct SwapPool {
    pub pool_type: String,                // 池类型 (internal/external)
    pub aiw3_token_mint: Pubkey,         // AIW3 代币地址
    pub ai_agent_token_mint: Pubkey,     // AI Agent 代币地址
    pub aiw3_token_vault: Pubkey,        // AIW3 代币金库
    pub ai_agent_token_vault: Pubkey,    // AI Agent 代币金库
    pub aiw3_reserves: u64,              // AIW3 储备量
    pub ai_agent_reserves: u64,          // AI Agent 储备量
    pub fee_basis_points: u16,           // 手续费基点
    pub is_locked: bool,                 // 重入锁
    pub bump: u8,                        // PDA bump seed
}
```

**职责**:
- 流动性管理
- 价格计算
- 交换执行
- 重入保护

### 3. Oracle 价格集成

```rust
// Pyth Oracle 集成
pub const AW3_FEED_ID: &str = "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix";
pub const MAXIMUM_AGE: u64 = 300; // 5分钟最大延迟
```

**功能**:
- 实时 AW3 价格获取
- 价格有效性验证
- 价格年龄检查
- 异常价格处理

## 指令架构

### 1. 管理指令
- **Initialize**: 初始化程序配置
- **Update Config**: 更新程序配置
- **Transfer Ownership**: 转移所有权

### 2. 池管理指令
- **Create Pool**: 创建交换池
- **Create Token**: 创建代币

### 3. 交换指令
- **Swap**: 执行代币交换

## 数据流设计

### 1. 交换流程

```
用户发起交换 
    ↓
验证输入参数
    ↓
获取 Oracle 价格
    ↓
计算输出数量
    ↓
验证滑点保护
    ↓
执行代币转移
    ↓
更新池状态
    ↓
发出事件
```

### 2. 价格计算流程

```
获取 Pyth 价格数据
    ↓
验证价格时效性
    ↓
计算汇率
    ↓
应用手续费
    ↓
计算最终输出
```

## 安全架构

### 1. 五层安全框架

1. **输入验证层**: 参数完整性检查
2. **权限验证层**: 账户权限验证
3. **业务逻辑层**: 业务规则验证
4. **状态一致性层**: 状态更新验证
5. **重入保护层**: 防止重入攻击

### 2. 安全特性

- **Oracle 验证**: 价格数据验证和边界检查
- **数学安全**: 溢出保护和检查操作
- **重入保护**: 池锁定机制
- **输入验证**: 全面参数验证
- **类型安全**: 基于枚举的验证

## 性能优化

### 1. 代码优化
- **75% 代码减少**: 从 1000+ 行简化到 400+ 行
- **60% 状态减少**: 简化数据结构
- **Gas 优化**: 减少指令复杂度
- **单次 Oracle 查询**: 高效价格检索

### 2. 存储优化
- 最小化状态存储
- 优化账户大小
- 减少计算开销

## 扩展性设计

### 1. 模块化架构
- 指令模块化
- 状态模块化
- 工具函数模块化

### 2. 配置灵活性
- 可配置手续费
- 可配置管理员
- 可配置 Oracle 参数

### 3. 升级机制
- 程序升级支持
- 配置热更新
- 兼容性保证

## 监控与运维

### 1. 事件系统
- 交换事件
- 配置更新事件
- 错误事件

### 2. 状态监控
- 池储备监控
- 价格偏差监控
- 系统健康检查

### 3. 紧急处理
- 管理员控制
- 紧急暂停机制
- 故障恢复流程

## 技术栈

### 1. 区块链技术
- **Solana**: 区块链平台
- **Anchor**: 开发框架
- **SPL Token 2022**: 代币标准
- **Pyth Network**: 价格 Oracle

### 2. 开发工具
- **Rust**: 智能合约语言
- **TypeScript**: 客户端开发
- **Anchor CLI**: 部署工具
- **Solana CLI**: 区块链工具

### 3. 测试框架
- **Anchor Test**: 集成测试
- **Rust Test**: 单元测试
- **Mocha**: JavaScript 测试

## 版本演进

### V1.x.x → V2.0.0 迁移
- 从联合曲线到简单交换
- Oracle 集成替代复杂定价
- Token 2022 支持
- 安全性增强
- 性能优化

## 总结

该系统通过简化的架构设计，提供了一个安全、高效、易于维护的代币交换平台。通过 Pyth Oracle 集成和 Token 2022 支持，系统能够提供准确的价格发现和现代代币功能支持。 