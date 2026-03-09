# Windows Docker 环境下的真实短信联调命令清单

适用前提：

- 使用 Docker 部署项目
- 生产 `.env` 已配置 `MONITOR_SMS_DRIVER=oracle`
- 其他 Oracle 相关参数已经正确配置
- 容器名按当前项目默认值：`zhian-app`、`zhian-postgres`
- `docker-compose-offline.yml` 已改为从当前目录 `.env` 读取变量

## 0. 重要说明

### 0.1 compose 变量来源

当前 [docker-compose-offline.yml](/C:/Users/So/Desktop/project/renwuguanli_zhian/docker-compose-offline.yml) 已改为从当前目录的 `.env` 读取关键变量。

Docker 场景下，`.env` 里的关键值应与容器网络一致：

- `DATABASE_URL` 中主机名应写 `db`，不要写 `localhost`
- `MINIO_ENDPOINT` 应写 `http://minio:9000`
- `TZ` 建议统一设为 `Asia/Shanghai`

示例：

```env
DATABASE_URL="postgresql://postgres:Asd%40199312@db:5432/postgres?schema=public"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="Asd@199312"
POSTGRES_DB="postgres"

NODE_ENV="production"
TZ="Asia/Shanghai"

MINIO_ENDPOINT="http://minio:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="zhian_fujian"
COOKIE_SECURE="false"
```

每次修改 `.env` 后，需要重建容器环境：

```powershell
docker compose -f docker-compose-offline.yml down
docker compose -f docker-compose-offline.yml up -d
```

如果只是 `up -d`，旧容器里的环境变量可能不会按你的预期刷新。

### 0.1.2 时区会直接影响提醒时间

如果容器时区是 `UTC`，而你页面里配置的是 `11:35`，系统会按容器本地时间解释这个时间。

例如：

- 容器时间：`2026-03-09 03:40 UTC`
- 本机时间：`2026-03-09 11:40 Asia/Shanghai`

这时规则里的 `11:35` 会被理解为 `UTC 11:35`，换算到北京时间就是 `2026-03-09 19:35`。

所以在 Docker 环境下，必须显式设置：

```env
TZ="Asia/Shanghai"
```

并确保 `docker-compose-offline.yml` 已把 `TZ` 传给 `app` 和 `db` 容器。

### 0.1.1 Windows PowerShell 下不要直接用 `-d "{\"planId\":1}"`

在 Windows PowerShell 里，`curl.exe` 配合 JSON 字符串时很容易出现下面这种错误：

```text
curl: (3) unmatched close brace/bracket in URL position 11: planId\:1}
```

这不是接口本身报错，而是 PowerShell 对引号和花括号做了二次处理。

建议：

- 优先使用 `Invoke-RestMethod`
- 如果必须使用 `curl.exe`，请使用 `--data-raw "{""planId"":1}"` 这种写法

### 0.2 monitor 表不是 migration 漏掉

`prisma/migrations` 下的两个 SQL 本身包含 monitor 模块建表语句：

- `20260307090000_add_monitor_module/migration.sql`
- `20260307161000_add_monitor_item_status/migration.sql`

其中第一份 SQL 会创建这些核心表：

- `monitor_plan`
- `monitor_item`
- `monitor_item_user`
- `monitor_rule`
- `monitor_instance`
- `monitor_notify_log`
- `monitor_operate_log`

第二份 SQL 会补充：

- `MonitorItemStatus` 枚举
- `monitor_item.status` 字段
- `monitor_item_status_idx` 索引

如果运行后仍报 `public.monitor_plan does not exist`，通常不是 SQL 漏建，而是以下原因之一：

- SQL 没有执行到当前 Docker 正在使用的 PostgreSQL 容器
- 执行到了别的库、别的实例、或别的目录下的数据库
- 旧 volume 被复用，当前容器连接的是未初始化数据卷
- SQL 执行过程中中断，但没有完整检查执行结果

## 1. 基础确认

查看容器是否启动：

```powershell
docker ps
```

查看应用容器内短信相关环境变量是否生效：

```powershell
docker exec zhian-app printenv | findstr MONITOR_SMS_DRIVER
docker exec zhian-app printenv | findstr ORACLE_SMS_
docker exec zhian-app printenv | findstr ORACLE_CLIENT_LIB_DIR
```

