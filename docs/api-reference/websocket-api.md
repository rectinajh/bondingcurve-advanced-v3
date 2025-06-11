# WebSocket API 参考文档

## 概述

Token Swap Program 提供 WebSocket API 用于实时数据订阅，支持价格变动、交易事件、流动性变化等实时推送。WebSocket 连接提供低延迟的双向通信，适用于需要实时数据的应用。

## 连接信息

### WebSocket 端点
```
Production: wss://ws.tokenswap.io/v1
Testnet: wss://ws-testnet.tokenswap.io/v1
Devnet: wss://ws-devnet.tokenswap.io/v1
```

### 认证
WebSocket 连接支持多种认证方式：
- 连接时提供 API Key
- JWT Token 认证
- 匿名连接（限制功能）

### 连接示例
```javascript
const ws = new WebSocket('wss://ws.tokenswap.io/v1?apiKey=your-api-key');

ws.onopen = function(event) {
    console.log('WebSocket connected');
    // 发送认证消息
    ws.send(JSON.stringify({
        action: 'auth',
        apiKey: 'your-api-key'
    }));
};
```

## 消息格式

### 请求格式
所有发送到服务器的消息都遵循以下格式：
```json
{
    "action": "subscribe|unsubscribe|ping",
    "channel": "channel_name",
    "params": {},
    "id": "request_id_optional"
}
```

### 响应格式
所有从服务器接收的消息都遵循以下格式：
```json
{
    "type": "auth|subscription|data|error|pong",
    "channel": "channel_name",
    "data": {},
    "timestamp": "2024-01-15T10:30:00Z",
    "id": "request_id_if_applicable"
}
```

## 认证

### 认证请求
```json
{
    "action": "auth",
    "apiKey": "your-api-key"
}
```

