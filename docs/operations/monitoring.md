# 监控手册

## 概述

本文档描述了 Token Swap Program 的完整监控体系，包括系统指标监控、应用性能监控、业务指标监控和告警配置。

## 监控架构

### 核心组件
- **Prometheus**: 指标收集和存储
- **Grafana**: 可视化仪表板
- **AlertManager**: 告警管理
- **Jaeger**: 分布式链路追踪
- **ELK Stack**: 日志聚合和分析

### 监控层级
1. **基础设施监控**: 服务器、网络、存储
2. **应用监控**: API 性能、错误率、响应时间
3. **业务监控**: 交易量、资金池状态、用户活动
4. **区块链监控**: 网络状态、交易确认、Oracle 数据

## 关键指标

### 系统性能指标

#### CPU 和内存
```promql
# CPU 使用率
100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 内存使用率
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# 磁盘使用率
(node_filesystem_size_bytes - node_filesystem_avail_bytes) / node_filesystem_size_bytes * 100
```

#### 网络和磁盘 I/O
```promql
# 网络流量
rate(node_network_receive_bytes_total[5m])
rate(node_network_transmit_bytes_total[5m])

# 磁盘 I/O
rate(node_disk_read_bytes_total[5m])
rate(node_disk_written_bytes_total[5m])
```

### 应用性能指标

#### HTTP API 指标
```promql
# 请求速率
rate(http_requests_total[5m])

# 响应时间分位数
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 错误率
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

#### WebSocket 指标
```promql
# 活跃连接数
websocket_connections_active

# 消息发送速率
rate(websocket_messages_sent_total[5m])

# 连接延迟
histogram_quantile(0.95, rate(websocket_connection_duration_seconds_bucket[5m]))
```

### 业务指标

#### 交易指标
```promql
# 交易量
rate(swap_transactions_total[5m])

# 交易金额
rate(swap_volume_usd_total[5m])

# 交易成功率
rate(swap_transactions_total{status="success"}[5m]) / rate(swap_transactions_total[5m])
```

#### 资金池指标
```promql
# 流动性总值
liquidity_pool_tvl_usd

# 资金池数量
liquidity_pools_count

# 价格偏差
abs(oracle_price - pool_price) / oracle_price
```

## Grafana 仪表板

### 系统概览仪表板
```json
{
  "dashboard": {
    "title": "Token Swap - System Overview",
    "panels": [
      {
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (method, status)",
            "legendFormat": "{{method}} - {{status}}"
          }
        ]
      },
      {
        "title": "Response Time P95",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P95 Response Time"
          }
        ]
      }
    ]
  }
}
```

### 业务监控仪表板
```json
{
  "dashboard": {
    "title": "Token Swap - Business Metrics",
    "panels": [
      {
        "title": "Daily Trading Volume",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(increase(swap_volume_usd_total[24h]))",
            "legendFormat": "24h Volume USD"
          }
        ]
      },
      {
        "title": "Pool TVL",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(liquidity_pool_tvl_usd)",
            "legendFormat": "Total Value Locked"
          }
        ]
      }
    ]
  }
}
```

## 告警配置

### Prometheus 告警规则

#### 系统告警
```yaml
groups:
  - name: system_alerts
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is above 80% for more than 5 minutes"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 85% for more than 5 minutes"

      - alert: DiskSpaceLow
        expr: (node_filesystem_size_bytes - node_filesystem_avail_bytes) / node_filesystem_size_bytes * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space running low"
          description: "Disk usage is above 90%"
