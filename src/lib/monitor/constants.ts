export const MONITOR_DEFAULT_TEMPLATE =
  "【基础管控中心专项工作监测提醒】{planName} - {itemName}（{periodLabel}）尚未完成，请于 {dueAt} 前处理。";

export const MONITOR_PLAN_STATUS = [
  "DRAFT",
  "ENABLED",
  "PAUSED",
  "FINISHED",
] as const;

export const MONITOR_CYCLE_TYPES = [
  "ONCE",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "CUSTOM",
] as const;

export const MONITOR_COMPLETE_MODES = ["MANUAL_CLICK"] as const;

export const MONITOR_ITEM_USER_ROLE_TYPES = ["OWNER", "REMIND", "CC"] as const;

export const MONITOR_TRIGGER_TYPES = [
  "BEFORE_DUE",
  "ON_DUE",
  "AFTER_DUE",
] as const;

export const MONITOR_REPEAT_TYPES = [
  "ONCE",
  "DAILY",
  "WORKDAY_DAILY",
  "EVERY_N_HOURS",
] as const;

export const MONITOR_INSTANCE_STATUS = [
  "PENDING",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED",
] as const;

export const MONITOR_NOTIFY_CHANNELS = ["SMS", "SYSTEM"] as const;

export const MONITOR_NOTIFY_SEND_STATUS = [
  "READY",
  "SUCCESS",
  "FAILED",
  "SKIPPED",
] as const;

export const MONITOR_OPERATE_ACTIONS = [
  "CREATE_PLAN",
  "UPDATE_PLAN",
  "CHANGE_PLAN_STATUS",
  "CREATE_ITEM",
  "UPDATE_ITEM",
  "DISABLE_ITEM",
  "CONFIG_ITEM_USER",
  "CREATE_RULE",
  "UPDATE_RULE",
  "CHANGE_RULE_STATUS",
  "GENERATE_INSTANCE",
  "MARK_OVERDUE",
  "COMPLETE",
  "REOPEN",
  "SEND_REMIND",
  "COMPENSATE_NOTIFY",
  "RULE_CHANGE",
] as const;

export type MonitorPlanStatusValue = (typeof MONITOR_PLAN_STATUS)[number];
export type MonitorCycleTypeValue = (typeof MONITOR_CYCLE_TYPES)[number];
export type MonitorCompleteModeValue = (typeof MONITOR_COMPLETE_MODES)[number];
export type MonitorItemUserRoleTypeValue =
  (typeof MONITOR_ITEM_USER_ROLE_TYPES)[number];
export type MonitorTriggerTypeValue = (typeof MONITOR_TRIGGER_TYPES)[number];
export type MonitorRepeatTypeValue = (typeof MONITOR_REPEAT_TYPES)[number];
export type MonitorInstanceStatusValue =
  (typeof MONITOR_INSTANCE_STATUS)[number];
export type MonitorNotifyChannelValue =
  (typeof MONITOR_NOTIFY_CHANNELS)[number];
export type MonitorNotifySendStatusValue =
  (typeof MONITOR_NOTIFY_SEND_STATUS)[number];
export type MonitorOperateActionTypeValue =
  (typeof MONITOR_OPERATE_ACTIONS)[number];

export const MONITOR_PLAN_STATUS_LABELS: Record<MonitorPlanStatusValue, string> = {
  DRAFT: "草稿",
  ENABLED: "启用中",
  PAUSED: "已暂停",
  FINISHED: "已结束",
};

export const MONITOR_CYCLE_TYPE_LABELS: Record<MonitorCycleTypeValue, string> = {
  ONCE: "一次性",
  WEEKLY: "每周",
  MONTHLY: "每月",
  QUARTERLY: "每季度",
  CUSTOM: "自定义",
};

export const MONITOR_ITEM_USER_ROLE_LABELS: Record<
  MonitorItemUserRoleTypeValue,
  string
> = {
  OWNER: "责任人",
  REMIND: "提醒对象",
  CC: "抄送人",
};

export const MONITOR_TRIGGER_TYPE_LABELS: Record<
  MonitorTriggerTypeValue,
  string
> = {
  BEFORE_DUE: "到期前",
  ON_DUE: "到期当天",
  AFTER_DUE: "逾期后",
};

export const MONITOR_REPEAT_TYPE_LABELS: Record<
  MonitorRepeatTypeValue,
  string
> = {
  ONCE: "仅一次",
  DAILY: "每天一次",
  WORKDAY_DAILY: "工作日每天",
  EVERY_N_HOURS: "每 N 小时",
};

export const MONITOR_INSTANCE_STATUS_LABELS: Record<
  MonitorInstanceStatusValue,
  string
> = {
  PENDING: "待完成",
  COMPLETED: "已完成",
  OVERDUE: "已逾期",
  CANCELLED: "已取消",
};

export const MONITOR_NOTIFY_CHANNEL_LABELS: Record<
  MonitorNotifyChannelValue,
  string
> = {
  SMS: "短信提醒",
  SYSTEM: "系统内提醒",
};

export const MONITOR_NOTIFY_SEND_STATUS_LABELS: Record<
  MonitorNotifySendStatusValue,
  string
> = {
  READY: "待发送",
  SUCCESS: "发送成功",
  FAILED: "发送失败",
  SKIPPED: "已跳过",
};
