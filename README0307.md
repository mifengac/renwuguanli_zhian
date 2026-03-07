# 0307 部署说明

本文档对应当前 `0307` 分支，部署方案默认采用：

- 外网环境构建 Docker 镜像
- 使用 `docker save` 导出镜像
- 将镜像包拷贝到内网 Ubuntu 22
- 内网使用唯一保留的 `docker-compose-offline.yml` 启动

## 1. 外网环境构建镜像

在有外网的构建机执行：

先把 Oracle Instant Client 11.2 的运行库解压到仓库根目录的 `instantclient_11_2/`，Dockerfile 会将该目录整体打包进镜像，并固定映射为镜像内的 `/opt/oracle/instantclient`。

```bash
powershell -ExecutionPolicy Bypass -File scripts/build-offline-image.ps1
```

如果你需要手工执行，等价命令是：

```bash
docker build -t zhian-renwuguanli:0307 .
docker save -o zhian-renwuguanli-0307.tar zhian-renwuguanli:0307
```

把以下内容带入内网：

- `zhian-renwuguanli-0307.tar`
- `docker-compose-offline.yml`
- `.env` 或部署时需要的环境变量
- `prisma/migrations/20260307090000_add_monitor_module/migration.sql`
- 如需手工补充初始化：`prisma/init-monitor.sql`

## 2. 内网 Ubuntu 22 导入并启动

导入镜像：

```bash
docker load -i zhian-renwuguanli-0307.tar
```

启动服务：

```bash
docker compose -f docker-compose-offline.yml up -d
```

查看日志：

```bash
docker compose -f docker-compose-offline.yml logs -f app
```

停止服务：

```bash
docker compose -f docker-compose-offline.yml down
```

## 3. 数据库融合

这里的“数据库融合”指的是：生产环境 PostgreSQL 已经有原系统数据，现在把“监测提醒”模块对应的新表结构平滑加进去，而不影响既有 `User`、`Department`、`Task` 等旧数据。

### 3.1 原则

- 不要在已有数据的生产库上重新执行 `prisma/init.sql`
- 不要在生产库直接使用 `prisma db push`
- 只执行增量 SQL 或 `migrate deploy`
- 先备份，再测试，再生产执行

### 3.2 当前 0307 版本推荐做法

本次 0307 改动的监测提醒模块主要是新增：

- `monitor_plan`
- `monitor_item`
- `monitor_item_user`
- `monitor_rule`
- `monitor_instance`
- `monitor_notify_log`
- `monitor_operate_log`

以及相关枚举、索引、唯一约束。

因为这次主要是新增表，所以对旧业务数据影响较小，最稳妥的上线方式是直接执行增量 migration：

```bash
psql "$DATABASE_URL" -f prisma/migrations/20260307090000_add_monitor_module/migration.sql
```

如果你的线上库已经在规范使用 Prisma migration，也可以改为：

```bash
npx prisma migrate deploy
```

### 3.3 数据库备份与恢复

#### 3.3.1 生产库备份

**方式一：使用 DATABASE_URL 备份（推荐）**

```bash
# 设置数据库连接（如果是本地可直接用连接字符串）
export DATABASE_URL="postgresql://用户名:密码@localhost:5432/数据库名"

# 创建带时间戳的备份文件
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).dump"
pg_dump "$DATABASE_URL" -Fc -f "$BACKUP_FILE"

echo "备份完成: $BACKUP_FILE"
```

**方式二：直接指定参数备份**

```bash
# 自定义格式备份（推荐，支持选择性恢复）
pg_dump -h localhost -p 5432 -U 用户名 -d 数据库名 -Fc -f backup-custom.dump

# 纯文本 SQL 备份（可用于查看或编辑）
pg_dump -h localhost -p 5432 -U 用户名 -d 数据库名 -f backup-plain.sql

# 仅备份数据（不含结构）
pg_dump -h localhost -p 5432 -U 用户名 -d 数据库名 --data-only -f backup-data-only.sql

# 仅备份结构（不含数据）
pg_dump -h localhost -p 5432 -U 用户名 -d 数据库名 --schema-only -f backup-schema-only.sql
```

**方式三：备份特定表**

```bash
# 只备份指定表（多个表用空格分隔）
pg_dump -h localhost -p 5432 -U 用户名 -d 数据库名 -t monitor_plan -t monitor_item -Fc -f backup-monitor-only.dump
```

#### 3.3.2 备份恢复到测试环境

**步骤1：创建测试数据库**

```bash
# 使用 postgres 用户登录创建新数据库
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE renwu_test OWNER 用户名;"

# 或者使用 createdb 工具
createdb -h localhost -p 5432 -U postgres -O 用户名 renwu_test
```

**步骤2：恢复备份到测试库**

```bash
# 从自定义格式备份恢复（使用 pg_restore）
pg_restore -h localhost -p 5432 -U 用户名 -d renwu_test backup-custom.dump

# 如果恢复时遇到权限问题，以超级用户恢复
pg_restore -h localhost -p 5432 -U postgres -d renwu_test --no-owner --role=用户名 backup-custom.dump

# 从纯文本 SQL 备份恢复
psql -h localhost -p 5432 -U 用户名 -d renwu_test -f backup-plain.sql
```