### 认证响应
```json
{
    "type": "auth",
    "status": "success",
    "user_id": "user_12345",
    "permissions": ["read", "trade"],
    "rate_limit": {
        "requests_per_minute": 1000,
        "subscriptions_limit": 50
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 认证失败响应
```json
{
    "type": "error",
    "error": {
        "code": "AUTH_FAILED",
        "message": "Invalid API key provided"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## 价格数据订阅

### 实时价格订阅

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "prices",
    "params": {
        "tokens": [
            "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
            "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M"
        ]
    },
    "id": "price_sub_1"
}
```

**订阅确认**:
```json
{
    "type": "subscription",
    "channel": "prices",
    "status": "subscribed",
    "params": {
        "tokens": [
            "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
            "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M"
        ]
    },
    "id": "price_sub_1",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

**价格更新推送**:
```json
{
    "type": "data",
    "channel": "prices",
    "data": {
        "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC": {
            "symbol": "AIW3",
            "price_usd": "1.2548",
            "price_sol": "0.0125",
            "24h_change": "+5.2%",
            "24h_volume": "151250.00",
            "last_trade_time": "2024-01-15T10:29:45Z"
        }
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 价格警报订阅

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "price_alerts",
    "params": {
        "alerts": [
            {
                "token": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
                "condition": "above",
                "threshold": "1.30",
                "currency": "USD"
            },
            {
                "token": "5k9Bw2Xy3LmN8qP6rH4jF7gV2nS9cD8eT1yI5oU3aZ6M",
                "condition": "below",
                "threshold": "0.95",
                "currency": "USD"
            }
        ]
    },
    "id": "alert_sub_1"
}
```

**价格警报触发**:
```json
{
    "type": "data",
    "channel": "price_alerts",
    "data": {
        "token": "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC",
        "symbol": "AIW3",
        "condition": "above",
        "threshold": "1.30",
        "current_price": "1.3125",
        "triggered_at": "2024-01-15T10:30:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## 交易事件订阅

### 全局交易事件

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "trades",
    "params": {
        "pools": [
            "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK"
        ]
    },
    "id": "trade_sub_1"
}
```

**交易事件推送**:
```json
{
    "type": "data",
    "channel": "trades",
    "data": {
        "transaction_id": "4Z2nB8mK5pQ3jH7xL9vR2cF6eW4yT1nS3oI7uP5dG9aM",
        "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
        "trader": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3",
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
        "exchange_rate": "0.7994",
        "trade_type": "swap",
        "block_time": "2024-01-15T10:30:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 用户交易历史

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "user_trades",
    "params": {
        "user_address": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3"
    },
    "id": "user_trade_sub_1"
}
```

**用户交易推送**:
```json
{
    "type": "data",
    "channel": "user_trades",
    "data": {
        "transaction_id": "4Z2nB8mK5pQ3jH7xL9vR2cF6eW4yT1nS3oI7uP5dG9aM",
        "user_address": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3",
        "trade_type": "swap",
        "status": "success",
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
        "transaction_fee": "5000",
        "block_time": "2024-01-15T10:30:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## 流动性池订阅

### 池状态更新

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "pool_state",
    "params": {
        "pools": [
            "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK"
        ]
    },
    "id": "pool_sub_1"
}
```

**池状态更新推送**:
```json
{
    "type": "data",
    "channel": "pool_state",
    "data": {
        "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
        "aiw3_reserves": "10001000000000",
        "ai_agent_reserves": "7999200000000",
        "lp_token_supply": "8944271909999",
        "current_price": "0.7999",
        "price_change_1m": "-0.01%",
        "volume_24h": "50100000000",
        "fees_collected_24h": "100200000",
        "liquidity_change": {
            "type": "trade",
            "aiw3_delta": "1000000000",
            "ai_agent_delta": "-800000000"
        },
        "last_updated": "2024-01-15T10:30:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 流动性事件

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "liquidity_events",
    "params": {
        "pools": [
            "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK"
        ],
        "event_types": ["add", "remove"]
    },
    "id": "liquidity_sub_1"
}
```

**流动性事件推送**:
```json
{
    "type": "data",
    "channel": "liquidity_events",
    "data": {
        "event_type": "add",
        "transaction_id": "7Z5nB3mK8pQ2jH6xL4vR9cF1eW3yT7nS2oI6uP8dG4aM",
        "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
        "provider": "4k3Dyjzvzp3Z6dQqBc2nBcpMGqn7iP3pxJ9q8dQ2K7V3",
        "aiw3_amount": "1000000000000",
        "ai_agent_amount": "800000000000",
        "lp_tokens_minted": "894427190999",
        "pool_share_percentage": "9.09%",
        "total_liquidity_usd": "1800.00",
        "block_time": "2024-01-15T10:30:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## 订单簿数据订阅

### 深度数据

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "depth",
    "params": {
        "pair": "AIW3/AAT",
        "levels": 20
    },
    "id": "depth_sub_1"
}
```

**深度数据推送**:
```json
{
    "type": "data",
    "channel": "depth",
    "data": {
        "pair": "AIW3/AAT",
        "bids": [
            ["0.7995", "5000.000000"],
            ["0.7990", "10000.000000"],
            ["0.7985", "15000.000000"]
        ],
        "asks": [
            ["0.8005", "8000.000000"],
            ["0.8010", "12000.000000"],
            ["0.8015", "20000.000000"]
        ],
        "timestamp": "2024-01-15T10:30:00Z",
        "sequence": 1642248600123
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 增量深度更新

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "depth_diff",
    "params": {
        "pair": "AIW3/AAT"
    },
    "id": "depth_diff_sub_1"
}
```

**增量更新推送**:
```json
{
    "type": "data",
    "channel": "depth_diff",
    "data": {
        "pair": "AIW3/AAT",
        "changes": {
            "bids": [
                ["0.7995", "0.000000"],  // 删除价位
                ["0.7993", "7500.000000"] // 新增/更新价位
            ],
            "asks": [
                ["0.8005", "6000.000000"] // 更新价位
            ]
        },
        "timestamp": "2024-01-15T10:30:00Z",
        "sequence": 1642248600124
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## 市场统计订阅

### 24小时统计

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "24hr_stats",
    "params": {
        "pairs": ["AIW3/AAT", "AIW3/SOL"]
    },
    "id": "stats_sub_1"
}
```

**统计数据推送**:
```json
{
    "type": "data",
    "channel": "24hr_stats",
    "data": {
        "AIW3/AAT": {
            "open_price": "0.7850",
            "high_price": "0.8150",
            "low_price": "0.7800",
            "close_price": "0.8000",
            "volume_base": "125000.000000",
            "volume_quote": "100000.000000",
            "price_change": "+1.91%",
            "price_change_abs": "+0.0150",
            "trades_count": 456,
            "timestamp": "2024-01-15T10:30:00Z"
        }
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 交易量统计

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "volume_stats",
    "params": {
        "pools": [
            "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK"
        ],
        "interval": "1h"
    },
    "id": "volume_sub_1"
}
```

**交易量统计推送**:
```json
{
    "type": "data",
    "channel": "volume_stats",
    "data": {
        "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
        "interval": "1h",
        "period_start": "2024-01-15T10:00:00Z",
        "period_end": "2024-01-15T11:00:00Z",
        "volume_aiw3": "12500.000000",
        "volume_ai_agent": "10000.000000",
        "volume_usd": "22500.00",
        "trades_count": 45,
        "fees_collected": "67500",
        "unique_traders": 23,
        "avg_trade_size_usd": "500.00"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## 系统事件订阅

### 系统状态更新

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "system_status",
    "id": "status_sub_1"
}
```

**系统状态推送**:
```json
{
    "type": "data",
    "channel": "system_status",
    "data": {
        "status": "operational",
        "network": "mainnet",
        "block_height": 245789632,
        "tps": 2850,
        "network_congestion": "low",
        "oracle_status": {
            "pyth": "operational",
            "last_update": "2024-01-15T10:29:55Z"
        },
        "pool_count": {
            "active": 4,
            "total": 5
        },
        "total_tvl_usd": "2500000.00"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 紧急事件通知

**订阅请求**:
```json
{
    "action": "subscribe",
    "channel": "emergency_alerts",
    "id": "alert_sub_1"
}
```

**紧急事件推送**:
```json
{
    "type": "data",
    "channel": "emergency_alerts",
    "data": {
        "alert_type": "pool_emergency_stop",
        "severity": "high",
        "pool_address": "9K3nB7mQ2pY8jH4xL6vR5cF3eW1yT9nS2oI7uP4dG8aK",
        "reason": "Unusual trading pattern detected",
        "action_taken": "Pool trading temporarily suspended",
        "estimated_resolution": "2024-01-15T12:00:00Z",
        "support_contact": "support@tokenswap.io"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## 连接管理

### 心跳机制

**Ping 请求**:
```json
{
    "action": "ping"
}
```

**Pong 响应**:
```json
{
    "type": "pong",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 订阅管理

**取消订阅**:
```json
{
    "action": "unsubscribe",
    "channel": "prices",
    "id": "price_sub_1"
}
```

**取消订阅确认**:
```json
{
    "type": "subscription",
    "channel": "prices",
    "status": "unsubscribed",
    "id": "price_sub_1",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

**获取活跃订阅**:
```json
{
    "action": "list_subscriptions"
}
```

**活跃订阅响应**:
```json
{
    "type": "subscriptions",
    "data": {
        "active_subscriptions": [
            {
                "id": "price_sub_1",
                "channel": "prices",
                "params": {
                    "tokens": [
                        "HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC"
                    ]
                },
                "subscribed_at": "2024-01-15T10:25:00Z"
            }
        ],
        "subscription_count": 1,
        "max_subscriptions": 50
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## 错误处理

### 错误响应格式
```json
{
    "type": "error",
    "error": {
        "code": "SUBSCRIPTION_LIMIT_EXCEEDED",
        "message": "Maximum number of subscriptions (50) exceeded",
        "details": {
            "current_subscriptions": 50,
            "max_allowed": 50
        }
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 常见错误码

| 错误码 | 描述 |
|--------|------|
| `AUTH_REQUIRED` | 需要认证 |
| `AUTH_FAILED` | 认证失败 |
| `INVALID_CHANNEL` | 无效频道 |
| `INVALID_PARAMS` | 无效参数 |
| `SUBSCRIPTION_LIMIT_EXCEEDED` | 订阅数量超限 |
| `RATE_LIMIT_EXCEEDED` | 请求频率超限 |
| `INTERNAL_ERROR` | 内部服务器错误 |
| `SERVICE_UNAVAILABLE` | 服务不可用 |

## 连接限制

### 速率限制
- 认证用户: 每分钟 1000 条消息
- 匿名用户: 每分钟 100 条消息
- 最大并发订阅: 50 个

### 连接超时
- 连接空闲超时: 30 秒
- 心跳间隔: 10 秒
- 重连指数退避: 1s, 2s, 4s, 8s, 16s, 30s

## SDK 集成示例

### JavaScript/TypeScript

```javascript
import { TokenSwapWebSocket } from '@tokenswap/sdk';

const ws = new TokenSwapWebSocket({
    apiKey: 'your-api-key',
    network: 'mainnet'
});

// 连接事件
ws.on('open', () => {
    console.log('Connected to TokenSwap WebSocket');
});

ws.on('authenticated', (data) => {
    console.log('Authenticated:', data);
    
    // 订阅价格数据
    ws.subscribe('prices', {
        tokens: ['HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC']
    });
});

// 数据事件
ws.on('prices', (data) => {
    console.log('Price update:', data);
});

ws.on('trades', (data) => {
    console.log('Trade event:', data);
});

// 错误处理
ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

// 连接
ws.connect();
```

### Python

```python
import asyncio
import json
from tokenswap import TokenSwapWebSocket

async def main():
    ws = TokenSwapWebSocket(
        api_key='your-api-key',
        network='mainnet'
    )
    
    @ws.on('authenticated')
    async def on_authenticated(data):
        print(f"Authenticated: {data}")
        # 订阅价格数据
        await ws.subscribe('prices', {
            'tokens': ['HZz1QYKchDyR8Q7Fb4DJALf3N8Tqr3nW9eK2pS5xV7uC']
        })
    
    @ws.on('prices')
    async def on_prices(data):
        print(f"Price update: {data}")
    
    @ws.on('error')
    async def on_error(error):
        print(f"WebSocket error: {error}")
    
    await ws.connect()
    await ws.listen()

if __name__ == "__main__":
    asyncio.run(main())
```

## 最佳实践

### 连接管理
1. 实现自动重连机制
2. 使用指数退避策略
3. 监控连接状态
4. 定期发送心跳消息

### 订阅管理
1. 根据需要订阅频道，避免不必要的数据
2. 定期清理不需要的订阅
3. 监控订阅数量限制
4. 实现订阅状态跟踪

### 错误处理
1. 实现全面的错误处理机制
2. 记录和监控错误事件
3. 实现优雅的降级策略
4. 提供用户友好的错误提示

### 性能优化
1. 使用适当的消息缓冲区
2. 实现消息去重机制
3. 优化数据处理性能
4. 监控内存使用情况 