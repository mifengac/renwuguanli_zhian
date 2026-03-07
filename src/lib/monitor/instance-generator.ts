import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MonitorOperator, createMonitorOperateLog } from "@/lib/monitor/audit";
import { MonitorCycleTypeValue } from "@/lib/monitor/constants";
import {
  addDays,
  buildInstanceCode,
  buildPeriodKey,
  buildPeriodLabel,
  combineDateAndTime,
  endOfDay,
  formatDateOnly,
  getMonthLastDay,
  getQuarter,
  getQuarterStart,
  getStartOfWeek,
  normalizeTimeString,
  parseJsonObject,
  parsePositiveInteger,
  startOfDay,
} from "@/lib/monitor/utils";

type MonitorPlanWithItems = Prisma.MonitorPlanGetPayload<{
  include: {
    items: {
      where: { isEnabled: true };
      orderBy: [{ sortNo: "asc" }, { id: "asc" }];
    };
  };
}>;

type CandidateInstance = {
  planId: number;
  itemId: number;
  instanceCode: string;
  periodKey: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date;
  detailJson: Prisma.InputJsonValue;
};

type GenerateInstancesOptions = {
  now?: Date;
  planId?: number;
  actor: MonitorOperator;
};

function getLookAheadDays(): number {
  return parsePositiveInteger(
    process.env.MONITOR_INSTANCE_LOOKAHEAD_DAYS,
    60
  );
}

function getBackfillDays(): number {
  return parsePositiveInteger(
    process.env.MONITOR_INSTANCE_BACKFILL_DAYS,
    7
  );
}

function isDueInPlanWindow(plan: MonitorPlanWithItems, dueAt: Date): boolean {
  const startDate = startOfDay(new Date(plan.startDate));
  const dueDate = startOfDay(dueAt);
  if (dueDate < startDate) return false;

  if (plan.endDate) {
    const endDate = startOfDay(new Date(plan.endDate));
    if (dueDate > endDate) return false;
  }

  return true;
}

function isInGenerationWindow(
  dueAt: Date,
  windowStart: Date,
  windowEnd: Date
): boolean {
  return dueAt >= windowStart && dueAt <= windowEnd;
}

function getCycleConfig(item: MonitorPlanWithItems["items"][number]) {
  return parseJsonObject(item.cycleConf);
}

function createCandidate(
  plan: MonitorPlanWithItems,
  item: MonitorPlanWithItems["items"][number],
  type: MonitorCycleTypeValue,
  dueDate: Date,
  periodStart: Date,
  periodEnd: Date,
  extraDetail: Record<string, unknown> = {}
): CandidateInstance | null {
  const dueAt = combineDateAndTime(dueDate, normalizeTimeString(item.dueTime));
  if (!isDueInPlanWindow(plan, dueAt)) return null;

  const periodKey = buildPeriodKey(type, dueDate);
  const periodLabel = buildPeriodLabel(type, dueDate);

  return {
    planId: plan.id,
    itemId: item.id,
    instanceCode: buildInstanceCode(plan.planCode, item.itemCode, periodKey),
    periodKey,
    periodLabel,
    periodStart: startOfDay(periodStart),
    periodEnd: startOfDay(periodEnd),
    dueAt,
    detailJson: {
      cycleType: type,
      dueDate: formatDateOnly(dueDate),
      ...extraDetail,
    },
  };
}

function buildOnceCandidates(
  plan: MonitorPlanWithItems,
  item: MonitorPlanWithItems["items"][number],
  windowStart: Date,
  windowEnd: Date
): CandidateInstance[] {
  const conf = getCycleConfig(item);
  const fixedDueDate =
    conf && typeof conf.fixedDueDate === "string" ? conf.fixedDueDate : null;
  const dueDate = fixedDueDate ? new Date(fixedDueDate) : null;

  if (!dueDate || Number.isNaN(dueDate.getTime())) return [];

  const candidate = createCandidate(
    plan,
    item,
    "ONCE",
    dueDate,
    dueDate,
    dueDate,
    {
      fixedDueDate,
    }
  );

  if (!candidate || !isInGenerationWindow(candidate.dueAt, windowStart, windowEnd)) {
    return [];
  }

  return [candidate];
}

