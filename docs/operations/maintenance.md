# 维护手册

## 概述

本文档详细说明了 Token Swap Program 的日常维护流程、故障排除指南、备份恢复策略和系统优化建议。

## 日常维护

### 系统健康检查

#### 每日检查清单
```bash
#!/bin/bash
# daily_health_check.sh

echo "=== Token Swap System Health Check - $(date) ==="

# 1. 检查服务状态
echo "1. Checking service status..."
docker-compose ps
systemctl status tokenswap-api
systemctl status nginx

# 2. 检查系统资源
echo "2. Checking system resources..."
df -h
free -h
uptime

# 3. 检查网络连接
echo "3. Checking network connectivity..."
curl -s https://api.tokenswap.io/health
ping -c 3 api.devnet.solana.com

# 4. 检查日志错误
echo "4. Checking for errors in logs..."
grep -i error /var/log/tokenswap/*.log | tail -10
docker-compose logs --tail=50 tokenswap-api | grep -i error

# 5. 检查数据库连接
echo "5. Checking database connections..."
docker-compose exec postgres psql -U tokenswap -d tokenswap -c "SELECT 1"
docker-compose exec redis redis-cli ping

echo "=== Health check completed ==="
```

#### 每周检查清单
```bash
#!/bin/bash
# weekly_maintenance.sh

echo "=== Weekly Maintenance - $(date) ==="

# 1. 数据库统计信息更新
echo "1. Updating database statistics..."
docker-compose exec postgres psql -U tokenswap -d tokenswap -c "ANALYZE;"

# 2. 清理旧日志
echo "2. Cleaning up old logs..."
find /var/log/tokenswap -name "*.log" -mtime +7 -delete
docker system prune -f

# 3. 检查磁盘空间
echo "3. Checking disk space..."
df -h | awk '$5 > 80 {print "WARNING: " $0}'

# 4. 更新系统包
echo "4. Updating system packages..."
apt update && apt list --upgradable

# 5. 备份验证
echo "5. Verifying recent backups..."
ls -la /backup/database/ | head -10
ls -la /backup/config/ | head -10

echo "=== Weekly maintenance completed ==="
```

### 性能优化

#### 数据库优化
```sql
-- 查找慢查询
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 20;

-- 分析表统计信息
ANALYZE VERBOSE;

-- 重建索引（如需要）
REINDEX INDEX CONCURRENTLY idx_swap_transactions_timestamp;

-- 清理死元组
VACUUM ANALYZE swap_transactions;
```

#### Redis 优化
```bash
# 内存使用分析
redis-cli info memory

# 清理过期键
redis-cli --scan --pattern "cache:*" | xargs redis-cli del

# 配置优化
echo "maxmemory 2gb" >> /etc/redis/redis.conf
echo "maxmemory-policy allkeys-lru" >> /etc/redis/redis.conf
```

## 备份策略

### 数据库备份

#### 全量备份脚本
```bash
#!/bin/bash
# database_backup.sh

BACKUP_DIR="/backup/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="tokenswap"
DB_USER="tokenswap"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份
echo "Starting database backup at $(date)"
docker-compose exec postgres pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# 验证备份
if [ -f "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz" ]; then
    echo "Backup completed successfully: backup_$TIMESTAMP.sql.gz"
    echo "Backup size: $(du -h $BACKUP_DIR/backup_$TIMESTAMP.sql.gz)"
else
    echo "ERROR: Backup failed!"
    exit 1
fi

# 清理旧备份（保留30天）
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Database backup completed at $(date)"
```

#### 增量备份配置
```bash
# 配置 WAL 归档
echo "wal_level = replica" >> /etc/postgresql/15/main/postgresql.conf
echo "archive_mode = on" >> /etc/postgresql/15/main/postgresql.conf
echo "archive_command = 'cp %p /backup/wal/%f'" >> /etc/postgresql/15/main/postgresql.conf

# 创建 WAL 备份目录
mkdir -p /backup/wal
chown postgres:postgres /backup/wal
```

### 配置文件备份
```bash
#!/bin/bash
# config_backup.sh

BACKUP_DIR="/backup/config"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份重要配置文件
tar -czf $BACKUP_DIR/config_$TIMESTAMP.tar.gz \
    /etc/tokenswap/ \
    docker-compose.yml \
    .env \
    nginx.conf \
    Anchor.toml

echo "Configuration backup completed: config_$TIMESTAMP.tar.gz"
```

