# REST API 参考文档

## 概述

Token Swap Program 提供一套完整的 REST API，用于与智能合约交互、查询链上数据、获取价格信息和监控系统状态。API 设计遵循 RESTful 原则，支持 JSON 格式数据交换。

## 基础信息

### 基础 URL
```
Production: https://api.tokenswap.io/v1
Testnet: https://api-testnet.tokenswap.io/v1
Devnet: https://api-devnet.tokenswap.io/v1
```

### 认证
API 支持多种认证方式：
- API Key（推荐用于服务端）
- JWT Token（推荐用于前端应用）
- 钱包签名（用于敏感操作）

### 请求头
```http
Content-Type: application/json
Authorization: Bearer <your-api-key>
X-API-Version: v1
```

### 响应格式
所有响应都遵循统一格式：
```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_1234567890abcdef"
}
```

## 配置管理 API

### 获取系统配置

**GET** `/config`

获取当前系统配置信息。

**响应示例**:
```json
{
  "success": true,
  "data": {
    "admin": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "operator": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3",
    "fee_recipient": "3k5G8h2Kz9P6cV7nR4qS8fH9jN2mL5xB1wE3tY6uI8oP",
    "mop_mint": "2j4F6g1Jw8N5eQ9mS3rH7kL2nB5xV9cD4pT8yU2iO6aZ",
    "trade_fee_basis_points": 30,
    "pump_fee": 0,
    "supported_tokens": [
      {
        "mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
        "name": "AIW3 Token",
        "symbol": "AIW3",
        "decimals": 6
      },
      {
        "mint": "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M",
        "name": "AI Agent Token",
        "symbol": "AAT",
        "decimals": 6
      }
    ]
  }
}
```

### 更新系统配置

**PUT** `/config`

更新系统配置（需要管理员权限）。

**请求体**:
```json
{
  "trade_fee_basis_points": 25,
  "pump_fee": 1000000,
  "signature": "3k7QmN9pL2bV8xR4jH6fW1eZ5yT3nK8cD2vB7mS9oI4uP..."
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "2Z5k8nW9r4tQ7mH3xL6vB1cF9eS2yI8oP5uN3jK7dG4aR",
    "updated_fields": ["trade_fee_basis_points", "pump_fee"],
    "effective_immediately": true
  }
}
```

## 代币管理 API

### 获取代币信息

**GET** `/tokens/{mint}`

获取特定代币的详细信息。

**路径参数**:
- `mint`: 代币地址

**响应示例**:
```json
{
  "success": true,
  "data": {
    "mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
    "name": "AIW3 Token",
    "symbol": "AIW3",
    "decimals": 6,
    "supply": "1000000000000000",
    "max_supply": "1000000000000000",
    "is_mintable": false,
    "is_freezable": true,
    "transfer_fee_config": {
      "transfer_fee_basis_points": 50,
      "maximum_fee": "1000000"
    },
    "metadata": {
      "uri": "https://metadata.tokenswap.io/aiw3.json",
      "image": "https://assets.tokenswap.io/aiw3.png",
      "description": "AIW3 is the primary token for the Token Swap ecosystem"
    },
    "authorities": {
      "mint_authority": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "freeze_authority": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    }
  }
}
```

### 创建新代币

**POST** `/tokens`

创建新的代币（需要操作员权限）。

**请求体**:
```json
{
  "name": "New AI Token",
  "symbol": "NAT",
  "decimals": 6,
  "initial_supply": "100000000000000",
  "transfer_fee_basis_points": 30,
  "max_fee": "500000",
  "token_type": "AIAgentToken",
  "metadata": {
    "uri": "https://metadata.tokenswap.io/nat.json",
    "description": "New AI Token for specific use case"
  },
  "signature": "5j8KmP2nL9bW3xS6rH4fV7gN1eZ8yT2nK5cD9vB4mS3oI7uQ..."
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "mint": "8mR3qY6kL2vB9xJ4fH7nW5eP2tS8cZ1dQ3oI6uN9aK4sL",
    "transaction_id": "3Z7nB2mK9pQ4jH6xL8vR5cF2eW1yT4nS7oI3uP9dG6aM",
    "admin_token_account": "6K2nB9mQ8pY4jH7xL5vR3cF1eW9yT2nS4oI6uP7dG5aK",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### 获取代币余额

**GET** `/tokens/{mint}/balance/{owner}`

获取特定用户的代币余额。

**路径参数**:
- `mint`: 代币地址
- `owner`: 用户钱包地址

**响应示例**:
```json
{
  "success": true,
  "data": {
    "owner": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3",
    "mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
    "balance": "5000000000",
    "decimals": 6,
    "formatted_balance": "5000.000000",
    "token_account": "2J5g8H3kL9mN6pQ4rS7fW2eZ1yT8nK3cD5vB9oI4uP7aG",
    "is_frozen": false
  }
}
```

## 交换池 API

### 获取所有交换池

**GET** `/pools`

获取所有可用的交换池列表。

**查询参数**:
- `pool_type`: 池类型筛选 (internal/external)
- `active_only`: 仅显示活跃池 (true/false)
- `limit`: 返回数量限制 (默认: 50)
- `offset`: 分页偏移量 (默认: 0)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "pools": [
      {
        "address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
        "pool_type": "internal",
        "aiw3_token_mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
        "ai_agent_token_mint": "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M",
        "aiw3_reserves": "10000000000000",
        "ai_agent_reserves": "8000000000000",
        "lp_token_supply": "8944271909999",
        "fee_basis_points": 20,
        "current_price": "0.800000",
        "24h_volume": "50000000000",
        "24h_fees": "100000000",
        "total_liquidity_usd": "18000.00",
        "is_active": true
      }
    ],
    "total_count": 2,
    "has_more": false
  }
}
```

