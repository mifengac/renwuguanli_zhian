"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ItemFormModal from "@/components/monitor/ItemFormModal";
import ItemUserModal from "@/components/monitor/ItemUserModal";
import MonitorNav from "@/components/monitor/MonitorNav";
import RuleModal from "@/components/monitor/RuleModal";
import {
  MONITOR_CYCLE_TYPE_LABELS,
  MONITOR_ITEM_STATUS_LABELS,
  MONITOR_PLAN_STATUS_LABELS,
} from "@/lib/monitor/constants";
import {
  MonitorCurrentUser,
  MonitorItemRow,
  MonitorPlanDetail,
  MonitorUserOption,
} from "@/lib/monitor/ui-types";

function formatDateOnly(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function getOwnerUserIds(item: MonitorItemRow) {
  return item.itemUsers
    .filter((entry) => entry.roleType === "OWNER" && entry.isEnabled)
    .map((entry) => entry.userId);
}

export default function MonitorPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = Number(params?.id);
  const [plan, setPlan] = useState<MonitorPlanDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<MonitorCurrentUser | null>(null);
  const [userOptions, setUserOptions] = useState<MonitorUserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MonitorItemRow | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);

  const canManage = useMemo(() => {
    if (!currentUser || !plan) return false;
    if (currentUser.role === "SUPER_ADMIN") return true;
    return currentUser.role === "ADMIN" && currentUser.departmentId === plan.ownerDeptId;
  }, [currentUser, plan]);

  function canCompleteItem(item: MonitorItemRow) {
    if (!currentUser || !plan) return false;
    if (canManage) return true;
    return getOwnerUserIds(item).includes(currentUser.id);
  }

  async function loadDetail() {
    setLoading(true);
    setError(null);

    try {
      const [planRes, optionRes] = await Promise.all([
        fetch(`/api/monitor/plans/${planId}`),
        fetch("/api/monitor/options"),
      ]);

      const planData = await planRes.json().catch(() => ({}));
      const optionData = await optionRes.json().catch(() => ({}));

      if (!planRes.ok) {
        setError(planData.message || "加载专项详情失败");
        return;
      }

      if (!optionRes.ok) {
        setError(optionData.message || "加载人员选项失败");
        return;
      }

      setPlan(planData.plan);
      setCurrentUser(optionData.currentUser || null);
      setUserOptions(optionData.users || []);
    } catch {
      setError("网络错误，加载专项详情失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!planId) {
      setError("专项工作 ID 不合法");
      setLoading(false);
      return;
    }
    loadDetail();
  }, [planId]);

  async function handleDisableItem(itemId: number) {
    if (!window.confirm("确认停用该事项吗？停用后不会继续生成新实例。")) {
      return;
    }

    const res = await fetch(`/api/monitor/items/${itemId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "停用事项失败");
      return;
    }

    await loadDetail();
  }

  async function handleChangeItemStatus(
    item: MonitorItemRow,
    status: "ACTIVE" | "COMPLETED"
  ) {
    const confirmMessage =
      status === "COMPLETED"
        ? "确认将该事项标记为已完成吗？完成后将停止生成实例和短信提醒。"
        : "确认将该事项重新打开吗？重新打开后会恢复实例生成和提醒扫描。";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const res = await fetch(`/api/monitor/items/${item.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "更新事项状态失败");
      return;
    }

    await loadDetail();
  }

  async function runPlanJob(action: "generate" | "scan") {
    const res = await fetch(`/api/monitor/jobs/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setJobMessage(data.message || "执行计划任务失败");
      return;
    }

    const result = data.result || {};
    if (action === "generate") {
      setJobMessage(`实例生成完成：新增 ${result.createdCount || 0} 条，跳过 ${result.skippedCount || 0} 条。`);
    } else {
      setJobMessage(
        `提醒扫描完成：成功 ${result.sentCount || 0} 条，失败 ${result.failedCount || 0} 条，跳过 ${result.skippedCount || 0} 条。`
      );
    }

    await loadDetail();
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">正在加载专项详情...</div>;
  }

  if (error || !plan) {
    return (
      <div className="space-y-4">
        <MonitorNav />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          {error || "专项工作不存在"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MonitorNav />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div>
              <Link href="/monitor/plans" className="text-xs text-slate-500 hover:text-blue-700">
                返回专项工作列表
              </Link>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{plan.planName}</h2>
              <p className="mt-1 text-sm text-slate-500">
                编码：{plan.planCode} | 牵头部门：{plan.ownerDeptName}
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">状态</div>
                <div className="mt-1 font-medium text-slate-900">
                  {MONITOR_PLAN_STATUS_LABELS[plan.status]}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">计划周期</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatDateOnly(plan.startDate)} 至 {formatDateOnly(plan.endDate)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">事项 / 实例</div>
                <div className="mt-1 font-medium text-slate-900">
                  {plan._count?.items ?? 0} / {plan._count?.instances ?? 0}
                </div>
              </div>
            </div>
            {plan.remark && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                {plan.remark}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/monitor/instances?planId=${plan.id}`)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              查看实例
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => runPlanJob("generate")}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  生成实例
                </button>
                <button
                  type="button"
                  onClick={() => runPlanJob("scan")}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  扫描提醒
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setShowItemModal(true);
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  新增事项
                </button>
              </>
            )}
          </div>
        </div>
        {jobMessage && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {jobMessage}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">事项清单</h3>
          <p className="mt-1 text-xs text-slate-500">
            在此配置事项定义、责任人和提醒规则。事项标记为已完成后，将停止实例生成与提醒。
          </p>
        </div>
        {plan.items.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            当前专项尚未配置事项。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">事项</th>
                  <th className="px-4 py-3 font-semibold">周期</th>
                  <th className="px-4 py-3 font-semibold">责任 / 提醒对象</th>
                  <th className="px-4 py-3 font-semibold">规则数</th>
                  <th className="px-4 py-3 font-semibold">实例数</th>
                  <th className="px-4 py-3 font-semibold">状态</th>
                  <th className="px-4 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {plan.items.map((item) => {
                  const owners = item.itemUsers
                    .filter((entry) => entry.roleType === "OWNER" && entry.isEnabled)
                    .map((entry) => entry.userName)
                    .join("、");
                  const reminds = item.itemUsers
                    .filter((entry) => entry.roleType === "REMIND" && entry.isEnabled)
                    .map((entry) => entry.userName)
                    .join("、");
                  const canOperateItem = canCompleteItem(item);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-slate-900">{item.itemName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          编码：{item.itemCode}
                          {item.itemCategory ? ` | 分类：${item.itemCategory}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          截止：{item.dueTime.slice(0, 5)}
                          {item.needAttachment ? " | 必传附件" : ""}
                          {item.needRemark ? " | 必填备注" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        {MONITOR_CYCLE_TYPE_LABELS[item.cycleType]}
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        <div>责任人：{owners || "-"}</div>
                        <div className="mt-1">提醒对象：{reminds || "-"}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-600">{item.rules.length}</td>
                      <td className="px-4 py-4 align-top text-slate-600">
                        {item._count?.instances ?? 0}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${
                              item.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {MONITOR_ITEM_STATUS_LABELS[item.status]}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${
                              item.isEnabled
                                ? "bg-sky-50 text-sky-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {item.isEnabled ? "已启用" : "已停用"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setShowItemModal(true);
                                }}
                                className="text-blue-700 hover:underline"
                              >
                                编辑事项
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setShowUserModal(true);
                                }}
                                className="text-slate-600 hover:underline"
                              >
                                配置人员
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setShowRuleModal(true);
                                }}
                                className="text-slate-600 hover:underline"
                              >
                                配置规则
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => router.push(`/monitor/instances?planId=${plan.id}&itemId=${item.id}`)}
                            className="text-slate-600 hover:underline"
                          >
                            查看实例
                          </button>
                          {canOperateItem && item.status === "ACTIVE" && (
                            <button
                              type="button"
                              onClick={() => handleChangeItemStatus(item, "COMPLETED")}
                              className="text-emerald-700 hover:underline"
                            >
                              标记完成
                            </button>
                          )}
                          {canOperateItem && item.status === "COMPLETED" && (
                            <button
                              type="button"
                              onClick={() => handleChangeItemStatus(item, "ACTIVE")}
                              className="text-amber-700 hover:underline"
                            >
                              重新打开
                            </button>
                          )}
                          {canManage && item.isEnabled && (
                            <button
                              type="button"
                              onClick={() => handleDisableItem(item.id)}
                              className="text-red-600 hover:underline"
                            >
                              停用
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ItemFormModal
        open={showItemModal}
        planId={plan.id}
        item={editingItem}
        onClose={() => setShowItemModal(false)}
        onSuccess={() => {
          setShowItemModal(false);
          loadDetail();
        }}
      />
      <ItemUserModal
        open={showUserModal}
        item={editingItem}
        userOptions={userOptions}
        onClose={() => setShowUserModal(false)}
        onSuccess={() => {
          setShowUserModal(false);
          loadDetail();
        }}
      />
      <RuleModal
        open={showRuleModal}
        item={editingItem}
        onClose={() => setShowRuleModal(false)}
        onSuccess={() => {
          setShowRuleModal(false);
          loadDetail();
        }}
      />
    </div>
  );
}
