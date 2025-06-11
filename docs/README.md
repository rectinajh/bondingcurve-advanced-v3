# Token Swap Program 文档中心

## 项目概述

Token Swap Program 是一个基于 Solana 区块链的去中心化代币交换系统，集成 Pyth Oracle 实现实时价格数据获取，支持 AIW3 Token 和 AI Agent Token 之间的直接交换。

## 文档结构

### 📚 核心文档

#### [系统架构](./architecture.md)
- 系统整体架构设计
- 核心组件介绍
- 技术栈说明
- 数据流设计

### 🔧 智能合约文档

#### [Swap Bridge 合约](./smart-contracts/swap-bridge.md)
- 代币交换核心模块
- Pyth Oracle 集成
- 价格发现机制
- 安全特性

#### [Token Management 合约](./smart-contracts/token-b.md)
- 代币创建和管理
- SPL Token 2022 支持
- 权限控制系统
- 手续费配置

#### [AMM 流动性管理](./smart-contracts/amm.md)
- 自动做市商机制
- 流动性池管理
- LP 代币发行
- 价格影响控制

### 🌐 API 参考

#### [REST API](./api-reference/rest-api.md)
- HTTP API 接口文档
- 认证和授权
- 错误处理
- SDK 集成示例

#### [WebSocket API](./api-reference/websocket-api.md)
- 实时数据订阅
- 事件推送机制
- 连接管理
- 消息格式规范

### 🚀 部署和运维

#### [部署指南](./deployment-guide.md)
- 环境要求和准备
- 智能合约部署
- API 服务部署
- 生产环境配置

#### [运维手册](./operations/)
- [监控手册](./operations/monitoring.md)
- [维护手册](./operations/maintenance.md)
- 故障排除指南
- 最佳实践

## 快速开始

### 开发环境搭建

1. **安装依赖**
   ```bash
   # 安装 Rust 和 Solana CLI
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
   
   # 安装 Anchor
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install latest && avm use latest
   ```

2. **克隆项目**
   ```bash
   git clone https://github.com/your-org/bondingcurve-advanced-v3.git
   cd bondingcurve-advanced-v3
   ```

3. **编译和部署**
   ```bash
   npm install
   anchor build
   anchor deploy --provider.cluster devnet
   ```

### API 使用示例

```typescript
import { TokenSwapAPI } from '@tokenswap/sdk';

const api = new TokenSwapAPI({
  baseURL: 'https://api.tokenswap.io',
  apiKey: 'your-api-key'
});

// 获取价格报价
const quote = await api.getQuote({
  fromToken: 'AIW3',
  toToken: 'AAT',
  amount: '1000000'
});

// 执行交换
const swap = await api.executeSwap({
  fromToken: 'AIW3',
  toToken: 'AAT',
  amountIn: '1000000',
  minAmountOut: quote.minAmountOut,
  slippage: 0.01
});
```

## 核心特性

### 🔄 代币交换
- **双向交换**: 支持 AIW3 ⇄ AI Agent Token
- **实时定价**: 集成 Pyth Oracle 获取实时价格
- **滑点保护**: 可配置的最大滑点限制
- **手续费优化**: 动态手续费调整机制

### 🏦 流动性管理
- **双池架构**: 内部池 + 外部池设计
- **自动平衡**: 智能流动性平衡算法
- **LP 奖励**: 流动性提供者激励机制
- **风险控制**: 多层级风险管理

### 🔐 安全特性
- **重入攻击防护**: 防止重入攻击的安全机制
- **权限分离**: 多级权限管理系统
- **紧急暂停**: 紧急情况下的系统暂停功能
- **审计日志**: 完整的操作审计追踪

### 📊 监控和分析
- **实时监控**: 全面的系统和业务指标监控
- **性能分析**: API 性能和响应时间分析
- **业务洞察**: 交易量、用户活动等业务数据
- **告警通知**: 多渠道告警通知机制

## 技术栈

### 区块链层
- **Solana**: 高性能区块链平台
- **Anchor**: Solana 程序开发框架
- **SPL Token 2022**: 代币标准
- **Pyth Oracle**: 去中心化价格预言机

### 后端服务
- **Node.js**: 服务端运行时
- **TypeScript**: 编程语言
- **Express.js**: Web 框架
- **WebSocket**: 实时通信

### 数据存储
- **PostgreSQL**: 主数据库
- **Redis**: 缓存和会话存储
- **Prometheus**: 指标数据存储
- **Elasticsearch**: 日志存储和搜索

### 基础设施
- **Docker**: 容器化部署
- **Nginx**: 反向代理和负载均衡
- **Grafana**: 监控可视化
- **Jaeger**: 分布式链路追踪

## 版本历史

### v3.0.0 (当前版本)
- 完全重构的架构设计
- 集成 Pyth Oracle 价格数据
- 支持 Token 2022 标准
- 增强的安全特性

### v2.0.0
- 双池流动性架构
- WebSocket 实时数据推送
- 改进的 API 设计

### v1.0.0
- 基础代币交换功能
- 基本的流动性管理
- REST API 接口

## 贡献指南

### 开发流程
1. Fork 项目仓库
2. 创建功能分支
3. 提交代码变更
4. 创建 Pull Request
5. 代码审查和合并

### 代码规范
- 使用 TypeScript 和 Rust
- 遵循 ESLint 和 Rustfmt 规范
- 编写单元测试和集成测试
- 更新相关文档

### 问题报告
- 使用 GitHub Issues 报告问题
- 提供详细的问题描述和重现步骤
- 包含相关的日志和错误信息

## 社区和支持

### 联系方式
- **技术支持**: support@tokenswap.io
- **商务合作**: business@tokenswap.io
- **安全问题**: security@tokenswap.io

### 社交媒体
- **Twitter**: [@TokenSwapIO](https://twitter.com/TokenSwapIO)
- **Discord**: [TokenSwap Community](https://discord.gg/tokenswap)
- **Telegram**: [TokenSwap Official](https://t.me/tokenswap)

### 开发者资源
- **GitHub**: [源代码仓库](https://github.com/tokenswap)
- **NPM**: [SDK 包](https://www.npmjs.com/package/@tokenswap/sdk)
- **文档**: [开发者文档](https://docs.tokenswap.io)

## 许可证

本项目采用 MIT 许可证。详情请参见 [LICENSE](../LICENSE) 文件。

---

*文档最后更新: 2024年1月15日*  
*版本: v1.0*  
*维护者: TokenSwap 开发团队* 