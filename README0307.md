# 0307 部署与数据迁移说明

本文档对应 `0307` 分支，重点解决以下问题：

1. 生产库已经有历史业务数据，如何在不动原数据的前提下，把“监测提醒”模块表结构同步进去
2. 如何用 `pg_dump` 备份生产 PostgreSQL 的表结构和数据
3. 如何把生产备份恢复到内网本地 PostgreSQL 做测试
4. 如何在测试环境和生产环境增量合并“监测提醒”模块
5. 如何在内网测试 Oracle 短信功能

## 1. 当前版本和 `master` 的关系

`master` 分支当前只包含原有任务管理模块的基础表，主要包括：

- `Department`
- `User`
- `Task`
- `TaskMember`
- `TaskDepartment`
- `Attachment`
- `Comment`
- `TaskStatusHistory`
- `_TaskResponsibleUsers`

`0307` 分支在此基础上新增“监测提醒”模块，不需要重建旧表，只需要增量增加以下对象：

- 枚举 / 类型：
  - `MonitorPlanStatus`
  - `MonitorCycleType`
  - `MonitorCompleteMode`
  - `MonitorItemStatus`
  - `MonitorItemUserRoleType`
  - `MonitorTriggerType`
  - `MonitorRepeatType`
  - `MonitorInstanceStatus`
  - `MonitorNotifyChannel`
  - `MonitorNotifySendStatus`
  - `MonitorOperateActionType`
- 表：
  - `monitor_plan`
  - `monitor_item`
  - `monitor_item_user`
  - `monitor_rule`
  - `monitor_instance`
  - `monitor_notify_log`
  - `monitor_operate_log`

本次监测模块对应的增量 SQL 有两份：

- [prisma/migrations/20260307090000_add_monitor_module/migration.sql](C:\Users\So\Desktop\renwuguanli_zhian\prisma\migrations\20260307090000_add_monitor_module\migration.sql)
- [prisma/migrations/20260307161000_add_monitor_item_status/migration.sql](C:\Users\So\Desktop\renwuguanli_zhian\prisma\migrations\20260307161000_add_monitor_item_status\migration.sql)

第二份 migration 是在第一份基础上继续增加 `monitor_item.status` 字段，用于“事项已完成后停止提醒”。

## 2. 生产库合并原则

生产库已经有旧数据时，必须按下面原则处理：

- 不要在生产库执行 [prisma/init.sql](C:\Users\So\Desktop\renwuguanli_zhian\prisma\init.sql)
- 不要在生产库执行 [prisma/init-monitor.sql](C:\Users\So\Desktop\renwuguanli_zhian\prisma\init-monitor.sql)
- 不要在生产库执行 `prisma db push`
- 只执行增量 migration SQL
- 先备份，再在测试环境恢复验证，再对生产执行相同 SQL

原因很简单：

- `init.sql` 和 `init-monitor.sql` 适合空库初始化
- 生产库已经有旧表和旧数据，必须走增量合并

## 3. 如何备份生产 PostgreSQL

下面的命令假设生产库在 Linux 或 Ubuntu 上执行。Windows 下命令参数相同，只是导出路径写法不同。

### 3.1 备份整个数据库的结构和数据

推荐使用自定义格式备份，便于恢复时控制粒度：

```bash
export PGHOST=10.10.10.10
export PGPORT=5432
export PGUSER=postgres
export PGPASSWORD='your_password'
export PGDATABASE=renwu_prod

BACKUP_FILE="renwu-prod-$(date +%Y%m%d-%H%M%S).dump"
pg_dump -Fc -f "$BACKUP_FILE"
```

说明：

- `-Fc` 表示自定义格式
- 这种格式适合用 `pg_restore` 恢复
- 既包含表结构，也包含数据

### 3.2 同时导出一份可阅读的纯 SQL 备份

如果你需要人工查看备份内容，可以额外导出纯 SQL：

```bash
export PGHOST=10.10.10.10
export PGPORT=5432
export PGUSER=postgres
export PGPASSWORD='your_password'
export PGDATABASE=renwu_prod

BACKUP_SQL="renwu-prod-$(date +%Y%m%d-%H%M%S).sql"
pg_dump -f "$BACKUP_SQL"
```

