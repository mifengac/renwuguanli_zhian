const MONITOR_TIME_ZONE = "Asia/Shanghai";

type DateInput = Date | string | null | undefined;

const monitorDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MONITOR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toDate(value: DateInput): Date | null {
  if (!value) return null;

  const next = value instanceof Date ? value : new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function extractDateTimeParts(formatter: Intl.DateTimeFormat, date: Date) {
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: values.year ?? "0000",
    month: values.month ?? "01",
    day: values.day ?? "01",
    hour: values.hour ?? "00",
    minute: values.minute ?? "00",
  };
}

function formatLocalDateTime(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function toMonitorWallClock(value: DateInput): Date | null {
  const date = toDate(value);
  if (!date) return null;

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

export function formatMonitorWallClockDateTime(value: DateInput): string | null {
  const date = toMonitorWallClock(value);
  return date ? formatLocalDateTime(date) : null;
}

export function formatMonitorTimeZoneDateTime(value: DateInput): string | null {
  const date = toDate(value);
  if (!date) return null;

  const parts = extractDateTimeParts(monitorDateTimeFormatter, date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
