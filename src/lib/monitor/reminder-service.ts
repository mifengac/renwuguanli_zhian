import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MonitorOperator, createMonitorOperateLog } from "@/lib/monitor/audit";
import { sendSmsByOracleQueue } from "@/lib/monitor/oracle-sms";
import {
  MonitorNotifyChannelValue,
  MonitorRepeatTypeValue,
  MonitorTriggerTypeValue,
} from "@/lib/monitor/constants";
import {
  addHours,
  buildNotifyTitle,
  combineDateAndTime,
  endOfDay,
  formatDateOnly,
  formatDateTime,
  isSameLocalDate,
  isWorkday,
  normalizeTimeString,
  renderMonitorTemplate,
  startOfDay,
} from "@/lib/monitor/utils";

type ActiveInstance = Prisma.MonitorInstanceGetPayload<{
  include: {
    plan: true;
    item: {
      include: {
        itemUsers: true;
        rules: true;
      };
    };
  };
}>;

type ReminderEvaluation = {
  triggerKey: string;
  scheduledAt: Date;
};

// monitor_instance.due_at is stored as a timezone-less wall-clock timestamp.
// Prisma materializes it as a Date, which can shift the local day/time when the
// runtime timezone differs from the writer timezone. Rebuild the local wall-clock
// time from the UTC parts before any reminder comparisons.
function toMonitorWallClock(date: Date): Date {
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  );
}

function sanitizeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildRuleAnchor(
  dueAt: Date,
  triggerType: MonitorTriggerTypeValue,
  offsetDays: number,
  offsetHours: number
): Date {
  const offsetMs = (offsetDays * 24 + offsetHours) * 60 * 60 * 1000;

  if (triggerType === "BEFORE_DUE") {
    return new Date(dueAt.getTime() - offsetMs);
  }

  if (triggerType === "AFTER_DUE") {
    return new Date(dueAt.getTime() + offsetMs);
  }

  return new Date(dueAt);
}

function buildDateTriggerKey(prefix: string, date: Date) {
  return `${prefix}:${formatDateOnly(date).replace(/-/g, "")}`;
}

function evaluateRuleTrigger(
  instance: Pick<ActiveInstance, "dueAt">,
  rule: Pick<
    ActiveInstance["item"]["rules"][number],
    | "triggerType"
    | "offsetDays"
    | "offsetHours"
    | "repeatType"
    | "repeatInterval"
    | "remindTime"
  >,
  now: Date
): ReminderEvaluation | null {
  const dueAt = toMonitorWallClock(new Date(instance.dueAt));
  const anchor = buildRuleAnchor(
    dueAt,
    rule.triggerType as MonitorTriggerTypeValue,
    rule.offsetDays,
    rule.offsetHours
  );
  const remindTime = normalizeTimeString(rule.remindTime, "09:00:00");

  if (rule.repeatType === "EVERY_N_HOURS") {
    const intervalHours =
      Number.isInteger(rule.repeatInterval) && Number(rule.repeatInterval) > 0
        ? Number(rule.repeatInterval)
        : 1;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    if (rule.triggerType === "BEFORE_DUE") {
      if (now < anchor || now >= dueAt) return null;
      const diff = now.getTime() - anchor.getTime();
      const slot = Math.floor(diff / intervalMs);
      const scheduledAt = addHours(anchor, slot * intervalHours);
      if (scheduledAt >= dueAt) return null;
      return {
        triggerKey: `H:${intervalHours}:${slot}`,
        scheduledAt,
      };
    }

    if (rule.triggerType === "ON_DUE") {
      const dayStart = startOfDay(dueAt);
      const dayEnd = endOfDay(dueAt);
      const firstAt = combineDateAndTime(dayStart, remindTime);
      if (now < firstAt || now > dayEnd || !isSameLocalDate(now, dueAt)) return null;
      const diff = now.getTime() - firstAt.getTime();
      const slot = Math.floor(diff / intervalMs);
      const scheduledAt = addHours(firstAt, slot * intervalHours);
      if (scheduledAt > dayEnd) return null;
      return {
        triggerKey: `HD:${intervalHours}:${slot}`,
        scheduledAt,
      };
    }

    if (now < anchor) return null;
    const diff = now.getTime() - anchor.getTime();
    const slot = Math.floor(diff / intervalMs);
    return {
      triggerKey: `HA:${intervalHours}:${slot}`,
      scheduledAt: addHours(anchor, slot * intervalHours),
    };
  }

  if (rule.repeatType === "ONCE") {
    let scheduledAt = rule.remindTime
      ? combineDateAndTime(anchor, remindTime)
      : new Date(anchor);

    if (rule.triggerType === "ON_DUE") {
      scheduledAt = rule.remindTime
        ? combineDateAndTime(dueAt, remindTime)
        : new Date(dueAt);
      if (!isSameLocalDate(now, dueAt)) return null;
    }

    if (rule.triggerType === "BEFORE_DUE") {
      if (scheduledAt < anchor && isSameLocalDate(scheduledAt, anchor)) {
        scheduledAt = new Date(anchor);
      }
      if (scheduledAt >= dueAt || now < scheduledAt || now >= dueAt) return null;
    }

    if (rule.triggerType === "AFTER_DUE" && now < scheduledAt) return null;
    if (rule.triggerType === "ON_DUE" && now < scheduledAt) return null;

    return {
      triggerKey: `O:${sanitizeKey(scheduledAt.toISOString())}`,
      scheduledAt,
    };
  }

  if (rule.repeatType === "WORKDAY_DAILY" && !isWorkday(now)) {
    return null;
  }

  let scheduledAt = combineDateAndTime(now, remindTime);

  if (rule.triggerType === "BEFORE_DUE") {
    if (now < anchor || now >= dueAt) return null;
    if (isSameLocalDate(now, anchor) && scheduledAt < anchor) {
      scheduledAt = new Date(anchor);
    }
    if (scheduledAt >= dueAt || now < scheduledAt) return null;
    return {
      triggerKey: buildDateTriggerKey("D", now),
      scheduledAt,
    };
  }

  if (rule.triggerType === "ON_DUE") {
    if (!isSameLocalDate(now, dueAt) || now < scheduledAt) return null;
    return {
      triggerKey: buildDateTriggerKey("DD", now),
      scheduledAt,
    };
  }

  if (now < anchor) return null;
  if (isSameLocalDate(now, anchor) && scheduledAt < anchor) {
    scheduledAt = new Date(anchor);
  }
  if (now < scheduledAt) return null;

  return {
    triggerKey: buildDateTriggerKey("DA", now),
    scheduledAt,
  };
}

