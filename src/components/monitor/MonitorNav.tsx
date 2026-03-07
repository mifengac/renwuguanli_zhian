"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MONITOR_NAV_ITEMS = [
  { href: "/monitor/plans", label: "专项工作" },
  { href: "/monitor/instances", label: "实例管理" },
  { href: "/monitor/logs", label: "提醒日志" },
];

export default function MonitorNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      {MONITOR_NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
