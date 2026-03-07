CREATE TYPE "MonitorPlanStatus" AS ENUM ('DRAFT', 'ENABLED', 'PAUSED', 'FINISHED');

CREATE TYPE "MonitorCycleType" AS ENUM ('ONCE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM');

CREATE TYPE "MonitorCompleteMode" AS ENUM ('MANUAL_CLICK');

CREATE TYPE "MonitorItemUserRoleType" AS ENUM ('OWNER', 'REMIND', 'CC');

CREATE TYPE "MonitorTriggerType" AS ENUM ('BEFORE_DUE', 'ON_DUE', 'AFTER_DUE');

CREATE TYPE "MonitorRepeatType" AS ENUM ('ONCE', 'DAILY', 'WORKDAY_DAILY', 'EVERY_N_HOURS');

CREATE TYPE "MonitorInstanceStatus" AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED');

CREATE TYPE "MonitorNotifyChannel" AS ENUM ('SMS', 'SYSTEM');

CREATE TYPE "MonitorNotifySendStatus" AS ENUM ('READY', 'SUCCESS', 'FAILED', 'SKIPPED');

CREATE TYPE "MonitorOperateActionType" AS ENUM (
  'CREATE_PLAN',
  'UPDATE_PLAN',
  'CHANGE_PLAN_STATUS',
  'CREATE_ITEM',
  'UPDATE_ITEM',
  'DISABLE_ITEM',
  'CONFIG_ITEM_USER',
  'CREATE_RULE',
  'UPDATE_RULE',
  'CHANGE_RULE_STATUS',
  'GENERATE_INSTANCE',
  'MARK_OVERDUE',
  'COMPLETE',
  'REOPEN',
  'SEND_REMIND',
  'COMPENSATE_NOTIFY',
  'RULE_CHANGE'
);