**步骤3：恢复后验证**

```bash
# 连接测试库查看表
psql -h localhost -p 5432 -U 用户名 -d renwu_test -c "\dt"

# 查看用户数量
psql -h localhost -p 5432 -U 用户名 -d renwu_test -c "SELECT COUNT(*) FROM \"User\";"

# 查看任务数量
psql -h localhost -p 5432 -U 用户名 -d renwu_test -c "SELECT COUNT(*) FROM \"Task\";"
```

#### 3.3.3 0307 版本升级测试流程

1. **备份生产库**

```bash
export DATABASE_URL="postgresql://用户名:密码@生产库IP:5432/renwu_prod"
pg_dump "$DATABASE_URL" -Fc -f backup-before-0307.dump
```

2. **在测试库恢复备份并先执行 migration**

```bash
# 创建测试库
createdb -h localhost -p 5432 -U postgres renwu_test

# 恢复生产备份
pg_restore -h localhost -p 5432 -U postgres -d renwu_test --no-owner backup-before-0307.dump

# 执行 0307 版本的 migration（新增监测提醒模块表）
export TEST_DB_URL="postgresql://用户名:密码@localhost:5432/renwu_test?schema=public"
psql "$TEST_DB_URL" -f prisma/migrations/20260307090000_add_monitor_module/migration.sql
```

3. **启动 0307 镜像验证**

- 登录正常
- 原有任务流程正常
- `/monitor/plans` 页面可访问
- 可新建专项、事项、规则

4. 在生产维护窗口执行同一份 migration

```bash
psql "$DATABASE_URL" -f prisma/migrations/20260307090000_add_monitor_module/migration.sql
```

### 3.4 如果后续要改已有大表

后续若不是“新增模块”，而是要改已有大表，建议按下面顺序做：

1. 先加新列，尽量允许为空
2. 分批回填旧数据
3. 数据清洗完成后再加 `NOT NULL`
4. 唯一约束和外键放在最后
5. 大索引必要时单独执行

## 4. Oracle 11g 测试

监测提醒模块的短信发送不是 HTTP 接口，而是向 Oracle 11g 短信表插入数据。因此 Oracle 测试要分三层做。

### 4.1 测网络

先看 Ubuntu 22 到 Oracle 主机的 1521 端口是否通：

```bash
nc -vz <oracle_host> 1521
```

如果没有 `nc`：

```bash
telnet <oracle_host> 1521
```

这一步只能证明网络和监听端口是否通。

### 4.2 测监听

如果内网机器已安装 Oracle Instant Client，可用：

```bash
tnsping <service_name>
```

这一步只能证明 listener 是否响应。

### 4.3 测真实登录

最可靠的方式是 `sqlplus`：

```bash
sqlplus user/password@//host:1521/service_name
```

连接后执行：

```sql
select 1 from dual;
```

如果 DBA 提供的是 SID 而不是 service name，则连接串改成：

```bash
sqlplus user/password@host:1521/SID
```

### 4.4 测短信表插入

确认数据库账号具有目标短信表写权限后，再做一条真实插入测试：

```sql
INSERT INTO SMS_QUEUE (EID, MOBILE, CONTENT, PUSH_TIME, CREATED_AT)
VALUES ('TEST-0307-001', '13800000000', 'Oracle11g 连通测试', SYSDATE, SYSDATE);

COMMIT;
```

如果你们实际表名或字段名不同，用 DBA 提供的真实结构替换。

### 4.5 用项目配置测试

项目里 Oracle 相关环境变量如下：

```env
MONITOR_SMS_DRIVER=oracle
ORACLE_SMS_USER=your_user
ORACLE_SMS_PASSWORD=your_password
ORACLE_SMS_CONNECT_STRING=host:1521/service_name
ORACLE_SMS_TABLE=SMS_QUEUE
ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient
```

如果默认 SQL 不符合你们短信表结构，可以配置：

```env
ORACLE_SMS_INSERT_SQL=INSERT INTO SMS_QUEUE (EID, MOBILE, CONTENT, PUSH_TIME, CREATED_AT) VALUES (:eid, :mobile, :content, :pushTime, :createdAt)
```

### 4.6 Ubuntu 22 测试建议

由于 Oracle 11g 较老，Ubuntu 22 上建议优先按 thick mode 测试，不要优先依赖 thin mode。

推荐顺序：

1. `nc` / `telnet`
2. `sqlplus`
3. 手工 `insert`
4. 再切到项目里的 `MONITOR_SMS_DRIVER=oracle`

## 5. 最终上线建议

针对当前 0307 版本，建议你按下面顺序上线：

1. 外网构建并导出镜像
2. 内网导入镜像
3. 备份生产 PostgreSQL
4. 执行 `prisma/migrations/20260307090000_add_monitor_module/migration.sql`
5. 启动 `docker-compose-offline.yml`
6. 测试原系统功能
7. 测试监测提醒模块
8. 如需短信，再做 Oracle 11g 连通和插表验证
