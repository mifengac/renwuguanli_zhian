import { MONITOR_PLAN_STATUS_LABELS } from "@/lib/monitor/constants";

export type MonitorCurrentUser = {
  id: number;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  departmentId: number | null;
};

export type MonitorUserOption = {
  id: number;
  name: string;
  badgeNo: string;
  departmentId: number | null;
  departmentName: string | null;
};

export type MonitorItemUserRow = {
  id: number;
  userId: number;
  userName: string;
  deptId: number | null;
  deptName: string | null;
  mobile: string | null;
  roleType: "OWNER" | "REMIND" | "CC";
  isPrimary: boolean;
  isEnabled: boolean;
};

export type MonitorRuleRow = {
  id: number;
  ruleName: string;
  triggerType: "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE";
  offsetDays: number;
  offsetHours: number;
  repeatType: "ONCE" | "DAILY" | "WORKDAY_DAILY" | "EVERY_N_HOURS";
  repeatInterval: number | null;
  remindTime: string | null;
  maxTimes: number | null;
  channelSms: boolean;
  channelSystem: boolean;
  stopWhenDone: boolean;
  contentTpl: string | null;
  isEnabled: boolean;
};

export type MonitorItemRow = {
  id: number;
  planId: number;
  itemCode: string;
  itemName: string;
  itemCategory: string | null;
  status: "ACTIVE" | "COMPLETED";
  cycleType: "ONCE" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "CUSTOM";
  cycleConf: Record<string, unknown> | null;
  dueTime: string;
  needAttachment: boolean;
  needRemark: boolean;
  sortNo: number;
  isEnabled: boolean;
  remark: string | null;
  itemUsers: MonitorItemUserRow[];
  rules: MonitorRuleRow[];
  _count?: {
    instances: number;
  };
};

export type MonitorPlanDetail = {
  id: number;
  planCode: string;
  planName: string;
  planType: string | null;
  sourceTaskId: number | null;
  ownerDeptId: number;
  ownerDeptName: string;
  startDate: string;
  endDate: string | null;
  status: keyof typeof MONITOR_PLAN_STATUS_LABELS;
  remark: string | null;
  items: MonitorItemRow[];
  _count?: {
    items: number;
    instances: number;
  };
};

export type MonitorNotifyLogRow = {
  id: number;
  receiverName: string;
  receiverMobile: string | null;
  channel: "SMS" | "SYSTEM";
  title: string | null;
  content: string;
  sendStatus: "READY" | "SUCCESS" | "FAILED" | "SKIPPED";
  sendTime: string | null;
  failReason: string | null;
  createdAt: string;
  rule?: {
    id: number;
    ruleName: string;
  } | null;
};

export type MonitorInstanceRow = {
  id: number;
  planId: number;
  itemId: number;
  periodKey: string;
  periodLabel: string;
  dueAt: string;
  status: "PENDING" | "COMPLETED" | "OVERDUE" | "CANCELLED";
  completedAt: string | null;
  completeRemark: string | null;
  attachmentJson: Array<{
    fileName: string;
    objectKey: string;
    size: number;
    uploadedAt: string;
  }> | null;
  remindCount: number;
  lastRemindAt: string | null;
  plan: {
    id: number;
    planName: string;
    ownerDeptId: number;
    ownerDeptName: string;
  };
  item: {
    id: number;
    itemName: string;
    needAttachment: boolean;
    needRemark: boolean;
    itemUsers: MonitorItemUserRow[];
  };
};