function buildWeeklyCandidates(
  plan: MonitorPlanWithItems,
  item: MonitorPlanWithItems["items"][number],
  windowStart: Date,
  windowEnd: Date
): CandidateInstance[] {
  const conf = getCycleConfig(item);
  const weekday = Number(conf?.weekday);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return [];

  const candidates: CandidateInstance[] = [];
  let weekStart = getStartOfWeek(windowStart);

  while (weekStart <= windowEnd) {
    const dueDate = addDays(weekStart, weekday - 1);
    const candidate = createCandidate(
      plan,
      item,
      "WEEKLY",
      dueDate,
      weekStart,
      addDays(weekStart, 6),
      {
        weekday,
      }
    );

    if (candidate && isInGenerationWindow(candidate.dueAt, windowStart, windowEnd)) {
      candidates.push(candidate);
    }

    weekStart = addDays(weekStart, 7);
  }

  return candidates;
}

function buildMonthlyCandidates(
  plan: MonitorPlanWithItems,
  item: MonitorPlanWithItems["items"][number],
  windowStart: Date,
  windowEnd: Date
): CandidateInstance[] {
  const conf = getCycleConfig(item);
  const dayOfMonth = Number(conf?.dayOfMonth);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return [];

  const candidates: CandidateInstance[] = [];
  let cursor = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
  const limit = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1);

  while (cursor <= limit) {
    const lastDay = getMonthLastDay(cursor.getFullYear(), cursor.getMonth());
    const dueDate = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      Math.min(dayOfMonth, lastDay)
    );

    const candidate = createCandidate(
      plan,
      item,
      "MONTHLY",
      dueDate,
      new Date(cursor.getFullYear(), cursor.getMonth(), 1),
      new Date(cursor.getFullYear(), cursor.getMonth(), lastDay),
      {
        dayOfMonth,
      }
    );

    if (candidate && isInGenerationWindow(candidate.dueAt, windowStart, windowEnd)) {
      candidates.push(candidate);
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return candidates;
}

function buildQuarterlyCandidates(
  plan: MonitorPlanWithItems,
  item: MonitorPlanWithItems["items"][number],
  windowStart: Date,
  windowEnd: Date
): CandidateInstance[] {
  const conf = getCycleConfig(item);
  const dayOfMonth = Number(conf?.dayOfMonth);
  const quarterMonth = Number(conf?.quarterMonth ?? 3);

  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    return [];
  }

  if (!Number.isInteger(quarterMonth) || quarterMonth < 1 || quarterMonth > 3) {
    return [];
  }

  const candidates: CandidateInstance[] = [];
  let year = windowStart.getFullYear();
  let quarter = getQuarter(windowStart);
  const limitMarker = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1);

  while (getQuarterStart(year, quarter) <= limitMarker) {
    const periodStart = getQuarterStart(year, quarter);
    const dueMonthIndex = periodStart.getMonth() + (quarterMonth - 1);
    const lastDay = getMonthLastDay(periodStart.getFullYear(), dueMonthIndex);
    const dueDate = new Date(
      periodStart.getFullYear(),
      dueMonthIndex,
      Math.min(dayOfMonth, lastDay)
    );
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 0);

    const candidate = createCandidate(
      plan,
      item,
      "QUARTERLY",
      dueDate,
      periodStart,
      periodEnd,
      {
        quarterMonth,
        dayOfMonth,
      }
    );

    if (candidate && isInGenerationWindow(candidate.dueAt, windowStart, windowEnd)) {
      candidates.push(candidate);
    }

    quarter += 1;
    if (quarter > 4) {
      quarter = 1;
      year += 1;
    }
  }

  return candidates;
}