### 获取特定交换池信息

**GET** `/pools/{pool_address}`

获取特定交换池的详细信息。

**路径参数**:
- `pool_address`: 交换池地址

**响应示例**:
```json
{
  "success": true,
  "data": {
    "address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
    "pool_type": "internal",
    "tokens": {
      "aiw3": {
        "mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
        "symbol": "AIW3",
        "reserves": "10000000000000",
        "vault": "2J5g8H3kL9mN6pQ4rS7fW2eZ1yT8nK3cD5vB9oI4uP7aG"
      },
      "ai_agent": {
        "mint": "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M",
        "symbol": "AAT",
        "reserves": "8000000000000",
        "vault": "8K2nB4mQ9pY7jH3xL6vR2cF5eW8yT1nS9oI4uP3dG7aK"
      }
    },
    "lp_token": {
      "mint": "6J8nB3mQ7pY2jH9xL4vR8cF1eW5yT6nS3oI2uP9dG4aK",
      "supply": "8944271909999"
    },
    "fee_basis_points": 20,
    "metrics": {
      "current_price": "0.800000",
      "24h_volume": "50000000000",
      "24h_price_change": "-2.5%",
      "24h_fees_collected": "100000000",
      "total_liquidity_usd": "18000.00",
      "price_impact_1k_usd": "0.15%",
      "price_impact_10k_usd": "1.50%"
    },
    "created_at": "2024-01-01T00:00:00Z",
    "is_locked": false
  }
}
```

### 创建新交换池

**POST** `/pools`

创建新的交换池。

**请求体**:
```json
{
  "pool_type": "external",
  "aiw3_token_mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
  "ai_agent_token_mint": "8mR3qY6kL2vB9xJ4fH7nW5eP2tS8cZ1dQ3oI6uN9aK4sL",
  "initial_aiw3_amount": "1000000000000",
  "initial_ai_agent_amount": "1000000000000",
  "fee_basis_points": 30,
  "signature": "4k8NmP5nL2bW9xS3rH7fV4gN6eZ2yT8nK1cD3vB7mS5oI9uQ..."
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "pool_address": "7M2nB9mQ5pY8jH3xL4vR6cF2eW7yT1nS8oI3uP9dG5aK",
    "transaction_id": "5Z8nB4mK2pQ7jH9xL3vR6cF4eW2yT5nS1oI8uP4dG7aM",
    "lp_token_mint": "3J6nB2mQ8pY5jH7xL9vR4cF6eW3yT2nS7oI5uP8dG3aK",
    "initial_lp_tokens": "1000000000000",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## 交换操作 API

### 估算交换输出

**POST** `/swap/quote`

估算交换操作的输出数量（不执行实际交换）。

**请求体**:
```json
{
  "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
  "input_mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
  "output_mint": "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M",
  "amount_in": "1000000000",
  "slippage_tolerance": 0.5
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "amount_in": "1000000000",
    "amount_out": "799200000",
    "minimum_amount_out": "795204000",
    "price_impact": "0.25%",
    "fee_amount": "800000",
    "exchange_rate": "0.8000",
    "route": [
      {
        "pool": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
        "input_mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
        "output_mint": "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M",
        "fee_basis_points": 20
      }
    ],
    "execution_estimate": {
      "compute_units": 25000,
      "priority_fee": "5000"
    }
  }
}
```

### 执行交换

**POST** `/swap/execute`

执行代币交换操作。

**请求体**:
```json
{
  "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
  "amount_in": "1000000000",
  "minimum_amount_out": "795204000",
  "input_is_aiw3": true,
  "user_public_key": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3",
  "signature": "2k7QmN4pL8bV3xR9jH2fW6eZ1yT7nK5cD8vB3mS4oI9uP..."
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "4Z2nB8mK5pQ3jH7xL9vR2cF6eW4yT1nS3oI7uP5dG9aM",
    "amount_in": "1000000000",
    "amount_out": "799350000",
    "fee_paid": "800000",
    "price_impact": "0.24%",
    "exchange_rate": "0.7994",
    "execution_time": "1.2s",
    "gas_used": 24750,
    "confirmation_status": "confirmed"
  }
}
```

### 获取交换历史

**GET** `/swap/history/{user_address}`

获取用户的交换历史记录。

**路径参数**:
- `user_address`: 用户钱包地址

**查询参数**:
- `limit`: 返回数量限制 (默认: 50)
- `offset`: 分页偏移量 (默认: 0)
- `from_date`: 开始日期 (ISO 8601)
- `to_date`: 结束日期 (ISO 8601)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "swaps": [
      {
        "transaction_id": "4Z2nB8mK5pQ3jH7xL9vR2cF6eW4yT1nS3oI7uP5dG9aM",
        "timestamp": "2024-01-15T10:30:00Z",
        "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
        "input_token": {
          "mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
          "symbol": "AIW3",
          "amount": "1000000000"
        },
        "output_token": {
          "mint": "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M",
          "symbol": "AAT",
          "amount": "799350000"
        },
        "fee_paid": "800000",
        "price_impact": "0.24%",
        "status": "success"
      }
    ],
    "total_count": 45,
    "has_more": true
  }
}
```