function buildBizDedupeKey(params: {
  instanceId: number;
  ruleId: number;
  triggerKey: string;
  channel: MonitorNotifyChannelValue;
  receiverKey: string;
}) {
  return `MI-${params.instanceId}-R-${params.ruleId}-T-${sanitizeKey(
    params.triggerKey
  )}-C-${params.channel}-U-${sanitizeKey(params.receiverKey)}`;
}

function buildOracleSmsEid(logId: number) {
  return `MNL-${logId}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function createNotifyLogSafely(data: Prisma.MonitorNotifyLogCreateInput) {
  try {
    return await prisma.monitorNotifyLog.create({ data });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }
    throw error;
  }
}

async function sendChannelMessage(params: {
  logId: number;
  channel: MonitorNotifyChannelValue;
  content: string;
  mobile?: string | null;
  oracleEid?: string | null;
}) {
  if (params.channel === "SYSTEM") {
    await prisma.monitorNotifyLog.update({
      where: { id: params.logId },
      data: {
        sendStatus: "SUCCESS",
        sendTime: new Date(),
      },
    });

    return {
      sendStatus: "SUCCESS" as const,
      failReason: null,
    };
  }

  const oracleEid = params.oracleEid?.trim() || buildOracleSmsEid(params.logId);
  const result = await sendSmsByOracleQueue({
    oracleEid,
    mobile: params.mobile || "",
    content: params.content,
    pushTime: new Date(),
  });

  await prisma.monitorNotifyLog.update({
    where: { id: params.logId },
    data: {
      sendStatus: result.status,
      sendTime: new Date(),
      failReason: result.failReason ?? null,
      oracleEid,
      oraclePushTime: result.oraclePushTime ?? null,
      retryCount: result.status === "FAILED" ? 1 : 0,
    },
  });

  return {
    sendStatus: result.status,
    failReason: result.failReason ?? null,
  };
}

export async function refreshOverdueMonitorInstances(options?: {
  now?: Date;
  actor?: MonitorOperator;
  planId?: number;
}) {
  const now = options?.now ?? new Date();
  const actor = options?.actor;

  const pendingInstances = await prisma.monitorInstance.findMany({
    where: {
      status: "PENDING",
      ...(options?.planId ? { planId: options.planId } : {}),
    },
    select: {
      id: true,
      planId: true,
      itemId: true,
      dueAt: true,
    },
  });

  const overdueInstances = pendingInstances.filter(
    (instance) => toMonitorWallClock(new Date(instance.dueAt)).getTime() < now.getTime()
  );

  for (const instance of overdueInstances) {
    await prisma.$transaction(async (tx) => {
      await tx.monitorInstance.update({
        where: { id: instance.id },
        data: { status: "OVERDUE" },
      });

      if (actor) {
        await createMonitorOperateLog(tx, {
          planId: instance.planId,
          itemId: instance.itemId,
          instanceId: instance.id,
          actionType: "MARK_OVERDUE",
          operator: actor,
          detailJson: {
            reason: "due_at_passed",
          },
        });
      }
    });
  }

  return overdueInstances.length;
}

export async function scanMonitorReminders(options: {
  now?: Date;
  actor: MonitorOperator;
  planId?: number;
}) {
  const now = options.now ?? new Date();
  const markedOverdueCount = await refreshOverdueMonitorInstances({
    now,
    actor: options.actor,
    planId: options.planId,
  });

  const instances = await prisma.monitorInstance.findMany({
    where: {
      status: {
        in: ["PENDING", "OVERDUE", "COMPLETED"],
      },
      ...(options.planId ? { planId: options.planId } : {}),
      plan: {
        deletedFlag: false,
        status: "ENABLED",
      },
      item: {
        isEnabled: true,
        status: "ACTIVE",
      },
    },
    include: {
      plan: true,
      item: {
        include: {
          itemUsers: {
            where: { isEnabled: true },
            orderBy: [{ roleType: "asc" }, { id: "asc" }],
          },
          rules: {
            where: { isEnabled: true },
            orderBy: [{ id: "asc" }],
          },
        },
      },
    },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
  });

  const existingLogs = await prisma.monitorNotifyLog.findMany({
    where: {
      instanceId: { in: instances.map((instance) => instance.id) },
    },
    select: {
      instanceId: true,
      ruleId: true,
      triggerKey: true,
    },
  });

  const triggerHistory = new Map<string, Set<string>>();
  for (const log of existingLogs) {
    const key = `${log.instanceId}:${log.ruleId}`;
    const history = triggerHistory.get(key) ?? new Set<string>();
    history.add(log.triggerKey);
    triggerHistory.set(key, history);
  }

  let scannedRules = 0;
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let createdLogCount = 0;

  for (const instance of instances) {
    for (const rule of instance.item.rules) {
      scannedRules += 1;
      if (instance.status === "COMPLETED" && rule.stopWhenDone) {
        skippedCount += 1;
        continue;
      }
      const evaluation = evaluateRuleTrigger(instance, rule, now);
      if (!evaluation) continue;

      const historyKey = `${instance.id}:${rule.id}`;
      const history = triggerHistory.get(historyKey) ?? new Set<string>();

      if (history.has(evaluation.triggerKey)) {
        skippedCount += 1;
        continue;
      }

      if (rule.maxTimes != null && history.size >= rule.maxTimes) {
        skippedCount += 1;
        continue;
      }

      if (instance.item.itemUsers.length === 0) {
        skippedCount += 1;
        continue;
      }

      const content = renderMonitorTemplate(rule.contentTpl, {
        planName: instance.plan.planName,
        itemName: instance.item.itemName,
        periodLabel: instance.periodLabel,
        dueAt: formatDateTime(toMonitorWallClock(new Date(instance.dueAt))),
      });
      const title = buildNotifyTitle(instance.plan.planName, instance.item.itemName);

      let slotCreatedLogs = 0;
      let slotSuccess = 0;
      let slotFailed = 0;
      let slotSkipped = 0;

      for (const receiver of instance.item.itemUsers) {
        const channels: MonitorNotifyChannelValue[] = [];
        if (rule.channelSystem) channels.push("SYSTEM");
        if (rule.channelSms) channels.push("SMS");

        for (const channel of channels) {
          const receiverKey =
            channel === "SMS" ? receiver.mobile || String(receiver.userId) : String(receiver.userId);
          const bizDedupeKey = buildBizDedupeKey({
            instanceId: instance.id,
            ruleId: rule.id,
            triggerKey: evaluation.triggerKey,
            channel,
            receiverKey,
          });

          const createdLog = await createNotifyLogSafely({
            instance: {
              connect: { id: instance.id },
            },
            rule: {
              connect: { id: rule.id },
            },
            triggerKey: evaluation.triggerKey,
            receiverUserId: receiver.userId,
            receiverName: receiver.userName,
            receiverMobile: receiver.mobile || null,
            channel,
            title,
            content,
            bizDedupeKey,
            sendStatus: "READY",
            oracleEid: null,
          });

          if (!createdLog) {
            slotSkipped += 1;
            continue;
          }

          slotCreatedLogs += 1;
          createdLogCount += 1;

          const result = await sendChannelMessage({
            logId: createdLog.id,
            channel,
            content,
            mobile: receiver.mobile,
          });

          if (result.sendStatus === "SUCCESS") {
            slotSuccess += 1;
            sentCount += 1;
          } else if (result.sendStatus === "FAILED") {
            slotFailed += 1;
            failedCount += 1;
          } else {
            slotSkipped += 1;
            skippedCount += 1;
          }
        }
      }

      if (slotCreatedLogs > 0) {
        await prisma.$transaction(async (tx) => {
          await tx.monitorInstance.update({
            where: { id: instance.id },
            data: {
              remindCount: {
                increment: 1,
              },
              firstRemindAt: instance.firstRemindAt ?? now,
              lastRemindAt: now,
            },
          });

          await createMonitorOperateLog(tx, {
            planId: instance.planId,
            itemId: instance.itemId,
            instanceId: instance.id,
            actionType: "SEND_REMIND",
            operator: options.actor,
            detailJson: {
              ruleId: rule.id,
              triggerKey: evaluation.triggerKey,
              scheduledAt: evaluation.scheduledAt.toISOString(),
              createdLogs: slotCreatedLogs,
              successCount: slotSuccess,
              failedCount: slotFailed,
              skippedCount: slotSkipped,
            },
          });
        });

        history.add(evaluation.triggerKey);
        triggerHistory.set(historyKey, history);
      }
    }
  }

  return {
    markedOverdueCount,
    scannedRules,
    createdLogCount,
    sentCount,
    failedCount,
    skippedCount,
  };
}

export async function retryFailedMonitorNotifications(options: {
  actor: MonitorOperator;
  limit?: number;
}) {
  const retryLimit =
    Number.isInteger(Number(process.env.MONITOR_NOTIFY_RETRY_LIMIT)) &&
    Number(process.env.MONITOR_NOTIFY_RETRY_LIMIT) > 0
      ? Number(process.env.MONITOR_NOTIFY_RETRY_LIMIT)
      : 5;

  const notifyLogs = await prisma.monitorNotifyLog.findMany({
    where: {
      channel: "SMS",
      sendStatus: "FAILED",
      retryCount: {
        lt: retryLimit,
      },
    },
    take: options.limit ?? 100,
    include: {
      instance: {
        include: {
          plan: true,
          item: true,
        },
      },
      rule: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });

  let retriedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const log of notifyLogs) {
    retriedCount += 1;
    const oracleEid = log.oracleEid || buildOracleSmsEid(log.id);

    const result = await sendSmsByOracleQueue({
      oracleEid,
      mobile: log.receiverMobile || "",
      content: log.content,
      pushTime: new Date(),
    });

    await prisma.monitorNotifyLog.update({
      where: { id: log.id },
      data: {
        sendStatus: result.status,
        sendTime: new Date(),
        failReason: result.failReason ?? null,
        oracleEid,
        oraclePushTime: result.oraclePushTime ?? null,
        retryCount: {
          increment: 1,
        },
      },
    });

    if (result.status === "SUCCESS") {
      successCount += 1;
    } else if (result.status === "FAILED") {
      failedCount += 1;
    } else {
      skippedCount += 1;
    }

    await createMonitorOperateLog(prisma, {
      planId: log.instance.planId,
      itemId: log.instance.itemId,
      instanceId: log.instanceId,
      actionType: "COMPENSATE_NOTIFY",
      operator: options.actor,
      detailJson: {
        notifyLogId: log.id,
        retryCount: log.retryCount + 1,
        sendStatus: result.status,
        failReason: result.failReason ?? null,
      },
    });
  }

  return {
    retriedCount,
    successCount,
    failedCount,
    skippedCount,
  };
}
