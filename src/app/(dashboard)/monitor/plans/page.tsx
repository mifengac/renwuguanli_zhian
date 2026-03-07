"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MonitorNav from "@/components/monitor/MonitorNav";
import { MONITOR_PLAN_STATUS_LABELS } from "@/lib/monitor/constants";

type CurrentUser = {
  id: number;
  name: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  departmentId: number | null;
};

type DepartmentOption = {
  id: number;
  name: string;
};

type TaskOption = {
  id: number;
  title: string;
};

type PlanRow = {
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
  _count?: {
    items: number;
    instances: number;
  };
};

type NoticeRow = {
  id: number;
  content: string;
  sendStatus: string;
  createdAt: string;
  instance: {
    periodLabel: string;
    plan: {
      planName: string;
    };
    item: {
      itemName: string;
    };
  };
};

type PlanFormModalProps = {
  open: boolean;
  departments: DepartmentOption[];
  tasks: TaskOption[];
  initialPlan: PlanRow | null;
  onClose: () => void;
  onSuccess: () => void;
};

function formatDateOnly(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function PlanFormModal({
  open,
  departments,
  tasks,
  initialPlan,
  onClose,
  onSuccess,
}: PlanFormModalProps) {
  const [planCode, setPlanCode] = useState("");
  const [planName, setPlanName] = useState("");
  const [planType, setPlanType] = useState("");
  const [sourceTaskId, setSourceTaskId] = useState<string>("");
  const [ownerDeptId, setOwnerDeptId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPlanCode(initialPlan?.planCode ?? "");
    setPlanName(initialPlan?.planName ?? "");
    setPlanType(initialPlan?.planType ?? "");
    setSourceTaskId(initialPlan?.sourceTaskId ? String(initialPlan.sourceTaskId) : "");
    setOwnerDeptId(initialPlan ? String(initialPlan.ownerDeptId) : "");
    setStartDate(initialPlan ? initialPlan.startDate.slice(0, 10) : "");
    setEndDate(initialPlan?.endDate ? initialPlan.endDate.slice(0, 10) : "");
    setRemark(initialPlan?.remark ?? "");
    setError(null);
  }, [initialPlan, open]);

  if (!open) return null;

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        planCode,
        planName,
        planType,
        sourceTaskId: sourceTaskId ? Number(sourceTaskId) : null,
        ownerDeptId: ownerDeptId ? Number(ownerDeptId) : null,
        startDate,
        endDate: endDate || null,
        remark,
      };

      const res = await fetch(
        initialPlan ? `/api/monitor/plans/${initialPlan.id}` : "/api/monitor/plans",
        {
          method: initialPlan ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "保存专项工作失败");
        return;
      }

      onSuccess();
    } catch {
      setError("网络错误，保存专项工作失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {initialPlan ? "编辑专项工作" : "新建专项工作"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              监测计划启用后才会参与实例生成和提醒扫描。
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-slate-400 hover:text-slate-700"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-600">
            <span>专项编码</span>
            <input
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例如 ZX-2026-001"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>专项名称</span>
            <input
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例如 预防未成年人违法犯罪工作"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>专项类型</span>
            <input
              value={planType}
              onChange={(e) => setPlanType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例如 报送类 / 督办类"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>牵头部门</span>
            <select
              value={ownerDeptId}
              onChange={(e) => setOwnerDeptId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">请选择部门</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>关联任务</span>
            <select
              value={sourceTaskId}
              onChange={(e) => setSourceTaskId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">不关联</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>开始日期</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>结束日期</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
            <span>备注</span>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="补充说明专项范围、要求或来源"
            />
          </label>
          {error && (
            <p className="md:col-span-2 text-sm text-red-600">{error}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MonitorPlansPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [ownerDeptId, setOwnerDeptId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState<string | null>(null);

  const canManage =
    currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  async function loadOptions() {
    const res = await fetch("/api/monitor/options");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "加载监测模块基础数据失败");
    }

    const data = await res.json();
    setCurrentUser(data.currentUser);
    setDepartments(data.departments || []);
    setTasks(data.tasks || []);
  }

  async function loadPlans() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (status) params.set("status", status);
      if (ownerDeptId) params.set("ownerDeptId", ownerDeptId);

      const res = await fetch(`/api/monitor/plans?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "加载专项工作失败");
        setPlans([]);
        setTotalPages(0);
        return;
      }

      setPlans(data.plans || []);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch {
      setError("网络错误，加载专项工作失败");
      setPlans([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyNotices(userId: number) {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "5");
    params.set("receiverUserId", String(userId));
    params.set("channel", "SYSTEM");
    const res = await fetch(`/api/monitor/logs?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    setNotices(data.logs || []);
  }

  useEffect(() => {
    loadOptions().catch((err: Error) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadPlans();
  }, [keyword, status, ownerDeptId, page, pageSize]);

  useEffect(() => {
    if (!currentUser) return;
    loadMyNotices(currentUser.id).catch(() => undefined);
  }, [currentUser]);

  async function handleChangeStatus(plan: PlanRow, nextStatus: string) {
    if (!window.confirm(`确认将专项工作变更为“${MONITOR_PLAN_STATUS_LABELS[nextStatus as keyof typeof MONITOR_PLAN_STATUS_LABELS] || nextStatus}”吗？`)) {
      return;
    }

    const res = await fetch(`/api/monitor/plans/${plan.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "状态变更失败");
      return;
    }

    await loadPlans();
  }

  async function handleRunJob(action: "generate" | "scan" | "retry") {
    setJobLoading(action);
    setJobMessage(null);
    try {
      const res = await fetch(`/api/monitor/jobs/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJobMessage(data.message || "任务执行失败");
        return;
      }

      const result = data.result || {};
      if (action === "generate") {
        setJobMessage(`实例生成完成：新增 ${result.createdCount || 0} 条，跳过 ${result.skippedCount || 0} 条。`);
      } else if (action === "scan") {
        setJobMessage(
          `提醒扫描完成：成功 ${result.sentCount || 0} 条，失败 ${result.failedCount || 0} 条，逾期更新 ${result.markedOverdueCount || 0} 条。`
        );
      } else {
        setJobMessage(
          `失败补偿完成：重试 ${result.retriedCount || 0} 条，成功 ${result.successCount || 0} 条，失败 ${result.failedCount || 0} 条。`
        );
      }

      await loadPlans();
    } catch {
      setJobMessage("网络错误，任务执行失败");
    } finally {
      setJobLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <MonitorNav />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">专项工作</h2>
            <p className="mt-1 text-sm text-slate-500">
              管理专项监测计划、牵头部门、关联任务以及运行状态。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => handleRunJob("generate")}
                  disabled={jobLoading === "generate"}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {jobLoading === "generate" ? "生成中..." : "手动生成实例"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRunJob("scan")}
                  disabled={jobLoading === "scan"}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {jobLoading === "scan" ? "扫描中..." : "手动扫描提醒"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRunJob("retry")}
                  disabled={jobLoading === "retry"}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {jobLoading === "retry" ? "补偿中..." : "补偿失败短信"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlan(null);
                    setShowPlanModal(true);
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  新建专项工作
                </button>
              </>
            )}
          </div>
        </div>
        {jobMessage && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {jobMessage}
          </p>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <input
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="按编码或名称搜索"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">全部状态</option>
                {Object.entries(MONITOR_PLAN_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={ownerDeptId}
                onChange={(e) => {
                  setOwnerDeptId(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">全部部门</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    每页 {size} 条
                  </option>
                ))}
              </select>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading && (
              <div className="px-6 py-16 text-center text-sm text-slate-500">
                正在加载专项工作...
              </div>
            )}
            {error && (
              <div className="px-6 py-16 text-center text-sm text-red-600">
                {error}
              </div>
            )}
            {!loading && !error && plans.length === 0 && (
              <div className="px-6 py-16 text-center text-sm text-slate-500">
                暂无匹配的专项工作。
              </div>
            )}
            {!loading && !error && plans.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">专项信息</th>
                      <th className="px-4 py-3 font-semibold">牵头部门</th>
                      <th className="px-4 py-3 font-semibold">周期范围</th>
                      <th className="px-4 py-3 font-semibold">事项 / 实例</th>
                      <th className="px-4 py-3 font-semibold">状态</th>
                      <th className="px-4 py-3 font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {plans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 align-top">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => router.push(`/monitor/plans/${plan.id}`)}
                          >
                            <div className="font-medium text-blue-700 hover:underline">
                              {plan.planName}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              编码：{plan.planCode}
                            </div>
                            {plan.planType && (
                              <div className="mt-1 text-xs text-slate-500">
                                类型：{plan.planType}
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-600">
                          {plan.ownerDeptName}
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-600">
                          <div>开始：{formatDateOnly(plan.startDate)}</div>
                          <div className="mt-1">
                            结束：{formatDateOnly(plan.endDate)}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-600">
                          <div>事项：{plan._count?.items ?? 0}</div>
                          <div className="mt-1">实例：{plan._count?.instances ?? 0}</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              plan.status === "ENABLED"
                                ? "bg-emerald-50 text-emerald-700"
                                : plan.status === "PAUSED"
                                ? "bg-amber-50 text-amber-700"
                                : plan.status === "FINISHED"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-sky-50 text-sky-700"
                            }`}
                          >
                            {MONITOR_PLAN_STATUS_LABELS[plan.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => router.push(`/monitor/plans/${plan.id}`)}
                              className="text-xs text-blue-700 hover:underline"
                            >
                              进入详情
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPlan(plan);
                                  setShowPlanModal(true);
                                }}
                                className="text-xs text-slate-600 hover:underline"
                              >
                                编辑
                              </button>
                            )}
                            {canManage && plan.status === "DRAFT" && (
                              <button
                                type="button"
                                onClick={() => handleChangeStatus(plan, "ENABLED")}
                                className="text-xs text-emerald-700 hover:underline"
                              >
                                启用
                              </button>
                            )}
                            {canManage && plan.status === "ENABLED" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleChangeStatus(plan, "PAUSED")}
                                  className="text-xs text-amber-700 hover:underline"
                                >
                                  暂停
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleChangeStatus(plan, "FINISHED")}
                                  className="text-xs text-red-700 hover:underline"
                                >
                                  结束
                                </button>
                              </>
                            )}
                            {canManage && plan.status === "PAUSED" && (
                              <button
                                type="button"
                                onClick={() => handleChangeStatus(plan, "ENABLED")}
                                className="text-xs text-emerald-700 hover:underline"
                              >
                                恢复
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && !error && plans.length > 0 && (
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

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">我的系统提醒</h3>
            <p className="mt-1 text-xs text-slate-500">
              最近 5 条发送到当前账号的系统内提醒。
            </p>
            <div className="mt-4 space-y-3">
              {notices.length === 0 && (
                <p className="text-sm text-slate-500">暂无系统提醒。</p>
              )}
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="text-xs text-slate-500">
                    {notice.instance.plan.planName} / {notice.instance.item.itemName}
                  </div>
                  <p className="mt-1 text-sm text-slate-800 line-clamp-3">
                    {notice.content}
                  </p>
                  <div className="mt-2 text-[11px] text-slate-400">
                    {notice.instance.periodLabel} · {notice.createdAt.replace("T", " ").slice(0, 16)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <PlanFormModal
        open={showPlanModal}
        departments={departments}
        tasks={tasks}
        initialPlan={editingPlan}
        onClose={() => setShowPlanModal(false)}
        onSuccess={() => {
          setShowPlanModal(false);
          loadPlans();
        }}
      />
    </div>
  );
}
