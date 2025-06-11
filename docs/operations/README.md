# 运维手册

## 概述

本运维手册为 Token Swap Program 的生产环境提供完整的运维指导，包括监控、维护、故障排除和最佳实践。

## 文档结构

### [监控手册](./monitoring.md)
- 监控架构和指标
- Grafana 仪表板配置
- 告警规则和通知
- 性能监控和链路追踪

### [维护手册](./maintenance.md)
- 日常维护流程
- 备份和恢复策略
- 故障排除指南
- 升级和迁移流程

## 快速参考

### 紧急联系方式
- **运维团队**: ops@tokenswap.io
- **技术支持**: support@tokenswap.io
- **安全团队**: security@tokenswap.io
- **值班电话**: +1-555-0123

### 重要链接
- **监控仪表板**: https://grafana.tokenswap.io
- **日志查询**: https://kibana.tokenswap.io
- **状态页面**: https://status.tokenswap.io
- **API 文档**: https://docs.tokenswap.io

## 运维流程

### 日常操作

#### 1. 系统健康检查
```bash
# 每日健康检查
./scripts/daily_health_check.sh

# 查看关键指标
curl https://api.tokenswap.io/metrics
```

#### 2. 服务状态监控
- 检查所有服务状态: `docker-compose ps`
- 查看实时日志: `docker-compose logs -f`
- 检查资源使用: `htop` 或 `docker stats`

#### 3. 备份验证
```bash
# 验证最近备份
ls -la /backup/database/ | head -5
./scripts/verify_backup.sh
```

### 应急响应

#### 1. 服务中断处理
```bash
# 快速重启服务
docker-compose restart tokenswap-api

# 查看错误日志
docker-compose logs --tail=100 tokenswap-api | grep -i error

# 检查系统资源
df -h && free -h
```

#### 2. 数据库问题
```bash
# 检查数据库连接
docker-compose exec postgres pg_isready

# 查看活跃连接
docker-compose exec postgres psql -U tokenswap -d tokenswap -c "
SELECT pid, usename, application_name, client_addr, state, query_start 
FROM pg_stat_activity 
WHERE state = 'active';"

# 紧急重启
docker-compose restart postgres
```

#### 3. 网络问题
```bash
# 检查端口监听
netstat -tlnp | grep -E ":3000|:8080|:80|:443"

# 检查防火墙状态
ufw status

# 测试外部连接
curl -I https://api.tokenswap.io/health
```

### 告警响应

#### 严重告警 (Critical)
1. **立即响应** (5分钟内)
2. **评估影响范围**
3. **启动应急预案**
4. **通知相关团队**
5. **记录处理过程**

#### 警告告警 (Warning)
1. **30分钟内响应**
2. **分析根本原因**
3. **制定修复计划**
4. **预防性维护**

### 性能优化

#### 1. 数据库优化
```sql
-- 分析查询性能
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;

-- 更新统计信息
ANALYZE;

-- 重建索引（维护窗口内）
REINDEX DATABASE tokenswap;
```

#### 2. 缓存优化
```bash
# Redis 内存使用分析
redis-cli info memory

# 清理过期键
redis-cli FLUSHDB

# 配置优化
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### 3. 应用优化
```bash
# 监控应用内存
docker stats tokenswap-api

# 重启应用释放内存
docker-compose restart tokenswap-api

# 查看 Node.js 内存使用
docker-compose exec tokenswap-api node -e "console.log(process.memoryUsage())"
```

## 安全运维

### 1. 密钥管理
- **轮换周期**: 每90天轮换 API 密钥
- **备份加密**: 使用 GPG 加密敏感备份
- **访问控制**: 定期审核密钥访问权限

### 2. 系统安全
```bash
# 系统更新检查
apt list --upgradable | grep -i security

# 安全扫描
./scripts/security_audit.sh

# 证书检查
openssl x509 -in /etc/ssl/certs/tokenswap.crt -noout -dates
```

### 3. 网络安全
```bash
# 防火墙规则检查
ufw status numbered

# 入侵检测
grep "Failed password" /var/log/auth.log | tail -10

# SSL 配置检查
testssl.sh https://api.tokenswap.io
```

## 容量规划

### 1. 存储容量
- **数据库**: 预留 6 个月增长空间
- **日志存储**: 保留 30 天详细日志
- **备份存储**: 保留 90 天备份数据

### 2. 计算资源
- **CPU**: 平均使用率不超过 60%
- **内存**: 使用率不超过 80%
- **网络**: 带宽利用率不超过 70%

### 3. 扩容触发条件
- 连续 7 天 CPU 使用率 > 70%
- 连续 3 天内存使用率 > 85%
- 磁盘使用率 > 80%
- API 响应时间 P95 > 2 秒

## 变更管理

### 1. 变更分类
- **紧急变更**: 安全漏洞修复，严重故障恢复
- **标准变更**: 功能更新，性能优化
- **常规变更**: 配置调整，监控规则更新

### 2. 变更流程
1. **变更申请**: 提交变更请求单
2. **风险评估**: 评估变更影响和风险
3. **测试验证**: 在测试环境验证变更
4. **批准流程**: 获得相关负责人批准
5. **执行变更**: 按计划执行变更
6. **验证结果**: 确认变更成功
7. **文档更新**: 更新相关文档

### 3. 回滚计划
- **自动回滚**: 健康检查失败自动回滚
- **手动回滚**: 预定义回滚脚本
- **数据回滚**: 数据库时间点恢复

## 最佳实践

### 1. 监控最佳实践
- 设置合理的告警阈值
- 避免告警风暴，设置告警抑制
- 定期检查和更新监控规则
- 建立告警分级处理机制

### 2. 备份最佳实践
- 实施 3-2-1 备份策略
- 定期测试备份恢复
- 加密敏感数据备份
- 异地存储重要备份

### 3. 安全最佳实践
- 定期更新系统和依赖
- 实施最小权限原则
- 启用访问日志和审计
- 定期进行安全扫描

### 4. 性能最佳实践
- 建立性能基线
- 持续监控关键指标
- 定期进行性能测试
- 优化数据库查询和索引

## 联系信息

### 运维团队
- **运维经理**: John Doe (john.doe@tokenswap.io)
- **系统管理员**: Jane Smith (jane.smith@tokenswap.io)
- **数据库管理员**: Bob Johnson (bob.johnson@tokenswap.io)

### 值班安排
- **工作日值班**: 9:00 AM - 6:00 PM
- **24/7 紧急响应**: +1-555-0123
- **值班轮换**: 每周轮换，详见值班表

### 升级路径
1. **L1 支持**: 值班工程师
2. **L2 支持**: 高级系统管理员
3. **L3 支持**: 架构师和技术负责人
4. **紧急联系**: CTO (仅限严重事故)

---

*本文档最后更新时间: 2024年1月15日*  
*文档版本: v1.0*  
*维护者: 运维团队* 