CREATE TABLE "monitor_plan" (
  "id" SERIAL NOT NULL,
  "plan_code" TEXT NOT NULL,
  "plan_name" TEXT NOT NULL,
  "plan_type" TEXT,
  "source_task_id" INTEGER,
  "owner_dept_id" INTEGER NOT NULL,
  "owner_dept_name" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "status" "MonitorPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "remark" TEXT,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_flag" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "monitor_plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monitor_item" (
  "id" SERIAL NOT NULL,
  "plan_id" INTEGER NOT NULL,
  "item_code" TEXT NOT NULL,
  "item_name" TEXT NOT NULL,
  "item_category" TEXT,
  "cycle_type" "MonitorCycleType" NOT NULL DEFAULT 'ONCE',
  "cycle_conf" JSONB,
  "due_time" TEXT NOT NULL DEFAULT '17:00:00',
  "complete_mode" "MonitorCompleteMode" NOT NULL DEFAULT 'MANUAL_CLICK',
  "need_attachment" BOOLEAN NOT NULL DEFAULT FALSE,
  "need_remark" BOOLEAN NOT NULL DEFAULT FALSE,
  "sort_no" INTEGER NOT NULL DEFAULT 0,
  "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "remark" TEXT,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monitor_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monitor_item_user" (
  "id" SERIAL NOT NULL,
  "item_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "user_name" TEXT NOT NULL,
  "dept_id" INTEGER,
  "dept_name" TEXT,
  "mobile" TEXT,
  "role_type" "MonitorItemUserRoleType" NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitor_item_user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monitor_rule" (
  "id" SERIAL NOT NULL,
  "item_id" INTEGER NOT NULL,
  "rule_name" TEXT NOT NULL,
  "trigger_type" "MonitorTriggerType" NOT NULL,
  "offset_days" INTEGER NOT NULL DEFAULT 0,
  "offset_hours" INTEGER NOT NULL DEFAULT 0,
  "repeat_type" "MonitorRepeatType" NOT NULL DEFAULT 'ONCE',
  "repeat_interval" INTEGER,
  "remind_time" TEXT,
  "max_times" INTEGER,
  "channel_sms" BOOLEAN NOT NULL DEFAULT FALSE,
  "channel_system" BOOLEAN NOT NULL DEFAULT TRUE,
  "stop_when_done" BOOLEAN NOT NULL DEFAULT TRUE,
  "content_tpl" TEXT,
  "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monitor_rule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monitor_instance" (
  "id" SERIAL NOT NULL,
  "plan_id" INTEGER NOT NULL,
  "item_id" INTEGER NOT NULL,
  "instance_code" TEXT NOT NULL,
  "period_key" TEXT NOT NULL,
  "period_label" TEXT NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "status" "MonitorInstanceStatus" NOT NULL DEFAULT 'PENDING',
  "completed_by" INTEGER,
  "completed_by_name" TEXT,
  "completed_at" TIMESTAMP(3),
  "complete_remark" TEXT,
  "attachment_json" JSONB,
  "remind_count" INTEGER NOT NULL DEFAULT 0,
  "first_remind_at" TIMESTAMP(3),
  "last_remind_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monitor_instance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monitor_notify_log" (
  "id" SERIAL NOT NULL,
  "instance_id" INTEGER NOT NULL,
  "rule_id" INTEGER NOT NULL,
  "trigger_key" TEXT NOT NULL,
  "receiver_user_id" INTEGER,
  "receiver_name" TEXT NOT NULL,
  "receiver_mobile" TEXT,
  "channel" "MonitorNotifyChannel" NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "biz_dedupe_key" TEXT NOT NULL,
  "send_status" "MonitorNotifySendStatus" NOT NULL DEFAULT 'READY',
  "send_time" TIMESTAMP(3),
  "fail_reason" TEXT,
  "oracle_eid" TEXT,
  "oracle_push_time" TIMESTAMP(3),
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitor_notify_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monitor_operate_log" (
  "id" SERIAL NOT NULL,
  "plan_id" INTEGER,
  "item_id" INTEGER,
  "instance_id" INTEGER,
  "action_type" "MonitorOperateActionType" NOT NULL,
  "operator_id" INTEGER,
  "operator_name" TEXT,
  "operator_dept_id" INTEGER,
  "operator_ip" TEXT,
  "detail_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitor_operate_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monitor_plan_plan_code_key" ON "monitor_plan"("plan_code");

CREATE UNIQUE INDEX "monitor_item_plan_id_item_code_key" ON "monitor_item"("plan_id", "item_code");

CREATE UNIQUE INDEX "monitor_item_user_item_id_user_id_role_type_key"
  ON "monitor_item_user"("item_id", "user_id", "role_type");

CREATE UNIQUE INDEX "monitor_instance_item_id_period_key_key"
  ON "monitor_instance"("item_id", "period_key");

CREATE UNIQUE INDEX "monitor_instance_instance_code_key"
  ON "monitor_instance"("instance_code");

CREATE UNIQUE INDEX "monitor_notify_log_biz_dedupe_key_key"
  ON "monitor_notify_log"("biz_dedupe_key");

CREATE INDEX "monitor_plan_status_end_date_idx"
  ON "monitor_plan"("status", "end_date");

CREATE INDEX "monitor_plan_owner_dept_id_idx"
  ON "monitor_plan"("owner_dept_id");

CREATE INDEX "monitor_plan_source_task_id_idx"
  ON "monitor_plan"("source_task_id");

CREATE INDEX "monitor_plan_deleted_flag_idx"
  ON "monitor_plan"("deleted_flag");

CREATE INDEX "monitor_item_plan_id_is_enabled_idx"
  ON "monitor_item"("plan_id", "is_enabled");

CREATE INDEX "monitor_item_cycle_type_idx"
  ON "monitor_item"("cycle_type");

CREATE INDEX "monitor_item_user_item_role_enabled_idx"
  ON "monitor_item_user"("item_id", "role_type", "is_enabled");

CREATE INDEX "monitor_item_user_user_id_idx"
  ON "monitor_item_user"("user_id");

CREATE INDEX "monitor_rule_item_id_is_enabled_idx"
  ON "monitor_rule"("item_id", "is_enabled");

CREATE INDEX "monitor_rule_trigger_repeat_idx"
  ON "monitor_rule"("trigger_type", "repeat_type");

CREATE INDEX "monitor_instance_plan_id_status_idx"
  ON "monitor_instance"("plan_id", "status");

CREATE INDEX "monitor_instance_item_id_idx"
  ON "monitor_instance"("item_id");

CREATE INDEX "monitor_instance_due_at_status_idx"
  ON "monitor_instance"("due_at", "status");

CREATE INDEX "monitor_instance_last_remind_at_idx"
  ON "monitor_instance"("last_remind_at");

CREATE INDEX "monitor_notify_log_instance_rule_trigger_idx"
  ON "monitor_notify_log"("instance_id", "rule_id", "trigger_key");

CREATE INDEX "monitor_notify_log_send_status_created_at_idx"
  ON "monitor_notify_log"("send_status", "created_at");

CREATE INDEX "monitor_notify_log_receiver_user_id_idx"
  ON "monitor_notify_log"("receiver_user_id");

CREATE INDEX "monitor_operate_log_plan_id_created_at_idx"
  ON "monitor_operate_log"("plan_id", "created_at");

CREATE INDEX "monitor_operate_log_item_id_created_at_idx"
  ON "monitor_operate_log"("item_id", "created_at");

CREATE INDEX "monitor_operate_log_instance_id_created_at_idx"
  ON "monitor_operate_log"("instance_id", "created_at");

CREATE INDEX "monitor_operate_log_action_type_created_at_idx"
  ON "monitor_operate_log"("action_type", "created_at");

ALTER TABLE "monitor_item"
  ADD CONSTRAINT "monitor_item_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "monitor_plan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitor_item_user"
  ADD CONSTRAINT "monitor_item_user_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "monitor_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitor_rule"
  ADD CONSTRAINT "monitor_rule_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "monitor_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitor_instance"
  ADD CONSTRAINT "monitor_instance_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "monitor_plan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitor_instance"
  ADD CONSTRAINT "monitor_instance_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "monitor_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitor_notify_log"
  ADD CONSTRAINT "monitor_notify_log_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "monitor_instance"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitor_notify_log"
  ADD CONSTRAINT "monitor_notify_log_rule_id_fkey"
  FOREIGN KEY ("rule_id") REFERENCES "monitor_rule"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitor_operate_log"
  ADD CONSTRAINT "monitor_operate_log_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "monitor_plan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "monitor_operate_log"
  ADD CONSTRAINT "monitor_operate_log_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "monitor_item"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "monitor_operate_log"
  ADD CONSTRAINT "monitor_operate_log_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "monitor_instance"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