预期至少看到：

- `MONITOR_SMS_DRIVER=oracle`
- `ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient`

检查 Oracle Client 是否已复制进容器：

```powershell
docker exec zhian-app sh -lc "ls -l /opt/oracle/instantclient"
docker exec zhian-app sh -lc "ls /opt/oracle/instantclient/libclntsh.so* /opt/oracle/instantclient/libnnz* /opt/oracle/instantclient/libocci.so*"
```

如果怀疑 `.env` 没生效，可以顺手确认数据库连接相关变量：

```powershell
docker exec zhian-app printenv | findstr DATABASE_URL
docker exec zhian-app printenv | findstr TZ
docker exec zhian-postgres printenv | findstr POSTGRES_
docker exec zhian-postgres printenv | findstr TZ
```

也可以直接检查容器当前时间：

```powershell
docker exec zhian-app date
docker exec zhian-postgres date
```

## 2. 观察应用日志

先打开应用日志，便于观察发送失败原因：

```powershell
docker logs -f zhian-app
```

如果不想持续跟随，也可以只看最后 200 行：

```powershell
docker logs --tail 200 zhian-app
```

## 3. 手动触发真实短信提醒

这套提醒功能不会仅靠页面配置就自动执行，除非额外配置了定时任务。手动联调时，需要按顺序调用以下接口。

以下命令优先给出 `Invoke-RestMethod` 写法，这是 Windows PowerShell 下最稳定的方式。