### 私钥备份
```bash
#!/bin/bash
# keypair_backup.sh

BACKUP_DIR="/backup/secure"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 使用 GPG 加密备份
mkdir -p $BACKUP_DIR

tar -czf - /etc/tokenswap/keypairs/ | \
gpg --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
    --s2k-digest-algo SHA512 --s2k-count 65536 --force-mdc \
    --output $BACKUP_DIR/keypairs_$TIMESTAMP.tar.gz.gpg \
    --symmetric

echo "Encrypted keypair backup completed: keypairs_$TIMESTAMP.tar.gz.gpg"
```

## 恢复流程

### 数据库恢复

#### 从全量备份恢复
```bash
#!/bin/bash
# database_restore.sh

BACKUP_FILE=$1
DB_NAME="tokenswap"
DB_USER="tokenswap"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

echo "WARNING: This will replace the current database!"
read -p "Are you sure? (y/N): " confirm

if [ "$confirm" != "y" ]; then
    echo "Restore cancelled."
    exit 0
fi

# 停止应用服务
docker-compose stop tokenswap-api

# 删除现有数据库
docker-compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"

# 创建新数据库
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# 恢复数据
echo "Restoring database from $BACKUP_FILE..."
gunzip -c $BACKUP_FILE | docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME

# 重新启动服务
docker-compose start tokenswap-api

echo "Database restore completed."
```

#### 时间点恢复 (PITR)
```bash
#!/bin/bash
# pitr_restore.sh

TARGET_TIME=$1
BASE_BACKUP_DIR="/backup/database"
WAL_BACKUP_DIR="/backup/wal"

if [ -z "$TARGET_TIME" ]; then
    echo "Usage: $0 'YYYY-MM-DD HH:MM:SS'"
    exit 1
fi

echo "Performing Point-in-Time Recovery to $TARGET_TIME"

# 停止 PostgreSQL
docker-compose stop postgres

# 恢复基础备份
echo "Restoring base backup..."
# ... 恢复逻辑

# 配置恢复
cat > /var/lib/postgresql/15/main/recovery.conf << EOF
restore_command = 'cp $WAL_BACKUP_DIR/%f %p'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'promote'
EOF

# 启动 PostgreSQL
docker-compose start postgres

echo "PITR restore completed."
```

## 故障排除

### 常见问题诊断

#### API 服务无响应
```bash
# 检查步骤
echo "1. Checking service status..."
docker-compose ps tokenswap-api

echo "2. Checking logs..."
docker-compose logs --tail=100 tokenswap-api

echo "3. Checking system resources..."
top -p $(pgrep node)

echo "4. Checking network connectivity..."
netstat -tlnp | grep :3000

echo "5. Testing database connection..."
docker-compose exec tokenswap-api npm run db:test
```

#### 数据库连接问题
```bash
# 诊断脚本
#!/bin/bash

echo "=== Database Connection Diagnosis ==="

# 1. 检查 PostgreSQL 状态
echo "1. PostgreSQL status:"
docker-compose exec postgres pg_isready

# 2. 检查连接数
echo "2. Active connections:"
docker-compose exec postgres psql -U tokenswap -d tokenswap -c "
SELECT count(*) as active_connections,
       state,
       client_addr
FROM pg_stat_activity 
WHERE state IS NOT NULL 
GROUP BY state, client_addr;"

# 3. 检查锁情况
echo "3. Lock information:"
docker-compose exec postgres psql -U tokenswap -d tokenswap -c "
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;"

# 4. 重启建议
echo "4. If needed, restart database:"
echo "docker-compose restart postgres"
```

#### Redis 内存问题
```bash
# Redis 诊断
echo "=== Redis Memory Diagnosis ==="

# 内存使用情况
redis-cli info memory | grep -E "(used_memory|maxmemory)"

# 查找大键
redis-cli --bigkeys

# 清理建议
echo "Cleanup commands:"
echo "redis-cli FLUSHDB  # 清空当前数据库"
echo "redis-cli CONFIG SET maxmemory-policy allkeys-lru  # 设置 LRU 策略"
```

### 性能问题排查

#### 慢查询分析
```sql
-- 找出最慢的查询
SELECT 
    query,
    calls,
    total_time / calls as avg_time,
    total_time,
    (100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0)) AS hit_percent
FROM pg_stat_statements 
WHERE calls > 100
ORDER BY avg_time DESC 
LIMIT 20;

-- 分析特定查询的执行计划
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
SELECT * FROM swap_transactions 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

#### 内存泄漏检查
```bash
# Node.js 内存分析
echo "=== Memory Analysis ==="