```

#### 应用告警
```yaml
groups:
  - name: application_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for more than 2 minutes"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time"
          description: "95th percentile response time is above 1 second"

      - alert: APIDown
        expr: up{job="tokenswap-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "API service is down"
          description: "API service has been down for more than 1 minute"
```

#### 业务告警
```yaml
groups:
  - name: business_alerts
    rules:
      - alert: LowTradingVolume
        expr: sum(rate(swap_volume_usd_total[1h])) < 1000
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Low trading volume"
          description: "Trading volume is below $1000/hour for 30 minutes"

      - alert: PriceDeviation
        expr: abs(oracle_price - pool_price) / oracle_price > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Large price deviation detected"
          description: "Price deviation between oracle and pool is above 10%"

      - alert: PoolLiquidityLow
        expr: liquidity_pool_tvl_usd < 10000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Pool liquidity is low"
          description: "Pool TVL is below $10,000"
```

### AlertManager 配置
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@tokenswap.io'
  smtp_auth_username: 'alerts@tokenswap.io'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    email_configs:
      - to: 'team@tokenswap.io'
        subject: 'TokenSwap Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Labels: {{ range .Labels.SortedPairs }}{{ .Name }}={{ .Value }} {{ end }}
          {{ end }}

  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@tokenswap.io'
        subject: 'CRITICAL: TokenSwap Alert - {{ .GroupLabels.alertname }}'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts-critical'
        title: 'Critical Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'warning-alerts'
    email_configs:
      - to: 'team@tokenswap.io'
        subject: 'WARNING: TokenSwap Alert - {{ .GroupLabels.alertname }}'
```

## 日志监控

### 应用日志格式
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "service": "tokenswap-api",
  "module": "swap",
  "trace_id": "abc123def456",
  "user_id": "user_123",
  "message": "Swap transaction completed",
  "data": {
    "transaction_id": "tx_789",
    "from_token": "AIW3",
    "to_token": "AAT",
    "amount_in": "1000000",
    "amount_out": "950000",
    "price": "0.95"
  }
}
```

### ELK Stack 配置

#### Logstash 配置
```ruby
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "tokenswap-api" {
    json {
      source => "message"
    }
    
    if [level] == "ERROR" {
      mutate {
        add_tag => ["error"]
      }
    }
    
    if [module] == "swap" {
      mutate {
        add_tag => ["business"]
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "tokenswap-logs-%{+YYYY.MM.dd}"
  }
}
```

#### Kibana 仪表板查询
```json
{
  "query": {
    "bool": {
      "must": [
        {
          "range": {
            "@timestamp": {
              "gte": "now-1h"
            }
          }
        },
        {
          "term": {
            "level": "ERROR"
          }
        }
      ]
    }
  },
  "aggs": {
    "error_count_by_module": {
      "terms": {
        "field": "module.keyword"
      }
    }
  }
}
```

## 性能监控

### APM 配置

#### 应用性能监控代码
```typescript
import { createPrometheusMetrics } from '@prometheus/client';

const httpRequestDuration = new createPrometheusMetrics.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestsTotal = new createPrometheusMetrics.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// 中间件
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode.toString()
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
  });
  
  next();
}
```

### 数据库监控

#### PostgreSQL 指标
```sql
-- 查询性能
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- 连接状态
SELECT 
    state,
    COUNT(*) as connection_count
FROM pg_stat_activity 
GROUP BY state;

-- 表大小
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Redis 监控

#### Redis 指标收集
```bash
# Redis 信息收集脚本
#!/bin/bash

REDIS_CLI="redis-cli"

# 获取基本信息
$REDIS_CLI info server | grep redis_version
$REDIS_CLI info memory | grep used_memory_human
$REDIS_CLI info stats | grep total_commands_processed
$REDIS_CLI info clients | grep connected_clients

# 获取慢查询
$REDIS_CLI slowlog get 10
```

## 链路追踪

### Jaeger 配置

#### 服务配置
```typescript
import { initTracer } from 'jaeger-client';

const config = {
  serviceName: 'tokenswap-api',
  sampler: {
    type: 'const',
    param: 1,
  },
  reporter: {
    logSpans: true,
    agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
    agentPort: process.env.JAEGER_AGENT_PORT || 6832,
  },
};

const tracer = initTracer(config);

// 使用示例
export async function swapTokens(params: SwapParams) {
  const span = tracer.startSpan('swap_tokens');
  
  try {
    span.setTag('user_id', params.userId);
    span.setTag('from_token', params.fromToken);
    span.setTag('to_token', params.toToken);
    
    const result = await performSwap(params);
    
    span.setTag('transaction_id', result.transactionId);
    span.setTag('amount_out', result.amountOut);
    
    return result;
  } catch (error) {
    span.setTag('error', true);
    span.log({ error: error.message });
    throw error;
  } finally {
    span.finish();
  }
}
```

## 自定义监控

### 业务指标收集器
```typescript
import { register, Gauge, Counter, Histogram } from 'prom-client';

// 业务指标定义
const swapVolumeUSD = new Counter({
  name: 'swap_volume_usd_total',
  help: 'Total swap volume in USD',
  labelNames: ['from_token', 'to_token']
});

const poolTVL = new Gauge({
  name: 'liquidity_pool_tvl_usd',
  help: 'Pool Total Value Locked in USD',
  labelNames: ['pool_id', 'token_pair']
});

const oraclePrice = new Gauge({
  name: 'oracle_price',
  help: 'Oracle price for token pairs',
  labelNames: ['token_pair']
});

// 指标更新函数
export class MetricsCollector {
  async updateSwapMetrics(swap: SwapTransaction) {
    swapVolumeUSD.inc(
      {
        from_token: swap.fromToken,
        to_token: swap.toToken
      },
      swap.volumeUSD
    );
  }

  async updatePoolMetrics(pool: LiquidityPool) {
    poolTVL.set(
      {
        pool_id: pool.id,
        token_pair: `${pool.tokenA}-${pool.tokenB}`
      },
      pool.tvlUSD
    );
  }

  async updateOracleMetrics(priceData: PriceData) {
    oraclePrice.set(
      { token_pair: priceData.pair },
      priceData.price
    );
  }
}
```

这个监控手册提供了完整的监控解决方案，涵盖系统、应用和业务层面的监控需求。 