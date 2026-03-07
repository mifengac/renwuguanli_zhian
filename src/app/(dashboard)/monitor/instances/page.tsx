"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import MonitorNav from "@/components/monitor/MonitorNav";
import CompleteInstanceModal from "@/components/monitor/CompleteInstanceModal";
import NotifyLogModal from "@/components/monitor/NotifyLogModal";
import { MONITOR_INSTANCE_STATUS_LABELS } from "@/lib/monitor/constants";
import {
  MonitorCurrentUser,
  MonitorInstanceRow,
} from "@/lib/monitor/ui-types";

type PlanOption = {
  id: number;
  planName: string;
};

type ItemOption = {
  id: number;
  planId: number;
  itemName: string;
};

function getStatusClass(status: MonitorInstanceRow["status"]) {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700";
  if (status === "OVERDUE") return "bg-red-50 text-red-700";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-600";
  return "bg-sky-50 text-sky-700";
}

function MonitorInstancesPageContent() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<MonitorCurrentUser | null>(null);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([]);
  const [instances, setInstances] = useState<MonitorInstanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [planId, setPlanId] = useState(searchParams.get("planId") || "");
  const [itemId, setItemId] = useState(searchParams.get("itemId") || "");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [activeInstance, setActiveInstance] = useState<MonitorInstanceRow | null>(null);
  const [logInstanceId, setLogInstanceId] = useState<number | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    if (!planId) return itemOptions;
    return itemOptions.filter((item) => String(item.planId) === planId);
  }, [itemOptions, planId]);

  const canManageJobs =
    currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  function canOperateInstance(instance: MonitorInstanceRow) {
    if (!currentUser) return false;
    if (currentUser.role === "SUPER_ADMIN") return true;
    if (currentUser.role === "ADMIN" && currentUser.departmentId === instance.plan.ownerDeptId) {
      return true;
    }
    return instance.item.itemUsers.some(
      (entry) => entry.roleType === "OWNER" && entry.isEnabled && entry.userId === currentUser.id
    );
  }

  async function loadOptions() {
    const res = await fetch("/api/monitor/options");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "加载监测模块基础数据失败");
    }

    setCurrentUser(data.currentUser || null);
    setPlanOptions((data.plans || []).map((plan: any) => ({ id: plan.id, planName: plan.planName })));
    setItemOptions((data.items || []).map((item: any) => ({ id: item.id, planId: item.planId, itemName: item.itemName })));
  }

  async function loadInstances() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (planId) params.set("planId", planId);
      if (itemId) params.set("itemId", itemId);
      if (status) params.set("status", status);

      const res = await fetch(`/api/monitor/instances?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "加载实例列表失败");
        setInstances([]);
        setTotalPages(0);
        return;
      }

      setInstances(data.instances || []);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch {
      setError("网络错误，加载实例列表失败");
      setInstances([]);
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
    loadInstances();
  }, [keyword, planId, itemId, status, page, pageSize]);

  async function handleReopen(instance: MonitorInstanceRow) {
    if (!window.confirm("确认将该实例重新打开为待完成状态吗？")) return;

    const res = await fetch(`/api/monitor/instances/${instance.id}/reopen`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "手动重开实例" }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "重开实例失败");
      return;
    }

    await loadInstances();
  }

  async function handleRunJob(action: "scan" | "retry") {
    const res = await fetch(`/api/monitor/jobs/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setJobMessage(data.message || "执行任务失败");
      return;
    }

    const result = data.result || {};
    if (action === "scan") {
      setJobMessage(
        `提醒扫描完成：成功 ${result.sentCount || 0} 条，失败 ${result.failedCount || 0} 条，逾期更新 ${result.markedOverdueCount || 0} 条。`
      );
    } else {
      setJobMessage(
        `失败补偿完成：重试 ${result.retriedCount || 0} 条，成功 ${result.successCount || 0} 条。`
      );
    }

    await loadInstances();
  }

  return (
    <div className="space-y-4">
      <MonitorNav />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">实例管理</h2>
            <p className="mt-1 text-sm text-slate-500">
              查看每一期事项实例的完成状态、提醒次数和日志记录。
            </p>
          </div>
          {canManageJobs && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRunJob("scan")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                手动扫描提醒
              </button>
              <button
                type="button"
                onClick={() => handleRunJob("retry")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                补偿失败短信
              </button>
            </div>
          )}
        </div>
        {jobMessage && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {jobMessage}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="按专项、事项、周期搜索"
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
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全部状态</option>
            {Object.entries(MONITOR_INSTANCE_STATUS_LABELS).map(([value, label]) => (
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
        {loading && <div className="px-6 py-16 text-center text-sm text-slate-500">正在加载实例列表...</div>}
        {error && <div className="px-6 py-16 text-center text-sm text-red-600">{error}</div>}
        {!loading && !error && instances.length === 0 && (
          <div className="px-6 py-16 text-center text-sm text-slate-500">暂无实例数据。</div>
        )}
        {!loading && !error && instances.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">专项 / 事项</th>
                  <th className="px-4 py-3 font-semibold">周期</th>
                  <th className="px-4 py-3 font-semibold">截止时间</th>
                  <th className="px-4 py-3 font-semibold">状态</th>
                  <th className="px-4 py-3 font-semibold">提醒次数</th>
                  <th className="px-4 py-3 font-semibold">完成时间</th>
                  <th className="px-4 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {instances.map((instance) => {
                  const canOperate = canOperateInstance(instance);
                  const ownerNames = instance.item.itemUsers
                    .filter((entry) => entry.roleType === "OWNER" && entry.isEnabled)
                    .map((entry) => entry.userName)
                    .join("、");

                  return (
                    <tr key={instance.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-slate-900">
                          {instance.plan.planName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {instance.item.itemName}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          责任人：{ownerNames || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        <div>{instance.periodLabel}</div>
                        <div className="mt-1 text-slate-400">{instance.periodKey}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        {instance.dueAt.replace("T", " ").slice(0, 16)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`rounded-full px-2.5 py-1 text-xs ${getStatusClass(instance.status)}`}>
                          {MONITOR_INSTANCE_STATUS_LABELS[instance.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        <div>{instance.remindCount} 次</div>
                        <div className="mt-1 text-slate-400">
                          {instance.lastRemindAt
                            ? instance.lastRemindAt.replace("T", " ").slice(0, 16)
                            : "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        {instance.completedAt
                          ? instance.completedAt.replace("T", " ").slice(0, 16)
                          : "-"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {(instance.status === "PENDING" || instance.status === "OVERDUE") &&
                            canOperate && (
                              <button
                                type="button"
                                onClick={() => setActiveInstance(instance)}
                                className="text-blue-700 hover:underline"
                              >
                                完成
                              </button>
                            )}
                          {instance.status === "COMPLETED" && canOperate && (
                            <button
                              type="button"
                              onClick={() => handleReopen(instance)}
                              className="text-amber-700 hover:underline"
                            >
                              重开
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setLogInstanceId(instance.id)}
                            className="text-slate-600 hover:underline"
                          >
                            提醒记录
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && instances.length > 0 && (
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

      <CompleteInstanceModal
        open={!!activeInstance}
        instance={activeInstance}
        onClose={() => setActiveInstance(null)}
        onSuccess={() => {
          setActiveInstance(null);
          loadInstances();
        }}
      />
      <NotifyLogModal
        open={!!logInstanceId}
        instanceId={logInstanceId}
        onClose={() => setLogInstanceId(null)}
      />
    </div>
  );
}

export default function MonitorInstancesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <MonitorNav />
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
            正在加载实例页面...
          </section>
        </div>
      }
    >
      <MonitorInstancesPageContent />
    </Suspense>
  );
}
