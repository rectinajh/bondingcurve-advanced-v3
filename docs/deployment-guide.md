# 部署指南

## 概述

本指南详细介绍了如何在不同环境中部署 Token Swap Program，包括本地开发环境、测试网和主网部署。部署过程涵盖智能合约部署、API 服务配置、前端应用部署和系统验证。

### 测试网部署清单
组件	地址	验证
Token-A (DFO)	DFO...	Solscan验证
Token-B (DFI)	DFI...	SolanaFM验证
SwapBridge	SWAP...	Anchor验证
内盘AMM	AMM...	Anchor验证
预言机	ORAC...	Pyth网络验证



### 软件要求

#### 开发工具
- **Node.js**: >= 18.0.0
- **Rust**: >= 1.70.0
- **Anchor**: >= 0.29.0
- **Solana CLI**: >= 1.16.0
- **Git**: >= 2.20.0

#### 运行时环境
- **Docker**: >= 20.0.0
- **Docker Compose**: >= 2.0.0
- **Redis**: >= 6.0.0
- **PostgreSQL**: >= 13.0 (可选，用于数据存储)

#### 云服务支持
- **AWS**: EC2, RDS, ElastiCache, ALB
- **Google Cloud**: Compute Engine, Cloud SQL, Memorystore
- **Azure**: Virtual Machines, Database, Cache for Redis

## 环境准备

### 1. 安装 Solana 工具链

```bash
# 安装 Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"

# 添加到 PATH
export PATH="~/.local/share/solana/install/active_release/bin:$PATH"

# 验证安装
solana --version
```

### 2. 安装 Rust 和 Anchor

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 安装 Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# 验证安装
anchor --version
```

### 3. 安装 Node.js 和依赖

```bash
# 使用 nvm 安装 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 验证安装
node --version
npm --version
```

### 4. 克隆项目仓库

```bash
git clone https://github.com/your-org/bondingcurve-advanced-v3.git
cd bondingcurve-advanced-v3
```

## 配置说明

### 1. Solana 网络配置

#### 本地开发网络
```bash
# 启动本地验证器
solana-test-validator --reset

# 设置配置
solana config set --url localhost
solana config set --keypair ~/.config/solana/id.json
```

#### 测试网配置
```bash
# 设置测试网
solana config set --url devnet

# 获取测试代币
solana airdrop 2
```

#### 主网配置
```bash
# 设置主网
solana config set --url mainnet-beta

# 使用硬件钱包或安全存储的密钥
solana config set --keypair /path/to/secure/keypair.json
```

### 2. 环境变量配置

创建 `.env` 文件：

```bash
# 网络配置
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com

# 程序ID（部署后获得）
PROGRAM_ID=YourProgramIdHere

# 管理员密钥
ADMIN_KEYPAIR_PATH=/path/to/admin-keypair.json
OPERATOR_KEYPAIR_PATH=/path/to/operator-keypair.json

# Oracle 配置
PYTH_PROGRAM_ID=gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s
PYTH_PRICE_FEED_AIW3=0x...
PYTH_PRICE_FEED_AAT=0x...

# API 配置
API_PORT=3000
API_HOST=0.0.0.0
API_SECRET_KEY=your-secret-key-here

# WebSocket 配置
WS_PORT=8080
WS_HOST=0.0.0.0

# 数据库配置（可选）
DATABASE_URL=postgresql://user:password@localhost:5432/tokenswap
REDIS_URL=redis://localhost:6379

# 监控配置
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json
```

### 3. Anchor 配置

编辑 `Anchor.toml`：

```toml
[features]
seeds = false
skip-lint = false

[programs.localnet]
pump = "YourProgramIdHere"

[programs.devnet]
pump = "YourProgramIdHere"

[programs.mainnet]
pump = "YourProgramIdHere"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "devnet"
wallet = "/path/to/wallet/keypair.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

[test]
startup_wait = 5000
shutdown_wait = 2000
upgradeable = false
```

## 智能合约部署

### 1. 编译合约

```bash
# 进入项目目录
cd bondingcurve-advanced-v3

# 安装依赖
npm install