### 3.3 只备份表结构

用于核对生产基线时可以这样做：

```bash
pg_dump --schema-only -Fc -f renwu-prod-schema-only.dump
```

### 3.4 只备份数据

如果你已经单独保留了结构，也可以只导数据：

```bash
pg_dump --data-only -Fc -f renwu-prod-data-only.dump
```

### 3.5 只备份监测模块表

如果后续只想核对监测模块，也可以单独导：

```bash
pg_dump -Fc \
  -t monitor_plan \
  -t monitor_item \
  -t monitor_item_user \
  -t monitor_rule \
  -t monitor_instance \
  -t monitor_notify_log \
  -t monitor_operate_log \
  -f monitor-module-only.dump
```

## 4. 如何恢复生产数据到内网本地 PostgreSQL

目标是：

- 把生产当前库完整恢复到内网本地测试库
- 在这个测试库上验证 `0307` 的增量 SQL
- 验证通过后，再对生产库执行同样的 SQL

### 4.1 在内网本地创建测试库

```bash
createdb -h localhost -p 5432 -U postgres renwu_test
```

如果要显式指定拥有者：

```bash
createdb -h localhost -p 5432 -U postgres -O postgres renwu_test
```

### 4.2 恢复自定义格式备份

```bash
export PGPASSWORD='local_postgres_password'

pg_restore \
  -h localhost \
  -p 5432 \
  -U postgres \
  -d renwu_test \
  --no-owner \
  --no-privileges \
  renwu-prod-20260307-120000.dump
```

说明：

- `--no-owner` 避免恢复原生产角色时报错
- `--no-privileges` 避免生产授权语句在本地恢复时报错

### 4.3 恢复纯 SQL 备份

如果你拿到的是 `.sql` 文件，则这样恢复：

```bash
export PGPASSWORD='local_postgres_password'

psql \
  -h localhost \
  -p 5432 \
  -U postgres \
  -d renwu_test \
  -f renwu-prod-20260307-120000.sql
```

### 4.4 恢复后检查

```bash
psql -h localhost -p 5432 -U postgres -d renwu_test -c "\dt"
psql -h localhost -p 5432 -U postgres -d renwu_test -c "SELECT COUNT(*) FROM \"User\";"
psql -h localhost -p 5432 -U postgres -d renwu_test -c "SELECT COUNT(*) FROM \"Task\";"
```

## 5. 如何把“监测提醒”模块表结构合并到测试环境

这是最关键的部分。

假设你已经把生产备份恢复到了 `renwu_test`，那么增量合并步骤如下。

### 5.1 配置测试环境连接串

```bash
export TEST_DATABASE_URL="postgresql://postgres:your_password@localhost:5432/renwu_test?schema=public"
```

### 5.2 执行第一份监测模块 migration

```bash
psql "$TEST_DATABASE_URL" \
  -f prisma/migrations/20260307090000_add_monitor_module/migration.sql
```

这一步会新增：

- `monitor_plan`
- `monitor_item`
- `monitor_item_user`
- `monitor_rule`
- `monitor_instance`
- `monitor_notify_log`
- `monitor_operate_log`

以及相关枚举、索引、外键、唯一约束。

### 5.3 执行第二份 migration

```bash
psql "$TEST_DATABASE_URL" \
  -f prisma/migrations/20260307161000_add_monitor_item_status/migration.sql
```

这一步会给 `monitor_item` 增加：

- `status MonitorItemStatus NOT NULL DEFAULT 'ACTIVE'`

这个字段用于：

- 事项标记为已完成
- 已完成事项停止生成新实例
- 已完成事项停止短信提醒和系统提醒

### 5.4 合并后检查

```bash
psql "$TEST_DATABASE_URL" -c "\dt monitor_*"
psql "$TEST_DATABASE_URL" -c "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'monitor_item' ORDER BY ordinal_position;"
```

### 5.5 启动 0307 版本应用，验证监测模块

建议验证以下功能：