function buildCustomCandidates(
  plan: MonitorPlanWithItems,
  item: MonitorPlanWithItems["items"][number],
  windowStart: Date,
  windowEnd: Date
): CandidateInstance[] {
  const conf = getCycleConfig(item);
  if (!conf) return [];

  const periods = Array.isArray(conf.periods) ? conf.periods : [];
  const dueDates = Array.isArray(conf.dueDates) ? conf.dueDates : [];
  const candidates: CandidateInstance[] = [];

  for (const period of periods) {
    const data =
      period && typeof period === "object" && !Array.isArray(period)
        ? (period as Record<string, unknown>)
        : null;
    const dueDateRaw = typeof data?.dueDate === "string" ? data.dueDate : null;
    const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) continue;

    const candidate = createCandidate(
      plan,
      item,
      "CUSTOM",
      dueDate,
      dueDate,
      dueDate,
      {
        customPeriodKey:
          typeof data?.periodKey === "string" ? data.periodKey : formatDateOnly(dueDate),
        customPeriodLabel:
          typeof data?.periodLabel === "string" ? data.periodLabel : formatDateOnly(dueDate),
      }
    );

    if (candidate && isInGenerationWindow(candidate.dueAt, windowStart, windowEnd)) {
      candidate.periodKey =
        typeof data?.periodKey === "string" && data.periodKey.trim()
          ? data.periodKey.trim()
          : candidate.periodKey;
      candidate.periodLabel =
        typeof data?.periodLabel === "string" && data.periodLabel.trim()
          ? data.periodLabel.trim()
          : candidate.periodLabel;
      candidate.instanceCode = buildInstanceCode(
        plan.planCode,
        item.itemCode,
        candidate.periodKey
      );
      candidates.push(candidate);
    }
  }

  for (const raw of dueDates) {
    if (typeof raw !== "string") continue;
    const dueDate = new Date(raw);
    if (Number.isNaN(dueDate.getTime())) continue;

    const candidate = createCandidate(
      plan,
      item,
      "CUSTOM",
      dueDate,
      dueDate,
      dueDate
    );

    if (candidate && isInGenerationWindow(candidate.dueAt, windowStart, windowEnd)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function buildCandidatesForItem(
  plan: MonitorPlanWithItems,
  item: MonitorPlanWithItems["items"][number],
  windowStart: Date,
  windowEnd: Date
): CandidateInstance[] {
  switch (item.cycleType as MonitorCycleTypeValue) {
    case "ONCE":
      return buildOnceCandidates(plan, item, windowStart, windowEnd);
    case "WEEKLY":
      return buildWeeklyCandidates(plan, item, windowStart, windowEnd);
    case "MONTHLY":
      return buildMonthlyCandidates(plan, item, windowStart, windowEnd);
    case "QUARTERLY":
      return buildQuarterlyCandidates(plan, item, windowStart, windowEnd);
    case "CUSTOM":
      return buildCustomCandidates(plan, item, windowStart, windowEnd);
    default:
      return [];
  }
}

export async function generateMonitorInstances(
  options: GenerateInstancesOptions
): Promise<{
  createdCount: number;
  skippedCount: number;
  createdInstances: Array<{ itemId: number; periodKey: string; dueAt: string }>;
}> {
  const now = options.now ?? new Date();
  const lookAheadDays = getLookAheadDays();
  const backfillDays = getBackfillDays();
  const windowStart = startOfDay(addDays(now, -backfillDays));
  const windowEnd = endOfDay(addDays(now, lookAheadDays));

  const plans = await prisma.monitorPlan.findMany({
    where: {
      deletedFlag: false,
      status: "ENABLED",
      ...(options.planId ? { id: options.planId } : {}),
    },
    include: {
      items: {
        where: { isEnabled: true, status: "ACTIVE" },
        orderBy: [{ sortNo: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ id: "asc" }],
  });

  const candidates = plans.flatMap((plan) =>
    plan.items.flatMap((item) => buildCandidatesForItem(plan, item, windowStart, windowEnd))
  );

  if (candidates.length === 0) {
    return {
      createdCount: 0,
      skippedCount: 0,
      createdInstances: [],
    };
  }

  const existing = await prisma.monitorInstance.findMany({
    where: {
      itemId: {
        in: [...new Set(candidates.map((candidate) => candidate.itemId))],
      },
    },
    select: {
      itemId: true,
      periodKey: true,
    },
  });

  const existingKeys = new Set(
    existing.map((item) => `${item.itemId}:${item.periodKey}`)
  );

  const createdInstances: Array<{ itemId: number; periodKey: string; dueAt: string }> = [];
  let skippedCount = 0;

  for (const candidate of candidates) {
    const key = `${candidate.itemId}:${candidate.periodKey}`;
    if (existingKeys.has(key)) {
      skippedCount += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.monitorInstance.create({
        data: {
          planId: candidate.planId,
          itemId: candidate.itemId,
          instanceCode: candidate.instanceCode,
          periodKey: candidate.periodKey,
          periodLabel: candidate.periodLabel,
          periodStart: candidate.periodStart,
          periodEnd: candidate.periodEnd,
          dueAt: candidate.dueAt,
          status: "PENDING",
        },
      });

      await createMonitorOperateLog(tx, {
        planId: candidate.planId,
        itemId: candidate.itemId,
        instanceId: created.id,
        actionType: "GENERATE_INSTANCE",
        operator: options.actor,
        detailJson: candidate.detailJson,
      });

      createdInstances.push({
        itemId: created.itemId,
        periodKey: created.periodKey,
        dueAt: created.dueAt.toISOString(),
      });
    });

    existingKeys.add(key);
  }

  return {
    createdCount: createdInstances.length,
    skippedCount,
    createdInstances,
  };
}
