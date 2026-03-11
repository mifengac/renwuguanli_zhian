"use client";

import { useEffect, useState } from "react";
import {
  MONITOR_NOTIFY_CHANNEL_LABELS,
  MONITOR_NOTIFY_SEND_STATUS_LABELS,
} from "@/lib/monitor/constants";
import { MonitorNotifyLogRow } from "@/lib/monitor/ui-types";

type NotifyLogModalProps = {
  open: boolean;
  instanceId: number | null;
  onClose: () => void;
};

export default function NotifyLogModal({
  open,
  instanceId,
  onClose,
}: NotifyLogModalProps) {
  const [logs, setLogs] = useState<MonitorNotifyLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !instanceId) return;

    setLoading(true);
    setError(null);
    fetch(`/api/monitor/instances/${instanceId}/logs`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "加载提醒日志失败");
        }
        setLogs(data.logs || []);
      })
      .catch((err: Error) => {
        setError(err.message || "加载提醒日志失败");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [instanceId, open]);

  if (!open || !instanceId) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">提醒日志</h3>
            <p className="mt-1 text-xs text-slate-500">查看该实例的提醒发送记录</p>
          </div>
          <button
            type="button"
            className="text-sm text-slate-400 hover:text-slate-700"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-5">
          {loading && <div className="py-12 text-center text-sm text-slate-500">正在加载提醒日志...</div>}
          {error && <div className="py-12 text-center text-sm text-red-600">{error}</div>}
          {!loading && !error && logs.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">暂无提醒日志。</div>
          )}
          {!loading && !error && logs.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">接收人</th>
                    <th className="px-4 py-3 font-semibold">渠道</th>
                    <th className="px-4 py-3 font-semibold">状态</th>
                    <th className="px-4 py-3 font-semibold">规则</th>
                    <th className="px-4 py-3 font-semibold">发送时间</th>
                    <th className="px-4 py-3 font-semibold">失败原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => (
                    <tr key={log.id}>
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
                      <td className="px-4 py-4 align-top text-slate-600">
                        {log.rule?.ruleName || "-"}
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        {log.sendTime || "-"}
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
        </div>
      </div>
    </div>
  );
}
