import { Prisma } from "@/generated/prisma/client";
import {
  MONITOR_CYCLE_TYPES,
  MONITOR_ITEM_USER_ROLE_TYPES,
  MONITOR_NOTIFY_CHANNELS,
  MONITOR_PLAN_STATUS,
  MONITOR_REPEAT_TYPES,
  MONITOR_TRIGGER_TYPES,
  MonitorCycleTypeValue,
  MonitorItemUserRoleTypeValue,
  MonitorPlanStatusValue,
  MonitorRepeatTypeValue,
  MonitorTriggerTypeValue,
} from "@/lib/monitor/constants";
import {
  normalizeTimeString,
  parseDateOnly,
  parseJsonObject,
} from "@/lib/monitor/utils";

function asObject(input: unknown): Record<string, unknown> {
  return parseJsonObject(input) ?? {};
}

function toPositiveInt(value: unknown): number | null {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : null;
}

function toNonNegativeInt(value: unknown): number {
  const next = Number(value);
  return Number.isInteger(next) && next >= 0 ? next : 0;
}

function isCycleType(value: unknown): value is MonitorCycleTypeValue {
  return typeof value === "string" && MONITOR_CYCLE_TYPES.includes(value as MonitorCycleTypeValue);
}

function isTriggerType(value: unknown): value is MonitorTriggerTypeValue {
  return typeof value === "string" && MONITOR_TRIGGER_TYPES.includes(value as MonitorTriggerTypeValue);
}

function isRepeatType(value: unknown): value is MonitorRepeatTypeValue {
  return typeof value === "string" && MONITOR_REPEAT_TYPES.includes(value as MonitorRepeatTypeValue);
}

function isRoleType(value: unknown): value is MonitorItemUserRoleTypeValue {
  return (
    typeof value === "string" &&
    MONITOR_ITEM_USER_ROLE_TYPES.includes(value as MonitorItemUserRoleTypeValue)
  );
}

function isPlanStatus(value: unknown): value is MonitorPlanStatusValue {
  return typeof value === "string" && MONITOR_PLAN_STATUS.includes(value as MonitorPlanStatusValue);
}

export function parsePlanInput(body: unknown) {
  const data = asObject(body);
  const planCode =
    typeof data.planCode === "string" ? data.planCode.trim().toUpperCase() : "";
  const planName =
    typeof data.planName === "string" ? data.planName.trim() : "";
  const planType =
    typeof data.planType === "string" && data.planType.trim()
      ? data.planType.trim()
      : null;
  const ownerDeptId = toPositiveInt(data.ownerDeptId);
  const sourceTaskId = toPositiveInt(data.sourceTaskId);
  const startDate =
    typeof data.startDate === "string" ? parseDateOnly(data.startDate) : null;
  const endDate =
    typeof data.endDate === "string" && data.endDate.trim()
      ? parseDateOnly(data.endDate)
      : null;
  const remark =
    typeof data.remark === "string" && data.remark.trim()
      ? data.remark.trim()
      : null;
  const status =
    data.status && isPlanStatus(data.status) ? data.status : undefined;

  if (!planCode) return { error: "专项编码不能为空" } as const;
  if (!planName) return { error: "专项名称不能为空" } as const;
  if (!ownerDeptId) return { error: "请选择牵头部门" } as const;
  if (!startDate) return { error: "开始日期格式不正确" } as const;
  if (endDate && endDate < startDate) return { error: "结束日期不能早于开始日期" } as const;

  return {
    data: {
      planCode,
      planName,
      planType,
      ownerDeptId,
      sourceTaskId,
      startDate,
      endDate,
      remark,
      status,
    },
  } as const;
}

function normalizeCycleConf(
  cycleType: MonitorCycleTypeValue,
  cycleConfRaw: unknown
): Prisma.InputJsonValue {
  const cycleConf = asObject(cycleConfRaw);

  if (cycleType === "ONCE") {
    if (typeof cycleConf.fixedDueDate !== "string" || !parseDateOnly(cycleConf.fixedDueDate)) {
      throw new Error("一次性事项必须配置 fixedDueDate");
    }

    return {
      fixedDueDate: cycleConf.fixedDueDate,
    };
  }

  if (cycleType === "WEEKLY") {
    const weekday = toPositiveInt(cycleConf.weekday);
    if (!weekday || weekday < 1 || weekday > 7) {
      throw new Error("每周事项必须配置 1-7 的 weekday");
    }

    return {
      weekday,
    };
  }

  if (cycleType === "MONTHLY") {
    const dayOfMonth = toPositiveInt(cycleConf.dayOfMonth);
    if (!dayOfMonth || dayOfMonth > 31) {
      throw new Error("每月事项必须配置 1-31 的 dayOfMonth");
    }

    return {
      dayOfMonth,
    };
  }

  if (cycleType === "QUARTERLY") {
    const quarterMonth = toPositiveInt(cycleConf.quarterMonth) ?? 3;
    const dayOfMonth = toPositiveInt(cycleConf.dayOfMonth);
    if (quarterMonth < 1 || quarterMonth > 3) {
      throw new Error("季度事项的 quarterMonth 只能是 1-3");
    }
    if (!dayOfMonth || dayOfMonth > 31) {
      throw new Error("季度事项必须配置 1-31 的 dayOfMonth");
    }

    return {
      quarterMonth,
      dayOfMonth,
    };
  }

  return (Object.keys(cycleConf).length > 0 ? cycleConf : { dueDates: [] }) as Prisma.InputJsonValue;
}