1. 登录系统正常
2. 原任务管理模块正常
3. 可以进入 `/monitor/plans`
4. 可以新建专项
5. 可以新建事项
6. 可以配置事项责任人
7. 可以配置提醒规则
8. 可以生成实例
9. 可以扫描提醒
10. 事项标记为“已完成”后，不再生成实例，不再继续提醒

## 6. 如何把“监测提醒”模块表结构同步到生产

在测试环境恢复并验证通过后，生产执行的 SQL 必须和测试环境保持一致。

### 6.1 再做一次生产备份

上线前必须再做一次最终备份：

```bash
export PGHOST=10.10.10.10
export PGPORT=5432
export PGUSER=postgres
export PGPASSWORD='your_password'
export PGDATABASE=renwu_prod

pg_dump -Fc -f "renwu-prod-before-0307-final.dump"
```

### 6.2 在生产执行增量 SQL

```bash
export DATABASE_URL="postgresql://postgres:your_password@10.10.10.10:5432/renwu_prod?schema=public"

psql "$DATABASE_URL" \
  -f prisma/migrations/20260307090000_add_monitor_module/migration.sql

psql "$DATABASE_URL" \
  -f prisma/migrations/20260307161000_add_monitor_item_status/migration.sql
```

### 6.3 为什么这种做法不会动原数据

因为这两份 SQL 做的事情是：

- 新增监测模块表
- 新增监测模块使用的枚举
- 给新表建索引、约束、外键
- 给 `monitor_item` 增加 `status` 字段

不会做以下事情：

- 不会删除旧表
- 不会清空旧数据
- 不会重建 `User`、`Department`、`Task` 等原有表
- 不会覆盖原业务数据

## 7. 内网如何测试 Oracle 短信功能

当前项目的短信不是 HTTP 调用，而是向 Oracle 11g 的短信表写入数据。

项目已经按你提供的教程对齐为：

- 表：`YFGADB.DFSDL`
- 序列：`YFGADB.SEQ_SENDSMS`
- `USERPORT=0006`
- 发送前按 `EID + MOBILE` 查重

也就是说，如果 Oracle 表里已经存在相同的 `eid + mobile`，项目会跳过，不会重复写入。

### 7.1 内网先做网络层验证

先确认应用所在机器到 Oracle 主机 `1521` 端口可达：

```bash
nc -vz <oracle_host> 1521
```

如果没有 `nc`：

```bash
telnet <oracle_host> 1521
```

### 7.2 测试 Oracle 监听

如果内网机器已安装 Oracle Instant Client：

```bash
tnsping 10.45.100.147:1521/yfgxpt
```

### 7.3 用 `sqlplus` 验证登录

```bash
sqlplus dxpt/dxpt@//10.45.100.147:1521/yfgxpt
```

连接后执行：

```sql
SELECT 1 FROM dual;
```

### 7.4 先手工插一条短信测试记录

根据你给的教程，测试 SQL 应写成：

```sql
INSERT INTO yfgadb.dfsdl
  (id, mobile, content, deadtime, status, eid, userid, password, userport)
VALUES
  (yfgadb.seq_sendsms.nextval,
   '13800138000',
   '0307 Oracle 短信连通测试',
   SYSDATE,
   '0',
   'TEST-0307-001',
   'admin',
   'yfga8130018',
   '0006');

COMMIT;
```

再检查是否写入成功：

```sql
SELECT id, mobile, content, deadtime, status, eid, userport
FROM yfgadb.dfsdl
WHERE eid = 'TEST-0307-001'
  AND mobile = '13800138000';
```

如果这一步都失败，先不要排查项目代码，先解决：

- 网络是否通
- Oracle 账号是否能连
- 账号是否有 `insert/select` 权限
- 表名、序列名、服务名是否与实际一致

### 7.5 项目侧 Oracle 环境变量

内网测试时，应用环境变量至少要配置：