### 3.1 生成实例

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:3000/api/monitor/jobs/generate" `
  -Headers @{ "x-monitor-job-token" = "你的真实MONITOR_JOB_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"planId":1}'
```

如需使用 `curl.exe`：

```powershell
curl.exe -X POST "http://127.0.0.1:3000/api/monitor/jobs/generate" `
  -H "x-monitor-job-token: 你的真实MONITOR_JOB_TOKEN" `
  -H "Content-Type: application/json" `
  --data-raw "{""planId"":1}"
```

### 3.2 扫描提醒并触发短信

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:3000/api/monitor/jobs/scan" `
  -Headers @{ "x-monitor-job-token" = "你的真实MONITOR_JOB_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"planId":1}'
```

如需使用 `curl.exe`：

```powershell
curl.exe -X POST "http://127.0.0.1:3000/api/monitor/jobs/scan" `
  -H "x-monitor-job-token: 你的真实MONITOR_JOB_TOKEN" `
  -H "Content-Type: application/json" `
  --data-raw "{""planId"":1}"
```

### 3.3 重试失败短信

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:3000/api/monitor/jobs/retry" `
  -Headers @{ "x-monitor-job-token" = "你的真实MONITOR_JOB_TOKEN" } `
  -ContentType "application/json" `
  -Body '{}'
```

如需使用 `curl.exe`：

```powershell
curl.exe -X POST "http://127.0.0.1:3000/api/monitor/jobs/retry" `
  -H "x-monitor-job-token: 你的真实MONITOR_JOB_TOKEN" `
  -H "Content-Type: application/json" `
  --data-raw "{}"
```

如果要扫描全部专项，可以把 `planId` 去掉：

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:3000/api/monitor/jobs/generate" `
  -Headers @{ "x-monitor-job-token" = "你的真实MONITOR_JOB_TOKEN" } `
  -ContentType "application/json" `
  -Body '{}'

Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:3000/api/monitor/jobs/scan" `
  -Headers @{ "x-monitor-job-token" = "你的真实MONITOR_JOB_TOKEN" } `
  -ContentType "application/json" `
  -Body '{}'
```

## 4. 查看发送结果

查看提醒日志：

```powershell
curl.exe "http://127.0.0.1:3000/api/monitor/logs?page=1&pageSize=20"
```

只看短信日志：

```powershell
curl.exe "http://127.0.0.1:3000/api/monitor/logs?page=1&pageSize=20&channel=SMS"
```

只看失败短信：

```powershell
curl.exe "http://127.0.0.1:3000/api/monitor/logs?page=1&pageSize=20&channel=SMS&sendStatus=FAILED"
```

重点字段说明：

- `channel`
- `sendStatus`
- `failReason`
- `receiverMobile`
- `oracleEid`

结果判断：

- `SUCCESS`：应用认为已经成功写入 Oracle 短信队列
- `FAILED`：应用调用 Oracle 失败，应重点查看 `failReason`
- `SKIPPED`：通常表示手机号为空、重复去重、或规则当前不该触发

## 5. PostgreSQL 侧排查

如果怀疑没有生成实例或没有写通知日志，可以直接进入 PostgreSQL 检查。

进入数据库：

```powershell
docker exec -it zhian-postgres psql -U postgres -d postgres
```

先确认 monitor 表是否真的存在：

```sql
\dt monitor*
```

查看某个专项是否已生成实例：

```sql
select id, plan_id, item_id, period_key, due_at, status, remind_count
from monitor_instance
where plan_id = 你的专项ID
order by id desc
limit 20;
```

查看最新通知日志：

```sql
select id, instance_id, rule_id, channel, send_status, receiver_name, receiver_mobile, fail_reason, oracle_eid, created_at
from monitor_notify_log
order by id desc
limit 20;
```

查看某个专项的短信日志：

```sql
select l.id, i.plan_id, l.channel, l.send_status, l.receiver_name, l.receiver_mobile, l.fail_reason, l.oracle_eid, l.created_at
from monitor_notify_log l
join monitor_instance i on i.id = l.instance_id
where i.plan_id = 你的专项ID
order by l.id desc;
```

退出数据库：

```sql
\q
```

## 6. 建议的最小联调顺序

建议按以下顺序执行：

1. 确认容器和环境变量
2. 确认 `/opt/oracle/instantclient` 存在
3. 确认容器时间是 `Asia/Shanghai`
4. 调用 `generate`
5. 检查 `monitor_instance`
6. 到规则触发时间后再调用 `scan`
7. 检查 `monitor_notify_log`
8. 如有 `FAILED`，查看 `failReason`
9. 如为 `SUCCESS`，再到 Oracle 队列表确认是否成功入队

## 7. 常见失败原因

常见原因包括：

- `.env` 中 `DATABASE_URL` 仍写成 `localhost`
- `.env` 中 `MINIO_ENDPOINT` 仍写成 `localhost`
- `.env` 修改后未重建容器
- 容器时区仍是 `UTC`
- 没有先执行 `generate`
- 没有执行 `scan`
- 事项规则未启用
- 专项状态不是 `ENABLED`
- 事项状态不是 `ACTIVE`
- 提醒人员没有手机号
- 当前时间未达到规则触发条件
- `ORACLE_SMS_CONNECT_STRING` 不通
- Oracle 用户名或密码错误
- `ORACLE_SMS_QUEUE_USERID` 或 `ORACLE_SMS_QUEUE_PASSWORD` 未配置
- Oracle 队列表名或自定义 SQL 与实际库结构不匹配
- 容器内 Oracle Client 动态库缺失

## 8. 初始化 monitor 表的建议命令

如果当前数据库里没有 monitor 表，建议在当前 Docker 环境中重新执行 migration SQL，并立刻检查结果。

当前容器默认并没有把项目 SQL 文件挂载到数据库容器里。更稳妥的做法是从宿主机把 SQL 管道给数据库容器：

```powershell
Get-Content .\prisma\migrations\20260307090000_add_monitor_module\migration.sql | docker exec -i zhian-postgres psql -U postgres -d postgres
Get-Content .\prisma\migrations\20260307161000_add_monitor_item_status\migration.sql | docker exec -i zhian-postgres psql -U postgres -d postgres
```

执行后检查：

```powershell
docker exec -it zhian-postgres psql -U postgres -d postgres -c "\dt monitor*"
```

如果你想重建一个全新数据库环境，再执行初始化，也可以先删除旧数据卷：

```powershell
docker compose -f docker-compose-offline.yml down -v
docker compose -f docker-compose-offline.yml up -d
```

注意：`down -v` 会删除 PostgreSQL 和 MinIO 数据卷，只适合测试环境。

## 9. 最短测试命令集合

如果只想快速验证一遍真实短信链路，可直接执行以下命令：

```powershell
docker exec zhian-app printenv | findstr MONITOR_SMS_DRIVER
docker exec zhian-app printenv | findstr TZ
docker exec zhian-app date
docker exec zhian-app sh -lc "ls /opt/oracle/instantclient/libclntsh.so*"

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/monitor/jobs/generate" -Headers @{ "x-monitor-job-token" = "你的真实MONITOR_JOB_TOKEN" } -ContentType "application/json" -Body '{"planId":1}'
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/monitor/jobs/scan" -Headers @{ "x-monitor-job-token" = "你的真实MONITOR_JOB_TOKEN" } -ContentType "application/json" -Body '{"planId":1}'
curl.exe "http://127.0.0.1:3000/api/monitor/logs?page=1&pageSize=20&channel=SMS"
docker logs --tail 200 zhian-app
```
===
发短信的业务逻辑不是“时间一到自动发”，而是“`scan` 扫描时，如果规则命中，就写通知日志并发短信”。

核心流程在 [src/lib/monitor/reminder-service.ts](/C:/Users/So/Desktop/project/renwuguanli_zhian/src/lib/monitor/reminder-service.ts)：

1. 先取符合条件的实例  
要求：
- 专项 `ENABLED`
- 事项 `ACTIVE` 且 `isEnabled=true`
- 规则 `isEnabled=true`
- 实例状态在 `PENDING / OVERDUE / COMPLETED`

2. 对每条规则计算“当前这一刻是否命中”
关键看：
- `triggerType`：`BEFORE_DUE / ON_DUE / AFTER_DUE`
- `repeatType`：`ONCE / DAILY / WORKDAY_DAILY / EVERY_N_HOURS`
- `remindTime`
- 实例的 `dueAt`

3. 命中后不一定发送，还会继续判断是否跳过
会跳过的情况主要有：
- 今天这个触发键已经发过了，去重
- 达到 `maxTimes`
- 事项已完成且 `stopWhenDone=true`
- 没有提醒人员

4. 真正发送时
- `channelSystem=true` 会写系统通知
- `channelSms=true` 才会走短信
- 短信调用 Oracle 队列发送

你这次最关键的线索不是“14:27 没收到”，而是你之前 `scan` 的结果：

```text
createdLogCount=0
sentCount=0
failedCount=0
skippedCount=3
```

这说明不是“短信发送失败”，而是“规则命中了，但被跳过了”。因为如果根本没命中时间窗口，`createdLogCount` 会是 0，但通常不会出现这类命中后的 `skippedCount`。

按代码，命中后被跳过只剩这几种高概率原因：

- 这条规则今天这个时间点已经扫过一次，去重了
- 规则设置了 `maxTimes`，次数用完了
- 实例已完成，且 `stopWhenDone=true`
- 提醒人员列表为空

你说“提醒人员是我”，那更大的嫌疑就是前两项，尤其是“今天已经为这个规则生成过同一个 `triggerKey`”。

还有一个常见误区：
你把规则从 `14:25` 改成 `14:27`，并不代表系统会在 `14:27:00` 主动自己跑。必须在 `14:27` 之后你再执行一次：

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:3000/api/monitor/jobs/scan" `
  -Headers @{ "x-monitor-job-token" = "你的真实MONITOR_JOB_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"planId":1}'
```

如果你是 `14:26` 扫了一次，然后等到 `14:27` 什么都不做，它不会自己发。

你现在最应该查的是“为什么被 skip”。直接跑这三条 SQL：

1. 查今天是否已经有该规则的通知日志
```powershell
docker exec -it zhian-postgres psql -U postgres -d postgres -c "select id, instance_id, rule_id, trigger_key, channel, send_status, receiver_name, receiver_mobile, fail_reason, created_at from monitor_notify_log order by id desc limit 50;"
```

2. 查规则本身
```powershell
docker exec -it zhian-postgres psql -U postgres -d postgres -c "select id, item_id, rule_name, trigger_type, repeat_type, remind_time, max_times, channel_sms, channel_system, stop_when_done, is_enabled from monitor_rule order by id desc;"
```

3. 查实例状态
```powershell
docker exec -it zhian-postgres psql -U postgres -d postgres -c "select id, plan_id, item_id, due_at, status, remind_count, first_remind_at, last_remind_at from monitor_instance where plan_id = 1 order by id desc;"
```

如果你把这三条结果贴出来，我可以直接告诉你是：
- 已经去重了
- `maxTimes` 限制住了
- 实例已完成
- 还是规则类型本身和你预期不一致

目前从你给出的现象看，最像的是“你改了时间，但这条规则在今天这个周期已经被去重了”，不是 Oracle 短信通道本身有问题。
===
现在可以确定一件事：

`scan` 的结果一直是

- `createdLogCount=0`
- `skippedCount=0`

这说明不是“短信发送失败”，也不是“提醒人为空被跳过”，而是**规则时间判断根本没有命中**。

按当前代码，出现这种结果，最可能只剩两类原因：

1. 你执行 `scan` 时，容器里的“当前时间”还没到规则应触发的时间  
2. 规则的 `offset_days / offset_hours` 实际并没有变成你以为的值

你刚才贴的 SQL 里没有查 `offset_days` 和 `offset_hours`，所以现在还不能证明“偏移 2 小时”真的保存进数据库了。

先直接跑这 3 条，别改别的：

```powershell
docker exec zhian-app date
docker exec zhian-app printenv | findstr TZ
docker exec -it zhian-postgres psql -U postgres -d postgres -c "select id, item_id, rule_name, trigger_type, repeat_type, offset_days, offset_hours, remind_time, channel_sms, channel_system, is_enabled from monitor_rule order by id desc;"
```

我先把当前逻辑给你压缩成结论：

**如果规则是 `ON_DUE + DAILY + 15:09:00`**
- 只会在“实例截止当天”触发
- 今天这条实例是 `2026-03-09 17:00:00`
- 所以只有在容器时间已经到 `2026-03-09 15:09` 之后，再执行 `scan`，才会命中

**如果规则是 `BEFORE_DUE + DAILY + offset_hours=2 + 15:07:00`**
- 截止时间 `17:00`
- anchor 会变成 `15:00`
- 只有在容器时间到 `2026-03-09 15:07` 之后，再执行 `scan`，才会命中
- 但前提是数据库里 `offset_hours` 真的是 `2`

你现在最像是这两种情况之一：
- 容器时间虽然修了时区，但你执行 `scan` 的实际时刻仍早于规则时间
- UI 改了偏移，但数据库没保存成功

再补一个容易忽略的点：  
你每次贴出来的规则查询，时间确实变了，但你从来没贴 `offset_days / offset_hours`。所以“第二版和第三版”是否真的生效，目前证据不够。

**下一步最有效的验证方式**

1. 把规则改成一个明确的未来时间，比如当前是 `2026-03-09 15:20`，就改成：
- `ON_DUE`
- `DAILY`
- `remind_time = 15:25:00`

2. 到 `2026-03-09 15:26` 之后，先看容器时间：
```powershell
docker exec zhian-app date
```

3. 然后立刻执行：
```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:3000/api/monitor/jobs/scan" `
  -Headers @{ "x-monitor-job-token" = "asd199312" } `
  -ContentType "application/json" `
  -Body '{"planId":2}'
```

4. 再查：
```powershell
docker exec -it zhian-postgres psql -U postgres -d postgres -c "select id, instance_id, rule_id, trigger_key, channel, send_status, receiver_name, receiver_mobile, fail_reason, created_at from monitor_notify_log order by id desc limit 20;"
```

**如果还不出日志**
那就基本可以锁定为配置保存问题或代码判断 bug。  
到那一步，我建议直接查这两张表：

```powershell
docker exec -it zhian-postgres psql -U postgres -d postgres -c "select id, item_id, rule_name, trigger_type, repeat_type, offset_days, offset_hours, remind_time, max_times, channel_sms, channel_system, stop_when_done, is_enabled from monitor_rule order by id desc;"
```

```powershell
docker exec -it zhian-postgres psql -U postgres -d postgres -c "select item_id, user_id, user_name, mobile, role_type, is_enabled from monitor_item_user where item_id = 2 order by id;"
```

把这两条结果和 `docker exec zhian-app date` 的输出贴出来，我可以直接判断是：
- 时间没到
- 偏移没保存
- 提醒人手机号没落库
- 还是代码里的规则判断有缺陷。