"use client";

import { useEffect, useState } from "react";
import { MONITOR_ITEM_USER_ROLE_LABELS } from "@/lib/monitor/constants";
import { MonitorItemRow, MonitorUserOption } from "@/lib/monitor/ui-types";

type ItemUserModalProps = {
  open: boolean;
  item: MonitorItemRow | null;
  userOptions: MonitorUserOption[];
  onClose: () => void;
  onSuccess: () => void;
};

export default function ItemUserModal({
  open,
  item,
  userOptions,
  onClose,
  onSuccess,
}: ItemUserModalProps) {
  const [rows, setRows] = useState<
    Array<{
      userId: string;
      roleType: "OWNER" | "REMIND" | "CC";
      mobile: string;
      isPrimary: boolean;
      isEnabled: boolean;
    }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    setRows(
      item.itemUsers.map((entry) => ({
        userId: String(entry.userId),
        roleType: entry.roleType,
        mobile: entry.mobile ?? "",
        isPrimary: entry.isPrimary,
        isEnabled: entry.isEnabled,
      }))
    );
    setError(null);
  }, [item, open]);

  if (!open || !item) return null;
  const currentItem = item;

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/monitor/items/${currentItem.id}/users`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: rows.map((row) => ({
            userId: Number(row.userId),
            roleType: row.roleType,
            mobile: row.mobile || null,
            isPrimary: row.isPrimary,
            isEnabled: row.isEnabled,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "保存事项人员失败");
        return;
      }

      onSuccess();
    } catch {
      setError("网络错误，保存事项人员失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">配置责任人 / 提醒对象</h3>
            <p className="mt-1 text-xs text-slate-500">{currentItem.itemName}</p>
          </div>
          <button
            type="button"
            className="text-sm text-slate-400 hover:text-slate-700"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">用户</th>
                  <th className="px-3 py-2">角色</th>
                  <th className="px-3 py-2">手机号</th>
                  <th className="px-3 py-2">主负责人</th>
                  <th className="px-3 py-2">启用</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, index) => (
                  <tr key={`${row.userId}-${index}`}>
                    <td className="px-3 py-2">
                      <select
                        value={row.userId}
                        onChange={(e) =>
                          setRows((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, userId: e.target.value }
                                : entry
                            )
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">请选择用户</option>
                        {userOptions.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}（{user.badgeNo} / {user.departmentName || "未分配部门"}）
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.roleType}
                        onChange={(e) =>
                          setRows((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    roleType: e.target.value as "OWNER" | "REMIND" | "CC",
                                  }
                                : entry
                            )
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {Object.entries(MONITOR_ITEM_USER_ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.mobile}
                        onChange={(e) =>
                          setRows((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, mobile: e.target.value }
                                : entry
                            )
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="短信提醒可选"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.isPrimary}
                        onChange={(e) =>
                          setRows((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, isPrimary: e.target.checked }
                                : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.isEnabled}
                        onChange={(e) =>
                          setRows((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, isEnabled: e.target.checked }
                                : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() =>
                          setRows((current) => current.filter((_, entryIndex) => entryIndex !== index))
                        }
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                      暂未配置人员。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() =>
              setRows((current) => [
                ...current,
                {
                  userId: "",
                  roleType: "OWNER",
                  mobile: "",
                  isPrimary: false,
                  isEnabled: true,
                },
              ])
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            新增一行
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存人员"}
          </button>
        </div>
      </div>
    </div>
  );
}
