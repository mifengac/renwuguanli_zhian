import {
  MONITOR_CYCLE_TYPE_LABELS,
  MONITOR_DEFAULT_TEMPLATE,
  MonitorCycleTypeValue,
} from "@/lib/monitor/constants";

export type MonitorAttachmentRef = {
  fileName: string;
  objectKey: string;
  size: number;
  uploadedAt: string;
};

export function normalizeTimeString(
  value: string | null | undefined,
  fallback = "17:00:00"
): string {
  const source = value?.trim();
  if (!source) return fallback;

  const matched = source.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!matched) return fallback;

  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  const second = Number(matched[3] ?? "00");

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return fallback;
  }

  return [hour, minute, second].map((item) => String(item).padStart(2, "0")).join(":");
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const matched = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return null;

  const year = Number(matched[1]);
  const monthIndex = Number(matched[2]) - 1;
  const day = Number(matched[3]);
  const date = new Date(year, monthIndex, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateOnly(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const next = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(next.getTime())) return "-";
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
    next.getDate()
  ).padStart(2, "0")}`;
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const next = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(next.getTime())) return "-";
  return `${formatDateOnly(next)} ${String(next.getHours()).padStart(2, "0")}:${String(
    next.getMinutes()
  ).padStart(2, "0")}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function combineDateAndTime(date: Date, time: string): Date {
  const [hour, minute, second] = normalizeTimeString(time).split(":").map(Number);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    minute,
    second,
    0
  );
}

export function isSameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isWorkday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function getWeekdayMondayFirst(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function getStartOfWeek(date: Date): Date {
  const weekday = getWeekdayMondayFirst(date);
  return startOfDay(addDays(date, 1 - weekday));
}

export function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const target = new Date(date);
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff =
    target.getTime() -
    new Date(firstThursday.getFullYear(), firstThursday.getMonth(), firstThursday.getDate()).getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return { year: target.getFullYear(), week };
}

export function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function getQuarterStart(year: number, quarter: number): Date {
  return new Date(year, (quarter - 1) * 3, 1, 0, 0, 0, 0);
}

export function getQuarterEnd(year: number, quarter: number): Date {
  return endOfDay(new Date(year, quarter * 3, 0, 0, 0, 0, 0));
}

export function getMonthLastDay(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function buildPeriodKey(type: MonitorCycleTypeValue, dueDate: Date): string {
  if (type === "ONCE") return "ONCE";
  if (type === "WEEKLY") {
    const { year, week } = getIsoWeekInfo(dueDate);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (type === "MONTHLY") {
    return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
  }
  if (type === "QUARTERLY") {
    return `${dueDate.getFullYear()}-Q${getQuarter(dueDate)}`;
  }

  return formatDateOnly(dueDate);
}

export function buildPeriodLabel(type: MonitorCycleTypeValue, dueDate: Date): string {
  if (type === "ONCE") return "一次性任务";
  if (type === "WEEKLY") {
    const { year, week } = getIsoWeekInfo(dueDate);
    return `${year} 年第 ${String(week).padStart(2, "0")} 周`;
  }
  if (type === "MONTHLY") {
    return `${dueDate.getFullYear()} 年 ${String(dueDate.getMonth() + 1).padStart(2, "0")} 月`;
  }
  if (type === "QUARTERLY") {
    return `${dueDate.getFullYear()} 年第 ${getQuarter(dueDate)} 季度`;
  }

  return `${MONITOR_CYCLE_TYPE_LABELS.CUSTOM} ${formatDateOnly(dueDate)}`;
}

export function renderMonitorTemplate(
  template: string | null | undefined,
  context: Record<string, string | number | null | undefined>
): string {
  const source = (template && template.trim()) || MONITOR_DEFAULT_TEMPLATE;
  return source.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

export function buildInstanceCode(
  planCode: string,
  itemCode: string,
  periodKey: string
): string {
  return `${planCode}-${itemCode}-${periodKey}`;
}

export function buildNotifyTitle(planName: string, itemName: string): string {
  return `专项监测提醒 | ${planName} | ${itemName}`;
}

export function parseJsonObject(
  value: unknown
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function uniqueNumbers(values: unknown[]): number[] {
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

export function normalizeAttachments(
  value: unknown
): MonitorAttachmentRef[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const data = parseJsonObject(item);
      if (!data) return null;

      const fileName =
        typeof data.fileName === "string" && data.fileName.trim()
          ? data.fileName.trim()
          : null;
      const objectKey =
        typeof data.objectKey === "string" && data.objectKey.trim()
          ? data.objectKey.trim()
          : null;
      const size = Number(data.size);
      const uploadedAt =
        typeof data.uploadedAt === "string" && data.uploadedAt.trim()
          ? data.uploadedAt.trim()
          : new Date().toISOString();

      if (!fileName || !objectKey || !Number.isFinite(size) || size < 0) {
        return null;
      }

      return {
        fileName,
        objectKey,
        size,
        uploadedAt,
      };
    })
    .filter((item): item is MonitorAttachmentRef => !!item);
}

export function parsePositiveInteger(
  value: string | null | undefined,
  fallback: number
): number {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}
