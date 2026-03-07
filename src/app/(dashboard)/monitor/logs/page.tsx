"use client";

import { useEffect, useMemo, useState } from "react";
import MonitorNav from "@/components/monitor/MonitorNav";
import {
  MONITOR_NOTIFY_CHANNEL_LABELS,
  MONITOR_NOTIFY_SEND_STATUS_LABELS,
} from "@/lib/monitor/constants";

type PlanOption = {
  id: number;
  planName: string;
};

type ItemOption = {
  id: number;
  planId: number;
  itemName: string;
};

type LogRow = {
  id: number;
  receiverName: string;
  receiverMobile: string | null;
  channel: keyof typeof MONITOR_NOTIFY_CHANNEL_LABELS;
  sendStatus: keyof typeof MONITOR_NOTIFY_SEND_STATUS_LABELS;
  sendTime: string | null;
  failReason: string | null;
  content: string;
  createdAt: string;
  rule: {
    id: number;
    ruleName: string;
  } | null;
  instance: {
    id: number;
    periodLabel: string;
    plan: {
      id: number;
      planName: string;
    };
    item: {
      id: number;
      itemName: string;
    };
  };
};

export default function MonitorLogsPage() {
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [planId, setPlanId] = useState("");
  const [itemId, setItemId] = useState("");
  const [channel, setChannel] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  const visibleItems = useMemo(() => {
    if (!planId) return itemOptions;
    return itemOptions.filter((item) => String(item.planId) === planId);
  }, [itemOptions, planId]);

  async function loadOptions() {
    const res = await fetch("/api/monitor/options");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "加载基础配置失败");
    }

    setPlanOptions((data.plans || []).map((plan: any) => ({ id: plan.id, planName: plan.planName })));
    setItemOptions((data.items || []).map((item: any) => ({ id: item.id, planId: item.planId, itemName: item.itemName })));
  }

  async function loadLogs() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (planId) params.set("planId", planId);
      if (itemId) params.set("itemId", itemId);
      if (channel) params.set("channel", channel);
      if (sendStatus) params.set("sendStatus", sendStatus);

      const res = await fetch(`/api/monitor/logs?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "加载提醒日志失败");
        setLogs([]);
        setTotalPages(0);
        return;
      }

      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch {
      setError("网络错误，加载提醒日志失败");
      setLogs([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOptions().catch((err: Error) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadLogs();
  }, [keyword, planId, itemId, channel, sendStatus, page, pageSize]);

  return (
    <div className="space-y-4">
      <MonitorNav />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">提醒日志</h2>
        <p className="mt-1 text-sm text-slate-500">
          查看系统内提醒和短信提醒的发送状态、失败原因及接收对象。
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="按专项、事项、接收人搜索"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              setItemId("");
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全部专项</option>
            {planOptions.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.planName}
              </option>
            ))}
          </select>
          <select
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全部事项</option>
            {visibleItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemName}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全部渠道</option>
            {Object.entries(MONITOR_NOTIFY_CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={sendStatus}
            onChange={(e) => {
              setSendStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全部状态</option>
            {Object.entries(MONITOR_NOTIFY_SEND_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                每页 {size} 条
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading && <div className="px-6 py-16 text-center text-sm text-slate-500">正在加载提醒日志...</div>}
        {error && <div className="px-6 py-16 text-center text-sm text-red-600">{error}</div>}
        {!loading && !error && logs.length === 0 && (
          <div className="px-6 py-16 text-center text-sm text-slate-500">暂无提醒日志数据。</div>
        )}
        {!loading && !error && logs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">专项 / 事项</th>
                  <th className="px-4 py-3 font-semibold">规则</th>
                  <th className="px-4 py-3 font-semibold">接收人</th>
                  <th className="px-4 py-3 font-semibold">渠道</th>
                  <th className="px-4 py-3 font-semibold">状态</th>
                  <th className="px-4 py-3 font-semibold">发送时间</th>
                  <th className="px-4 py-3 font-semibold">失败原因</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 align-top">
                      <div className="font-medium text-slate-900">
                        {log.instance.plan.planName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {log.instance.item.itemName} / {log.instance.periodLabel}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">
                      {log.rule?.ruleName || "-"}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-medium text-slate-900">{log.receiverName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {log.receiverMobile || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">
                      {MONITOR_NOTIFY_CHANNEL_LABELS[log.channel]}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          log.sendStatus === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700"
                            : log.sendStatus === "FAILED"
                            ? "bg-red-50 text-red-700"
                            : log.sendStatus === "SKIPPED"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {MONITOR_NOTIFY_SEND_STATUS_LABELS[log.sendStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-xs text-slate-600">
                      {log.sendTime ? log.sendTime.replace("T", " ").slice(0, 16) : "-"}
                    </td>
                    <td className="px-4 py-4 align-top text-xs text-slate-600">
                      {log.failReason || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && logs.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span>
              第 {page} / {Math.max(totalPages, 1)} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(Math.max(totalPages, 1), current + 1))}
                className="rounded border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
