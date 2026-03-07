"use client";

import { useEffect, useState } from "react";
import {
  MONITOR_REPEAT_TYPE_LABELS,
  MONITOR_TRIGGER_TYPE_LABELS,
} from "@/lib/monitor/constants";
import { MonitorItemRow, MonitorRuleRow } from "@/lib/monitor/ui-types";

type RuleModalProps = {
  open: boolean;
  item: MonitorItemRow | null;
  onClose: () => void;
  onSuccess: () => void;
};

const DEFAULT_TEMPLATE =
  "【专项监测提醒】{planName} - {itemName}（{periodLabel}）尚未完成，请于 {dueAt} 前处理。";

export default function RuleModal({
  open,
  item,
  onClose,
  onSuccess,
}: RuleModalProps) {
  const [editingRule, setEditingRule] = useState<MonitorRuleRow | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [triggerType, setTriggerType] = useState<MonitorRuleRow["triggerType"]>("BEFORE_DUE");
  const [offsetDays, setOffsetDays] = useState("0");
  const [offsetHours, setOffsetHours] = useState("0");
  const [repeatType, setRepeatType] = useState<MonitorRuleRow["repeatType"]>("DAILY");
  const [repeatInterval, setRepeatInterval] = useState("1");
  const [remindTime, setRemindTime] = useState("09:00");
  const [maxTimes, setMaxTimes] = useState("");
  const [channelSms, setChannelSms] = useState(false);
  const [channelSystem, setChannelSystem] = useState(true);
  const [stopWhenDone, setStopWhenDone] = useState(true);
  const [contentTpl, setContentTpl] = useState(DEFAULT_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open]);

  function resetForm() {
    setEditingRule(null);
    setRuleName("");
    setTriggerType("BEFORE_DUE");
    setOffsetDays("0");
    setOffsetHours("0");
    setRepeatType("DAILY");
    setRepeatInterval("1");
    setRemindTime("09:00");
    setMaxTimes("");
    setChannelSms(false);
    setChannelSystem(true);
    setStopWhenDone(true);
    setContentTpl(DEFAULT_TEMPLATE);
    setError(null);
  }

  function fillRule(rule: MonitorRuleRow) {
    setEditingRule(rule);
    setRuleName(rule.ruleName);
    setTriggerType(rule.triggerType);
    setOffsetDays(String(rule.offsetDays));
    setOffsetHours(String(rule.offsetHours));
    setRepeatType(rule.repeatType);
    setRepeatInterval(String(rule.repeatInterval ?? 1));
    setRemindTime(rule.remindTime ? rule.remindTime.slice(0, 5) : "09:00");
    setMaxTimes(rule.maxTimes ? String(rule.maxTimes) : "");
    setChannelSms(rule.channelSms);
    setChannelSystem(rule.channelSystem);
    setStopWhenDone(rule.stopWhenDone);
    setContentTpl(rule.contentTpl ?? DEFAULT_TEMPLATE);
    setError(null);
  }

  if (!open || !item) return null;
  const currentItem = item;

  async function handleToggle(rule: MonitorRuleRow, isEnabled: boolean) {
    const res = await fetch(`/api/monitor/rules/${rule.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isEnabled }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "更新规则状态失败");
      return;
    }

    onSuccess();
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ruleName,
        triggerType,
        offsetDays: Number(offsetDays || 0),
        offsetHours: Number(offsetHours || 0),
        repeatType,
        repeatInterval: repeatType === "EVERY_N_HOURS" ? Number(repeatInterval || 1) : null,
        remindTime: repeatType === "EVERY_N_HOURS" ? null : `${remindTime}:00`,
        maxTimes: maxTimes ? Number(maxTimes) : null,
        channelSms,
        channelSystem,
        stopWhenDone,
        contentTpl,
        isEnabled: editingRule?.isEnabled ?? true,
      };

      const res = await fetch(
        editingRule
          ? `/api/monitor/rules/${editingRule.id}`
          : `/api/monitor/items/${currentItem.id}/rules`,
        {
          method: editingRule ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "保存提醒规则失败");
        return;
      }

      onSuccess();
    } catch {
      setError("网络错误，保存提醒规则失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">提醒规则配置</h3>
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
        <div className="grid gap-5 p-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">已配置规则</h4>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-blue-700 hover:underline"
              >
                新增规则
              </button>
            </div>
            {currentItem.rules.length === 0 && (
              <p className="text-sm text-slate-500">暂无提醒规则。</p>
            )}
            {currentItem.rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {rule.ruleName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {MONITOR_TRIGGER_TYPE_LABELS[rule.triggerType]} /{" "}
                      {MONITOR_REPEAT_TYPE_LABELS[rule.repeatType]}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] ${
                      rule.isEnabled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {rule.isEnabled ? "启用中" : "已停用"}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => fillRule(rule)}
                    className="text-blue-700 hover:underline"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(rule, !rule.isEnabled)}
                    className="text-slate-600 hover:underline"
                  >
                    {rule.isEnabled ? "停用" : "启用"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <span>规则名称</span>
                <input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>触发类型</span>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as MonitorRuleRow["triggerType"])}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {Object.entries(MONITOR_TRIGGER_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>提前/逾期天数</span>
                <input
                  type="number"
                  min="0"
                  value={offsetDays}
                  onChange={(e) => setOffsetDays(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>偏移小时</span>
                <input
                  type="number"
                  min="0"
                  value={offsetHours}
                  onChange={(e) => setOffsetHours(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>重复方式</span>
                <select
                  value={repeatType}
                  onChange={(e) => setRepeatType(e.target.value as MonitorRuleRow["repeatType"])}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {Object.entries(MONITOR_REPEAT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {repeatType === "EVERY_N_HOURS" ? (
                <label className="space-y-1 text-xs text-slate-600">
                  <span>重复间隔</span>
                  <input
                    type="number"
                    min="1"
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : (
                <label className="space-y-1 text-xs text-slate-600">
                  <span>提醒时间</span>
                  <input
                    type="time"
                    value={remindTime}
                    onChange={(e) => setRemindTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              )}
              <label className="space-y-1 text-xs text-slate-600">
                <span>最大提醒次数</span>
                <input
                  type="number"
                  min="1"
                  value={maxTimes}
                  onChange={(e) => setMaxTimes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="留空不限"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={channelSystem}
                  onChange={(e) => setChannelSystem(e.target.checked)}
                />
                启用系统内提醒
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={channelSms}
                  onChange={(e) => setChannelSms(e.target.checked)}
                />
                启用短信提醒
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={stopWhenDone}
                  onChange={(e) => setStopWhenDone(e.target.checked)}
                />
                实例完成后停止提醒
              </label>
              <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                <span>提醒模板</span>
                <textarea
                  rows={5}
                  value={contentTpl}
                  onChange={(e) => setContentTpl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="block text-[11px] text-slate-400">
                  支持变量：{"{planName}"} {"{itemName}"} {"{periodLabel}"} {"{dueAt}"}
                </span>
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
              >
                关闭
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "保存中..." : editingRule ? "保存规则" : "新增规则"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