```env
MONITOR_SMS_DRIVER=oracle
ORACLE_SMS_USER=dxpt
ORACLE_SMS_PASSWORD=dxpt
ORACLE_SMS_CONNECT_STRING=10.45.100.147:1521/yfgxpt

ORACLE_SMS_TABLE=YFGADB.DFSDL
ORACLE_SMS_SEQUENCE=YFGADB.SEQ_SENDSMS
ORACLE_SMS_QUEUE_USERID=admin
ORACLE_SMS_QUEUE_PASSWORD=yfga8130018
ORACLE_SMS_USERPORT=0006

ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient
```

如果你们现场账号、密码、发送用户不是上面这组，用现场真实值替换。

### 7.6 项目里的 Oracle 短信实际行为

当前项目发送短信时会做这几件事：

1. 读取 `MONITOR_SMS_DRIVER`
2. 若配置为 `oracle`，连接 Oracle
3. 先查：

```sql
SELECT 1
FROM YFGADB.DFSDL
WHERE EID = :eid
  AND MOBILE = :mobile
  AND ROWNUM = 1
```

4. 若已存在，则跳过发送
5. 若不存在，则执行：

```sql
INSERT INTO YFGADB.DFSDL
  (ID, MOBILE, CONTENT, DEADTIME, STATUS, EID, USERID, PASSWORD, USERPORT)
VALUES
  (YFGADB.SEQ_SENDSMS.NEXTVAL, :mobile, :content, :deadtime, :status, :eid, :userid, :password, :userport)
```

### 7.7 内网项目联调建议步骤

建议按下面顺序测试：

1. `nc` / `telnet` 确认 1521 端口可达
2. `sqlplus` 确认 Oracle 用户能登录
3. 手工 `insert` 一条 `YFGADB.DFSDL`
4. 启动项目并配置 `MONITOR_SMS_DRIVER=oracle`
5. 新建一个监测计划、事项、规则，规则开启 `channelSms=true`
6. 执行“生成实例”
7. 执行“扫描提醒”
8. 到 Oracle 查 `YFGADB.DFSDL`
9. 到 PostgreSQL 查 `monitor_notify_log`

### 7.8 Oracle 联调检查 SQL

查 Oracle 是否真的写入：

```sql
SELECT id, mobile, content, eid, userid, userport, deadtime, status
FROM yfgadb.dfsdl
WHERE deadtime >= SYSDATE - 1
ORDER BY id DESC;
```

查某一条业务键是否被去重：

```sql
SELECT COUNT(*)
FROM yfgadb.dfsdl
WHERE eid = '你的业务主键'
  AND mobile = '13800138000';
```

如果结果大于 `1`，说明现场逻辑或历史数据不符合“`eid + mobile` 唯一”的预期，需要先核对业务键生成策略。

## 8. 推荐上线顺序

建议按以下顺序执行：

1. 生产 PostgreSQL 全量备份
2. 把备份恢复到内网本地 `renwu_test`
3. 在 `renwu_test` 执行两份监测模块 migration
4. 启动 `0307` 版本程序验证
5. 在内网联调 Oracle 短信
6. 确认无误后，对生产执行同样两份 migration
7. 启动生产版本程序
8. 生产做一次监测模块冒烟验证

## 9. 不建议的操作

以下操作不要在生产库执行：

- `npx prisma db push`
- `npx prisma migrate reset`
- [prisma/init.sql](C:\Users\So\Desktop\renwuguanli_zhian\prisma\init.sql)
- [prisma/init-monitor.sql](C:\Users\So\Desktop\renwuguanli_zhian\prisma\init-monitor.sql)
- 任何会清空现有表的脚本

## 10. 当前文档对应文件

- [README0307.md](C:\Users\So\Desktop\renwuguanli_zhian\README0307.md)
- [prisma/migrations/20260307090000_add_monitor_module/migration.sql](C:\Users\So\Desktop\renwuguanli_zhian\prisma\migrations\20260307090000_add_monitor_module\migration.sql)
- [prisma/migrations/20260307161000_add_monitor_item_status/migration.sql](C:\Users\So\Desktop\renwuguanli_zhian\prisma\migrations\20260307161000_add_monitor_item_status\migration.sql)
- [oracle_dxjk.md](C:\Users\So\Desktop\renwuguanli_zhian\oracle_dxjk.md)