## 流动性管理 API

### 添加流动性估算

**POST** `/liquidity/quote`

估算添加流动性的 LP 代币数量。

**请求体**:
```json
{
  "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
  "aiw3_amount": "1000000000000",
  "ai_agent_amount": "800000000000"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "aiw3_amount": "1000000000000",
    "ai_agent_amount": "800000000000",
    "optimal_amounts": {
      "aiw3_amount": "1000000000000",
      "ai_agent_amount": "800000000000"
    },
    "lp_tokens_to_mint": "894427190999",
    "pool_share_percentage": "9.09%",
    "current_price": "0.8000",
    "value_usd": "1800.00"
  }
}
```

### 添加流动性

**POST** `/liquidity/add`

向流动性池添加流动性。

**请求体**:
```json
{
  "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
  "aiw3_amount": "1000000000000",
  "ai_agent_amount": "800000000000",
  "min_lp_tokens": "890000000000",
  "user_public_key": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3",
  "signature": "6k9QmN2pL5bV8xR4jH7fW3eZ9yT2nK8cD5vB7mS3oI6uP..."
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "7Z5nB3mK8pQ2jH6xL4vR9cF1eW3yT7nS2oI6uP8dG4aM",
    "aiw3_amount_used": "1000000000000",
    "ai_agent_amount_used": "800000000000",
    "lp_tokens_minted": "894427190999",
    "pool_share": "9.09%",
    "lp_token_account": "5J3nB8mQ6pY4jH2xL7vR5cF9eW1yT3nS8oI4uP2dG6aK"
  }
}
```

### 移除流动性

**POST** `/liquidity/remove`

从流动性池移除流动性。

**请求体**:
```json
{
  "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
  "lp_token_amount": "447213595499",
  "min_aiw3_amount": "495000000000",
  "min_ai_agent_amount": "396000000000",
  "user_public_key": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3",
  "signature": "8k2QmN7pL3bV5xR8jH4fW6eZ2yT5nK9cD8vB2mS7oI3uP..."
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "9Z8nB6mK3pQ5jH4xL2vR7cF3eW6yT9nS5oI2uP6dG8aM",
    "lp_tokens_burned": "447213595499",
    "aiw3_amount_received": "500000000000",
    "ai_agent_amount_received": "400000000000",
    "remaining_pool_share": "4.55%"
  }
}
```

## 价格和统计 API

### 获取实时价格

**GET** `/prices`

获取实时代币价格信息。

