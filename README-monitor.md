# 监测提醒模块说明

## 功能概览

监测提醒模块新增了以下业务能力：

- 专项工作管理
- 事项定义与周期配置
- 责任人 / 提醒对象配置
- 提醒规则配置
- 周期实例生成
- 系统内提醒与短信提醒
- 提醒日志追踪
- 操作审计

## 数据库变更

本次改动新增了以下数据库文件：

- `prisma/schema.prisma`：新增 monitor 相关模型与枚举
- `prisma/migrations/20260307090000_add_monitor_module/migration.sql`：增量 migration
- `prisma/init-monitor.sql`：离线初始化时追加执行的 SQL

推荐执行方式：

```bash
# 1. 安装依赖
npm ci

# 2. 生成 Prisma Client
npm run prisma:generate

# 3. 执行 migration
npx prisma migrate deploy
```

如果当前环境仍沿用 SQL 初始化：

```bash
# 先执行原始初始化
psql "$DATABASE_URL" -f prisma/init.sql

# 再执行监测模块补充脚本
psql "$DATABASE_URL" -f prisma/init-monitor.sql
```

## 环境变量

在原有 `DATABASE_URL`、`JWT_SECRET`、`MINIO_*` 基础上，新增以下变量：

```env
COOKIE_SECURE=false

MONITOR_JOB_TOKEN=change_me_for_internal_cron
MONITOR_INSTANCE_LOOKAHEAD_DAYS=60
MONITOR_INSTANCE_BACKFILL_DAYS=7
MONITOR_NOTIFY_RETRY_LIMIT=5

# mock / oracle / disabled
MONITOR_SMS_DRIVER=mock

ORACLE_SMS_USER=
ORACLE_SMS_PASSWORD=
ORACLE_SMS_CONNECT_STRING=
ORACLE_SMS_TABLE=SMS_QUEUE

# 如 Oracle 短信表结构与默认列名不一致，可直接给自定义 SQL
# ORACLE_SMS_INSERT_SQL=INSERT INTO SMS_QUEUE (EID, MOBILE, CONTENT, PUSH_TIME, CREATED_AT) VALUES (:eid, :mobile, :content, :pushTime, :createdAt)
```

## 启动

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

## 手动触发任务

登录系统后可直接在页面触发：

- `/monitor/plans`：手动生成实例、扫描提醒、补偿失败短信
- `/monitor/plans/[id]`：针对当前专项生成实例、扫描提醒

也可以直接调用接口：

```bash
curl -X POST http://127.0.0.1:3000/api/monitor/jobs/generate \
  -H "x-monitor-job-token: ${MONITOR_JOB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -X POST http://127.0.0.1:3000/api/monitor/jobs/scan \
  -H "x-monitor-job-token: ${MONITOR_JOB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -X POST http://127.0.0.1:3000/api/monitor/jobs/retry \
  -H "x-monitor-job-token: ${MONITOR_JOB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

仓库附带 Linux 脚本：

```bash
chmod +x scripts/monitor-jobs.sh
MONITOR_JOB_TOKEN=your_token ./scripts/monitor-jobs.sh generate
MONITOR_JOB_TOKEN=your_token ./scripts/monitor-jobs.sh scan
MONITOR_JOB_TOKEN=your_token ./scripts/monitor-jobs.sh retry
```

## 建议的内网 cron

```bash
# 每天凌晨 00:10 生成未来实例
10 0 * * * cd /opt/renwuguanli_zhian && MONITOR_JOB_TOKEN=your_token ./scripts/monitor-jobs.sh generate

# 每 10 分钟扫描提醒
*/10 * * * * cd /opt/renwuguanli_zhian && MONITOR_JOB_TOKEN=your_token ./scripts/monitor-jobs.sh scan

# 每 30 分钟补偿失败短信
*/30 * * * * cd /opt/renwuguanli_zhian && MONITOR_JOB_TOKEN=your_token ./scripts/monitor-jobs.sh retry
```

## Oracle 短信说明

- `MONITOR_SMS_DRIVER=mock`：本地开发默认成功返回，不依赖 Oracle
- `MONITOR_SMS_DRIVER=disabled`：只写提醒日志，不发短信
- `MONITOR_SMS_DRIVER=oracle`：使用 `oracledb` 驱动向 Oracle 队列表插入数据

说明：

- 代码对 `oracledb` 使用动态加载，未安装驱动时不会影响 `mock` / `disabled` 模式启动
- 生产启用 Oracle 模式前，需要在部署环境安装 `oracledb` 驱动和对应系统依赖