export function parseItemInput(body: unknown) {
  const data = asObject(body);
  const itemCode =
    typeof data.itemCode === "string" ? data.itemCode.trim().toUpperCase() : "";
  const itemName =
    typeof data.itemName === "string" ? data.itemName.trim() : "";
  const itemCategory =
    typeof data.itemCategory === "string" && data.itemCategory.trim()
      ? data.itemCategory.trim()
      : null;
  const cycleType = isCycleType(data.cycleType) ? data.cycleType : null;
  const dueTime = normalizeTimeString(
    typeof data.dueTime === "string" ? data.dueTime : undefined
  );
  const needAttachment = Boolean(data.needAttachment);
  const needRemark = Boolean(data.needRemark);
  const sortNo = toNonNegativeInt(data.sortNo);
  const isEnabled = data.isEnabled === undefined ? true : Boolean(data.isEnabled);
  const remark =
    typeof data.remark === "string" && data.remark.trim()
      ? data.remark.trim()
      : null;

  if (!itemCode) return { error: "事项编码不能为空" } as const;
  if (!itemName) return { error: "事项名称不能为空" } as const;
  if (!cycleType) return { error: "请选择周期类型" } as const;

  try {
    const cycleConf = normalizeCycleConf(cycleType, data.cycleConf);

    return {
      data: {
        itemCode,
        itemName,
        itemCategory,
        cycleType,
        cycleConf,
        dueTime,
        completeMode: "MANUAL_CLICK" as const,
        needAttachment,
        needRemark,
        sortNo,
        isEnabled,
        remark,
      },
    } as const;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "事项周期配置不正确",
    } as const;
  }
}

export function parseRuleInput(body: unknown) {
  const data = asObject(body);
  const ruleName =
    typeof data.ruleName === "string" ? data.ruleName.trim() : "";
  const triggerType = isTriggerType(data.triggerType) ? data.triggerType : null;
  const offsetDays = toNonNegativeInt(data.offsetDays);
  const offsetHours = toNonNegativeInt(data.offsetHours);
  const repeatType = isRepeatType(data.repeatType) ? data.repeatType : null;
  const repeatInterval =
    data.repeatInterval == null ? null : toPositiveInt(data.repeatInterval);
  const remindTime =
    typeof data.remindTime === "string" && data.remindTime.trim()
      ? normalizeTimeString(data.remindTime, "09:00:00")
      : null;
  const maxTimes = data.maxTimes == null ? null : toPositiveInt(data.maxTimes);
  const channelSms = Boolean(data.channelSms);
  const channelSystem = Boolean(data.channelSystem);
  const stopWhenDone =
    data.stopWhenDone === undefined ? true : Boolean(data.stopWhenDone);
  const contentTpl =
    typeof data.contentTpl === "string" && data.contentTpl.trim()
      ? data.contentTpl.trim()
      : null;
  const isEnabled = data.isEnabled === undefined ? true : Boolean(data.isEnabled);

  if (!ruleName) return { error: "规则名称不能为空" } as const;
  if (!triggerType) return { error: "请选择触发类型" } as const;
  if (!repeatType) return { error: "请选择重复方式" } as const;
  if (!channelSms && !channelSystem) {
    return { error: "请至少启用一种提醒渠道" } as const;
  }
  if (repeatType === "EVERY_N_HOURS" && !repeatInterval) {
    return { error: "每 N 小时提醒必须配置 repeatInterval" } as const;
  }

  return {
    data: {
      ruleName,
      triggerType,
      offsetDays,
      offsetHours,
      repeatType,
      repeatInterval,
      remindTime,
      maxTimes,
      channelSms,
      channelSystem,
      stopWhenDone,
      contentTpl,
      isEnabled,
    },
  } as const;
}

export type ParsedItemUserInput = {
  userId: number;
  roleType: MonitorItemUserRoleTypeValue;
  mobile: string | null;
  isPrimary: boolean;
  isEnabled: boolean;
};

export function parseItemUsersInput(body: unknown) {
  const data = asObject(body);
  const users = Array.isArray(data.users) ? data.users : [];
  const seen = new Set<string>();
  const parsed: ParsedItemUserInput[] = [];

  for (const raw of users) {
    const item = asObject(raw);
    const userId = toPositiveInt(item.userId);
    const roleType = isRoleType(item.roleType) ? item.roleType : null;
    const mobile =
      typeof item.mobile === "string" && item.mobile.trim()
        ? item.mobile.trim()
        : null;
    const isPrimary = Boolean(item.isPrimary);
    const isEnabled = item.isEnabled === undefined ? true : Boolean(item.isEnabled);

    if (!userId || !roleType) {
      return { error: "事项人员配置不完整" } as const;
    }

    const uniqueKey = `${userId}:${roleType}`;
    if (seen.has(uniqueKey)) {
      return { error: "同一事项下同一用户和角色不能重复配置" } as const;
    }

    seen.add(uniqueKey);
    parsed.push({
      userId,
      roleType,
      mobile,
      isPrimary,
      isEnabled,
    });
  }

  return { data: parsed } as const;
}