# 1. 进程内存使用
ps aux | grep node

# 2. 堆内存详情
docker-compose exec tokenswap-api node -e "console.log(process.memoryUsage())"

# 3. 垃圾回收统计
docker-compose exec tokenswap-api node --expose-gc -e "
global.gc();
console.log('After GC:', process.memoryUsage());
"

# 4. 如果启用了 heapdump
echo "Generate heap dump:"
echo "docker-compose exec tokenswap-api kill -USR2 \$(pgrep node)"
```

## 升级和迁移

### 滚动升级流程
```bash
#!/bin/bash
# rolling_upgrade.sh

NEW_VERSION=$1

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <new_version>"
    exit 1
fi

echo "Starting rolling upgrade to version $NEW_VERSION"

# 1. 拉取新镜像
echo "1. Pulling new image..."
docker pull tokenswap/api:$NEW_VERSION

# 2. 更新 docker-compose
sed -i "s/tokenswap\/api:.*/tokenswap\/api:$NEW_VERSION/" docker-compose.yml

# 3. 滚动更新
echo "2. Performing rolling update..."
docker-compose up -d --no-deps tokenswap-api

# 4. 健康检查
echo "3. Performing health check..."
sleep 30
curl -f https://api.tokenswap.io/health || {
    echo "Health check failed, rolling back..."
    docker-compose rollback
    exit 1
}

echo "Rolling upgrade completed successfully!"
```

### 数据库迁移
```bash
#!/bin/bash
# database_migration.sh

echo "Starting database migration..."

# 1. 备份当前数据库
./database_backup.sh

# 2. 运行迁移
docker-compose exec tokenswap-api npm run migrate

# 3. 验证迁移
docker-compose exec postgres psql -U tokenswap -d tokenswap -c "
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
FROM pg_stat_user_tables 
ORDER BY schemaname, tablename;"

echo "Database migration completed!"
```

## 安全维护

### 证书更新
```bash
#!/bin/bash
# cert_renewal.sh

echo "Checking SSL certificates..."

# 检查证书到期时间
openssl x509 -in /etc/ssl/certs/tokenswap.crt -noout -dates

# 更新 Let's Encrypt 证书
certbot renew --dry-run

# 如果测试成功，执行实际更新
if [ $? -eq 0 ]; then
    certbot renew
    systemctl reload nginx
    echo "Certificate renewed successfully!"
else
    echo "Certificate renewal test failed!"
fi
```

### 安全审计
```bash
#!/bin/bash
# security_audit.sh

echo "=== Security Audit - $(date) ==="

# 1. 检查开放端口
echo "1. Open ports:"
netstat -tlnp

# 2. 检查失败的登录尝试
echo "2. Failed login attempts:"
grep "Failed password" /var/log/auth.log | tail -10

# 3. 检查 sudo 使用
echo "3. Recent sudo usage:"
grep "sudo:" /var/log/auth.log | tail -10

# 4. 检查文件权限
echo "4. Checking sensitive file permissions:"
ls -la /etc/tokenswap/keypairs/
ls -la /backup/secure/

# 5. 检查系统更新
echo "5. Available security updates:"
apt list --upgradable | grep -i security

echo "=== Security audit completed ==="
```

## 监控和告警维护

### 清理监控数据
```bash
#!/bin/bash
# cleanup_monitoring.sh

echo "Cleaning up monitoring data..."

# 1. Prometheus 数据清理（保留30天）
find /var/lib/prometheus -name "*.db" -mtime +30 -delete

# 2. Grafana 日志清理
find /var/log/grafana -name "*.log" -mtime +7 -delete

# 3. Elasticsearch 索引清理
curl -X DELETE "localhost:9200/tokenswap-logs-$(date -d '30 days ago' '+%Y.%m.%d')"

echo "Monitoring data cleanup completed!"
```

### 告警规则更新
```bash
#!/bin/bash
# update_alerts.sh

echo "Updating alert rules..."

# 1. 验证新规则语法
promtool check rules /etc/prometheus/alert_rules.yml

if [ $? -eq 0 ]; then
    # 2. 重新加载 Prometheus 配置
    curl -X POST http://localhost:9090/-/reload
    echo "Alert rules updated successfully!"
else
    echo "Alert rules validation failed!"
    exit 1
fi
```

这个维护手册提供了全面的系统维护指导，确保 Token Swap Program 的稳定运行和及时的问题解决。 