**查询参数**:
- `tokens`: 代币地址列表 (逗号分隔)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "prices": {
      "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC": {
        "symbol": "AIW3",
        "price_usd": "1.25",
        "price_sol": "0.0125",
        "24h_change": "+5.2%",
        "24h_volume": "150000.00",
        "market_cap": "1250000000.00",
        "last_updated": "2024-01-15T10:30:00Z"
      },
      "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M": {
        "symbol": "AAT",
        "price_usd": "1.00",
        "price_sol": "0.0100",
        "24h_change": "+2.8%",
        "24h_volume": "85000.00",
        "market_cap": "500000000.00",
        "last_updated": "2024-01-15T10:30:00Z"
      }
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 获取历史价格数据

**GET** `/prices/history/{mint}`

获取特定代币的历史价格数据。

**路径参数**:
- `mint`: 代币地址

**查询参数**:
- `interval`: 时间间隔 (1m, 5m, 15m, 1h, 4h, 1d)
- `limit`: 数据点数量 (默认: 100)
- `from`: 开始时间戳
- `to`: 结束时间戳

**响应示例**:
```json
{
  "success": true,
  "data": {
    "mint": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
    "symbol": "AIW3",
    "interval": "1h",
    "data": [
      {
        "timestamp": "2024-01-15T09:00:00Z",
        "open": "1.20",
        "high": "1.28",
        "low": "1.18",
        "close": "1.25",
        "volume": "12500.00"
      },
      {
        "timestamp": "2024-01-15T10:00:00Z",
        "open": "1.25",
        "high": "1.27",
        "low": "1.23",
        "close": "1.25",
        "volume": "8750.00"
      }
    ]
  }
}
```

### 获取统计数据

**GET** `/stats`

获取系统统计数据。

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_pools": 5,
    "active_pools": 4,
    "total_liquidity_usd": "2500000.00",
    "24h_volume_usd": "150000.00",
    "24h_fees_usd": "450.00",
    "total_swaps": 12567,
    "unique_users": 892,
    "top_pools": [
      {
        "address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
        "pair": "AIW3/AAT",
        "tvl_usd": "1800000.00",
        "24h_volume_usd": "85000.00"
      }
    ],
    "last_updated": "2024-01-15T10:30:00Z"
  }
}
```

## 错误响应

### 错误格式
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "User has insufficient token balance for this operation",
    "details": {
      "required": "1000000000",
      "available": "500000000"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_1234567890abcdef"
}
```

### 常见错误码

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `INVALID_REQUEST` | 400 | 请求参数无效 |
| `UNAUTHORIZED` | 401 | 认证失败 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `RATE_LIMITED` | 429 | 请求频率超限 |
| `INSUFFICIENT_BALANCE` | 400 | 余额不足 |
| `SLIPPAGE_EXCEEDED` | 400 | 滑点超出容忍度 |
| `POOL_NOT_FOUND` | 404 | 交换池不存在 |
| `INVALID_SIGNATURE` | 400 | 签名无效 |
| `NETWORK_ERROR` | 503 | 网络连接错误 |

## 速率限制

### 限制规则
- 免费用户: 100 请求/分钟
- 付费用户: 1000 请求/分钟
- 企业用户: 10000 请求/分钟

### 响应头
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

## Webhook 支持

### 配置 Webhook

**POST** `/webhooks`

配置事件通知 Webhook。

**请求体**:
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["swap.completed", "liquidity.added", "pool.created"],
  "secret": "your_webhook_secret"
}
```

### Webhook 事件

支持的事件类型：
- `swap.completed`: 交换完成
- `liquidity.added`: 添加流动性
- `liquidity.removed`: 移除流动性
- `pool.created`: 池创建
- `price.alert`: 价格提醒

### Webhook 负载示例

```json
{
  "event": "swap.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "transaction_id": "4Z2nB8mK5pQ3jH7xL9vR2cF6eW4yT1nS3oI7uP5dG9aM",
    "user": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3",
    "pool": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
    "amount_in": "1000000000",
    "amount_out": "799350000",
    "input_token": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
    "output_token": "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M"
  }
}
```

## SDK 集成

### JavaScript/TypeScript SDK

```bash
npm install @tokenswap/sdk
```

```javascript
import { TokenSwapSDK } from '@tokenswap/sdk';

const sdk = new TokenSwapSDK({
  apiKey: 'your-api-key',
  network: 'mainnet'
});

// 获取价格报价
const quote = await sdk.getSwapQuote({
  poolAddress: 'pool_address',
  inputMint: 'input_mint',
  outputMint: 'output_mint',
  amountIn: '1000000000'
});

// 执行交换
const result = await sdk.executeSwap({
  ...quote,
  userPublicKey: 'user_public_key',
  signature: 'user_signature'
});
```

### Python SDK

```bash
pip install tokenswap-python
```

```python
from tokenswap import TokenSwapClient

client = TokenSwapClient(
    api_key='your-api-key',
    network='mainnet'
)

# 获取价格报价
quote = client.get_swap_quote(
    pool_address='pool_address',
    input_mint='input_mint',
    output_mint='output_mint',
    amount_in='1000000000'
)

# 执行交换
result = client.execute_swap(
    **quote,
    user_public_key='user_public_key',
    signature='user_signature'
)
```
