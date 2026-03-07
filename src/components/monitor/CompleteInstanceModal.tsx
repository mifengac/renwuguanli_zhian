"use client";

import { useEffect, useState } from "react";
import { MonitorInstanceRow } from "@/lib/monitor/ui-types";

type CompleteInstanceModalProps = {
  open: boolean;
  instance: MonitorInstanceRow | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function CompleteInstanceModal({
  open,
  instance,
  onClose,
  onSuccess,
}: CompleteInstanceModalProps) {
  const [remark, setRemark] = useState("");
  const [attachments, setAttachments] = useState<
    Array<{ fileName: string; objectKey: string; size: number; uploadedAt: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRemark(instance?.completeRemark ?? "");
    setAttachments(instance?.attachmentJson ?? []);
    setError(null);
  }, [instance, open]);

  if (!open || !instance) return null;
  const currentInstance = instance;

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      formData.append("folder", `monitor/instance-${currentInstance.id}`);

      const res = await fetch("/api/monitor/attachments", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "上传附件失败");
        return;
      }

      setAttachments((current) => [...current, ...(data.attachments || [])]);
    } catch {
      setError("网络错误，上传附件失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/monitor/instances/${currentInstance.id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          remark,
          attachments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "完成实例失败");
        return;
      }

      onSuccess();
    } catch {
      setError("网络错误，完成实例失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">完成实例</h3>
            <p className="mt-1 text-xs text-slate-500">
              {currentInstance.plan.planName} / {currentInstance.item.itemName} / {currentInstance.periodLabel}
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
        <div className="space-y-4 p-5">
          <label className="space-y-1 text-xs text-slate-600">
            <span>完成备注{currentInstance.item.needRemark ? "（必填）" : ""}</span>
            <textarea
              rows={4}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="填写本次完成情况、说明或附件内容摘要"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-600">
                完成附件{currentInstance.item.needAttachment ? "（必传）" : ""}
              </div>
              <label className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                {uploading ? "上传中..." : "上传附件"}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </label>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {attachments.length === 0 && (
                <p className="text-sm text-slate-500">暂无已上传附件。</p>
              )}
              {attachments.map((attachment, index) => (
                <div
                  key={`${attachment.objectKey}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"
                >
                  <a
                    href={`/api/monitor/attachments/download?key=${encodeURIComponent(
                      attachment.objectKey
                    )}&name=${encodeURIComponent(attachment.fileName)}`}
                    className="truncate text-blue-700 hover:underline"
                  >
                    {attachment.fileName}
                  </a>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index)
                      )
                    }
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          </div>

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
            {saving ? "提交中..." : "确认完成"}
          </button>
        </div>
      </div>
    </div>
  );
}
