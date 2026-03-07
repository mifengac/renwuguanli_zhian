"use client";

import { useEffect, useState } from "react";
import { MONITOR_CYCLE_TYPE_LABELS } from "@/lib/monitor/constants";
import { MonitorItemRow } from "@/lib/monitor/ui-types";

type ItemFormModalProps = {
  open: boolean;
  planId: number;
  item: MonitorItemRow | null;
  onClose: () => void;
  onSuccess: () => void;
};

function getCycleDraft(item: MonitorItemRow | null) {
  const cycleConf = item?.cycleConf || {};
  return {
    fixedDueDate:
      typeof cycleConf.fixedDueDate === "string" ? cycleConf.fixedDueDate : "",
    weekday:
      typeof cycleConf.weekday === "number" ? String(cycleConf.weekday) : "1",
    dayOfMonth:
      typeof cycleConf.dayOfMonth === "number" ? String(cycleConf.dayOfMonth) : "1",
    quarterMonth:
      typeof cycleConf.quarterMonth === "number"
        ? String(cycleConf.quarterMonth)
        : "3",
    customJson:
      item?.cycleType === "CUSTOM"
        ? JSON.stringify(cycleConf || { dueDates: [] }, null, 2)
        : JSON.stringify({ dueDates: [] }, null, 2),
  };
}

export default function ItemFormModal({
  open,
  planId,
  item,
  onClose,
  onSuccess,
}: ItemFormModalProps) {
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [cycleType, setCycleType] = useState<MonitorItemRow["cycleType"]>("MONTHLY");
  const [dueTime, setDueTime] = useState("17:00");
  const [needAttachment, setNeedAttachment] = useState(false);
  const [needRemark, setNeedRemark] = useState(false);
  const [sortNo, setSortNo] = useState("10");
  const [isEnabled, setIsEnabled] = useState(true);
  const [remark, setRemark] = useState("");
  const [cycleDraft, setCycleDraft] = useState(getCycleDraft(null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setItemCode(item?.itemCode ?? "");
    setItemName(item?.itemName ?? "");
    setItemCategory(item?.itemCategory ?? "");
    setCycleType(item?.cycleType ?? "MONTHLY");
    setDueTime(item?.dueTime ? item.dueTime.slice(0, 5) : "17:00");
    setNeedAttachment(Boolean(item?.needAttachment));
    setNeedRemark(Boolean(item?.needRemark));
    setSortNo(item ? String(item.sortNo) : "10");
    setIsEnabled(item ? item.isEnabled : true);
    setRemark(item?.remark ?? "");
    setCycleDraft(getCycleDraft(item));
    setError(null);
  }, [item, open]);

  if (!open) return null;

  function buildCycleConf() {
    if (cycleType === "ONCE") {
      return {
        fixedDueDate: cycleDraft.fixedDueDate,
      };
    }

    if (cycleType === "WEEKLY") {
      return {
        weekday: Number(cycleDraft.weekday),
      };
    }

    if (cycleType === "MONTHLY") {
      return {
        dayOfMonth: Number(cycleDraft.dayOfMonth),
      };
    }

    if (cycleType === "QUARTERLY") {
      return {
        quarterMonth: Number(cycleDraft.quarterMonth),
        dayOfMonth: Number(cycleDraft.dayOfMonth),
      };
    }

    return JSON.parse(cycleDraft.customJson);
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        itemCode,
        itemName,
        itemCategory,
        cycleType,
        cycleConf: buildCycleConf(),
        dueTime: `${dueTime}:00`,
        needAttachment,
        needRemark,
        sortNo: Number(sortNo || 0),
        isEnabled,
        remark,
      };

      const res = await fetch(
        item ? `/api/monitor/items/${item.id}` : `/api/monitor/plans/${planId}/items`,
        {
          method: item ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "保存事项失败");
        return;
      }

      onSuccess();
    } catch (err) {
      if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError("网络错误，保存事项失败");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {item ? "编辑事项" : "新增事项"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              事项负责定义周期、截止时间、附件/备注要求。
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
            <span>事项编码</span>
            <input
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>事项名称</span>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>事项分类</span>
            <input
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>周期类型</span>
            <select
              value={cycleType}
              onChange={(e) => setCycleType(e.target.value as MonitorItemRow["cycleType"])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {Object.entries(MONITOR_CYCLE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {cycleType === "ONCE" && (
            <label className="space-y-1 text-xs text-slate-600">
              <span>固定截止日期</span>
              <input
                type="date"
                value={cycleDraft.fixedDueDate}
                onChange={(e) =>
                  setCycleDraft((draft) => ({ ...draft, fixedDueDate: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          {cycleType === "WEEKLY" && (
            <label className="space-y-1 text-xs text-slate-600">
              <span>每周截止日</span>
              <select
                value={cycleDraft.weekday}
                onChange={(e) =>
                  setCycleDraft((draft) => ({ ...draft, weekday: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {[
                  ["1", "周一"],
                  ["2", "周二"],
                  ["3", "周三"],
                  ["4", "周四"],
                  ["5", "周五"],
                  ["6", "周六"],
                  ["7", "周日"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {cycleType === "MONTHLY" && (
            <label className="space-y-1 text-xs text-slate-600">
              <span>每月截止日</span>
              <input
                type="number"
                min="1"
                max="31"
                value={cycleDraft.dayOfMonth}
                onChange={(e) =>
                  setCycleDraft((draft) => ({ ...draft, dayOfMonth: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          {cycleType === "QUARTERLY" && (
            <>
              <label className="space-y-1 text-xs text-slate-600">
                <span>季度内月份</span>
                <select
                  value={cycleDraft.quarterMonth}
                  onChange={(e) =>
                    setCycleDraft((draft) => ({ ...draft, quarterMonth: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="1">第 1 月</option>
                  <option value="2">第 2 月</option>
                  <option value="3">第 3 月</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>截止日</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={cycleDraft.dayOfMonth}
                  onChange={(e) =>
                    setCycleDraft((draft) => ({ ...draft, dayOfMonth: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
          {cycleType === "CUSTOM" && (
            <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
              <span>自定义 JSON 周期配置</span>
              <textarea
                rows={6}
                value={cycleDraft.customJson}
                onChange={(e) =>
                  setCycleDraft((draft) => ({ ...draft, customJson: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
          )}
          <label className="space-y-1 text-xs text-slate-600">
            <span>截止时间</span>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>排序号</span>
            <input
              type="number"
              value={sortNo}
              onChange={(e) => setSortNo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={needAttachment}
              onChange={(e) => setNeedAttachment(e.target.checked)}
            />
            完成时必须上传附件
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={needRemark}
              onChange={(e) => setNeedRemark(e.target.checked)}
            />
            完成时必须填写备注
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            启用该事项
          </label>
          <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
            <span>备注</span>
            <textarea
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
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
            {saving ? "保存中..." : "保存事项"}
          </button>
        </div>
      </div>
    </div>
  );
}