# 编译合约
anchor build
```

### 2. 生成程序 ID

```bash
# 生成新的程序密钥对
solana-keygen new -o target/deploy/pump-keypair.json

# 获取程序 ID
solana address -k target/deploy/pump-keypair.json
```

### 3. 更新程序 ID

更新以下文件中的程序 ID：
- `Anchor.toml`
- `programs/pump/src/lib.rs` (declare_id! 宏)
- `.env` 文件

```rust
// programs/pump/src/lib.rs
use anchor_lang::prelude::*;

declare_id!("YourGeneratedProgramIdHere");

#[program]
pub mod pump {
    use super::*;
    // ... 程序代码
}
```

### 4. 部署到测试网

```bash
# 重新编译
anchor build

# 部署到测试网
anchor deploy --provider.cluster devnet

# 验证部署
solana program show YourProgramIdHere --url devnet
```

### 5. 初始化程序状态

```bash
# 运行初始化脚本
anchor run initialize --provider.cluster devnet
```

初始化脚本示例 (`scripts/initialize.ts`)：

```typescript
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { Pump } from "../target/types/pump";

export async function initialize() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.Pump as Program<Pump>;
  
  // 获取配置 PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  
  // 初始化配置
  const tx = await program.methods
    .initialize({
      tradeFeeRate: 30, // 0.3%
      pumpFee: new anchor.BN(0),
      admin: provider.wallet.publicKey,
      operator: provider.wallet.publicKey,
      feeRecipient: provider.wallet.publicKey,
    })
    .accounts({
      config: configPDA,
      admin: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
    
  console.log("Initialize transaction:", tx);
  console.log("Config PDA:", configPDA.toString());
}
```

### 6. 创建代币

```bash
# 运行代币创建脚本
anchor run create-tokens --provider.cluster devnet
```

代币创建脚本示例 (`scripts/create-tokens.ts`)：

```typescript
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export async function createTokens() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.Pump as Program<Pump>;
  
  // 创建 AIW3 Token
  const aiw3Mint = Keypair.generate();
  
  const createAIW3Tx = await program.methods
    .createToken({
      name: "AIW3 Token",
      symbol: "AIW3",
      uri: "https://metadata.tokenswap.io/aiw3.json",
      decimals: 6,
      transferFeeBasisPoints: 50,
      maxFee: new anchor.BN(1000000),
      tokenType: { aiw3Token: {} },
    })
    .accounts({
      mint: aiw3Mint.publicKey,
      config: configPDA,
      operator: provider.wallet.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([aiw3Mint])
    .rpc();
    
  console.log("AIW3 Token created:", aiw3Mint.publicKey.toString());
  
  // 创建 AI Agent Token
  // ... 类似的代码
}
```

### 7. 创建交换池

```bash
# 运行池创建脚本
anchor run create-pools --provider.cluster devnet
```

## API 服务部署

### 1. 构建 API 服务

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 启动命令
CMD ["npm", "start"]
```

### 2. 创建 Docker Compose 配置

`docker-compose.yml`：

```yaml
version: '3.8'

services:
  tokenswap-api:
    build: .
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - SOLANA_NETWORK=devnet
      - SOLANA_RPC_URL=https://api.devnet.solana.com
      - PROGRAM_ID=${PROGRAM_ID}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    volumes:
      - ./keypairs:/app/keypairs:ro
      - ./logs:/app/logs
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=tokenswap
      - POSTGRES_USER=tokenswap
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - tokenswap-api
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
```

### 3. 启动服务

```bash
# 创建网络
docker network create tokenswap-network

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f tokenswap-api

# 检查服务状态
docker-compose ps
```

### 4. 配置反向代理

Nginx 配置 (`nginx.conf`)：

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api_backend {
        server tokenswap-api:3000;
    }
    
    upstream ws_backend {
        server tokenswap-api:8080;
    }
    
    server {
        listen 80;
        server_name api.tokenswap.io;
        
        # API 路由
        location /api/ {
            proxy_pass http://api_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # WebSocket 路由
        location /ws/ {
            proxy_pass http://ws_backend/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # 健康检查
        location /health {
            proxy_pass http://api_backend/health;
        }
    }
    
    # HTTPS 配置
    server {
        listen 443 ssl http2;
        server_name api.tokenswap.io;
        
        ssl_certificate /etc/ssl/certs/tokenswap.crt;
        ssl_certificate_key /etc/ssl/certs/tokenswap.key;
        
        # SSL 配置
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;
        
        # API 路由
        location /api/ {
            proxy_pass http://api_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # WebSocket 路由
        location /ws/ {
            proxy_pass http://ws_backend/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## 前端应用部署

### 1. 构建前端应用

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build
```

### 2. 前端 Docker 配置

`frontend/Dockerfile`：

```dockerfile
# 构建阶段
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 暴露端口
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 3. 前端环境配置

`frontend/.env.production`：

```bash
VITE_API_BASE_URL=https://api.tokenswap.io
VITE_WS_URL=wss://api.tokenswap.io/ws
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_PROGRAM_ID=YourProgramIdHere
```

### 4. 部署前端

```bash
# 构建镜像
docker build -t tokenswap-frontend ./frontend

# 运行容器
docker run -d -p 80:80 --name tokenswap-frontend tokenswap-frontend
```

## 生产环境部署

### 1. 安全配置

#### SSL/TLS 证书
```bash
# 使用 Let's Encrypt
certbot --nginx -d api.tokenswap.io
certbot --nginx -d app.tokenswap.io

# 设置自动续期
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

#### 防火墙配置
```bash
# 配置 UFW
ufw enable
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 3000/tcp  # 阻止直接访问 API
ufw deny 8080/tcp  # 阻止直接访问 WebSocket
```

#### 密钥管理
```bash
# 创建安全的密钥存储目录
sudo mkdir -p /etc/tokenswap/keypairs
sudo chmod 700 /etc/tokenswap/keypairs

# 复制密钥文件
sudo cp admin-keypair.json /etc/tokenswap/keypairs/
sudo cp operator-keypair.json /etc/tokenswap/keypairs/
sudo chmod 600 /etc/tokenswap/keypairs/*
```

### 2. 监控和日志

#### Prometheus 配置
`prometheus.yml`：

```yaml
global:
  scrape_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'tokenswap-api'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 5s
    metrics_path: /metrics

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### Grafana 仪表板
创建监控仪表板，包括：
- API 响应时间
- 交易量统计
- 错误率监控
- 系统资源使用
- 区块链网络状态

#### 日志聚合
```bash
# 使用 ELK Stack
docker run -d --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  elasticsearch:7.17.0

docker run -d --name kibana \
  -p 5601:5601 \
  --link elasticsearch:elasticsearch \
  kibana:7.17.0

docker run -d --name logstash \
  -p 5044:5044 \
  --link elasticsearch:elasticsearch \
  -v ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf \
  logstash:7.17.0
```

### 3. 高可用部署

#### 负载均衡器配置
```bash
# HAProxy 配置
global
    daemon
    maxconn 4096

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend api_frontend
    bind *:443 ssl crt /etc/ssl/certs/tokenswap.pem
    redirect scheme https if !{ ssl_fc }
    default_backend api_backend

backend api_backend
    balance roundrobin
    option httpchk GET /health
    server api1 10.0.1.10:3000 check
    server api2 10.0.1.11:3000 check
    server api3 10.0.1.12:3000 check
```

#### 数据库主从复制
```bash
# PostgreSQL 主从配置
# 主库配置
echo "wal_level = replica" >> /etc/postgresql/15/main/postgresql.conf
echo "max_wal_senders = 3" >> /etc/postgresql/15/main/postgresql.conf
echo "wal_keep_segments = 64" >> /etc/postgresql/15/main/postgresql.conf

# 从库配置
pg_basebackup -h master_host -D /var/lib/postgresql/15/main -U replication -v -P -W
```

## 部署验证

### 1. 健康检查

```bash
# API 健康检查
curl https://api.tokenswap.io/health

# WebSocket 连接测试
wscat -c wss://api.tokenswap.io/ws

# 智能合约状态检查
solana program show YourProgramIdHere --url devnet
```

### 2. 功能测试

#### 创建测试脚本 (`scripts/deployment-test.ts`)

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

async function deploymentTest() {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  
  // 测试 1: 检查程序是否存在
  const programId = new PublicKey(process.env.PROGRAM_ID!);
  const programInfo = await connection.getAccountInfo(programId);
  console.log("Program exists:", !!programInfo);
  
  // 测试 2: 检查配置账户
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  const configInfo = await connection.getAccountInfo(configPDA);
  console.log("Config account exists:", !!configInfo);
  
  // 测试 3: API 端点测试
  const apiResponse = await fetch(`${process.env.API_BASE_URL}/config`);
  console.log("API status:", apiResponse.status);
  
  // 测试 4: WebSocket 连接测试
  const ws = new WebSocket(process.env.WS_URL!);
  ws.onopen = () => console.log("WebSocket connected");
  ws.onerror = (error) => console.error("WebSocket error:", error);
  
  console.log("Deployment tests completed");
}

deploymentTest().catch(console.error);
```

### 3. 性能测试

```bash
# 使用 Artillery 进行负载测试
npm install -g artillery

# 创建测试配置
cat > load-test.yml << EOF
config:
  target: 'https://api.tokenswap.io'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100

scenarios:
  - name: "API Load Test"
    requests:
      - get:
          url: "/config"
      - get:
          url: "/pools"
      - get:
          url: "/prices"
EOF

# 运行测试
artillery run load-test.yml
```

### 4. 安全测试

```bash
# 使用 OWASP ZAP 进行安全扫描
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.tokenswap.io

# SSL 测试
testssl.sh https://api.tokenswap.io
```

## 故障排除

### 常见问题

#### 1. 程序部署失败
```bash
# 检查余额
solana balance

# 检查程序大小
ls -la target/deploy/pump.so

# 重新部署
anchor clean
anchor build
anchor deploy --provider.cluster devnet
```

#### 2. API 连接问题
```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs tokenswap-api

# 重启服务
docker-compose restart tokenswap-api
```

#### 3. 数据库连接问题
```bash
# 检查数据库状态
docker-compose exec postgres psql -U tokenswap -d tokenswap -c "SELECT 1"

# 查看连接数
docker-compose exec postgres psql -U tokenswap -d tokenswap -c "SELECT COUNT(*) FROM pg_stat_activity"
```

#### 4. Redis 连接问题
```bash
# 检查 Redis 状态
docker-compose exec redis redis-cli ping

# 查看内存使用
docker-compose exec redis redis-cli info memory
```

### 日志分析

#### 应用日志
```bash
# 查看应用日志
tail -f logs/application.log

# 搜索错误
grep "ERROR" logs/application.log | tail -20

# 分析性能
grep "SLOW_QUERY" logs/application.log
```

#### 系统日志
```bash
# 查看系统日志
journalctl -u tokenswap-api -f

# 查看 Docker 日志
docker logs tokenswap-api --tail 100 -f
```

## 维护和更新

### 1. 滚动更新

```bash
# 更新应用代码
git pull origin main

# 重新构建镜像
docker-compose build tokenswap-api

# 滚动更新（零停机）
docker-compose up -d --no-deps tokenswap-api
```

### 2. 数据库迁移

```bash
# 运行数据库迁移
docker-compose exec tokenswap-api npm run migrate

# 备份数据库
docker-compose exec postgres pg_dump -U tokenswap tokenswap > backup.sql
```

### 3. 监控告警

设置关键指标的告警：
- API 响应时间 > 1000ms
- 错误率 > 5%
- 磁盘使用率 > 85%
- 内存使用率 > 90%
- 数据库连接数 > 80%

### 4. 定期维护

```bash
# 清理 Docker 镜像
docker system prune -f

# 清理日志文件
find /var/log -name "*.log" -mtime +30 -delete

# 更新系统包
apt update && apt upgrade -y
```

这个完整的部署指南涵盖了从环境准备到生产部署的所有步骤，确保系统能够安全、稳定地运行在各种环境中。 