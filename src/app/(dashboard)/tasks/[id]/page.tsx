"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Attachment = {
  id: number;
  filename: string;
};

type TaskDetail = {
  id: number;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
  departments?: { department: { id: number; name: string } }[];
  members?: {
    id: number;
    status: string;
    user: { id: number; name: string };
  }[];
  responsible?: { id: number; name: string }[];
  histories?: {
    id: number;
    fromStatus: string | null;
    toStatus: string;
    operation: string;
    createdAt: string;
    operator?: { id: number; name: string };
  }[];
};

type Comment = {
  id: number;
  content: string;
  createdAt: string;
  author: { id: number; name: string };
};

type CurrentUser = {
  id: number;
  name: string;
  role?: string;
  departmentId?: number | null;
};

export default function TaskDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [requestingChange, setRequestingChange] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [taskRes, attachRes, commentsRes, meRes] = await Promise.all([
          fetch(`/api/tasks/${id}`),
          fetch(`/api/tasks/${id}/attachments`),
          fetch(`/api/tasks/${id}/comments`),
          fetch("/api/auth/me"),
        ]);

        if (!taskRes.ok) {
          const data = await taskRes.json().catch(() => ({}));
          setError(data.message || "加载任务失败");
          return;
        }
        const taskData = await taskRes.json();
        setTask(taskData.task);

        if (attachRes.ok) {
          const attachData = await attachRes.json();
          setAttachments(attachData.attachments || []);
        }

        if (commentsRes.ok) {
          const commentsData = await commentsRes.json();
          setComments(commentsData.comments || []);
        }

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user);
      }
      } catch {
        setError("网络错误");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const isMember =
    !!currentUser &&
    !!task?.members?.some((m) => m.user.id === currentUser.id);

  const memberRecord = currentUser
    ? task?.members?.find((m) => m.user.id === currentUser.id)
    : undefined;

  const isResponsible =
    !!currentUser &&
    !!task?.responsible?.some((u) => u.id === currentUser.id);

  const isAdminLike =
    currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  const canEdit = isResponsible || isAdminLike;

  async function handleMemberSubmit() {
    if (!id) return;
    setMemberSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${id}/member-submit`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "提交失败");
        return;
      }
      // 重新加载任务
      const taskRes = await fetch(`/api/tasks/${id}`);
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        setTask(taskData.task);
      }
    } catch {
      alert("网络错误，提交失败");
    } finally {
      setMemberSubmitting(false);
    }
  }

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/tasks/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "操作失败");
        return;
      }
      const taskRes = await fetch(`/api/tasks/${id}`);
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        setTask(taskData.task);
      }
    } catch {
      alert("网络错误，操作失败");
    } finally {
      setApproving(false);
    }
  }

  async function handleRequestChange() {
    if (!id) return;
    setRequestingChange(true);
    try {
      const res = await fetch(`/api/tasks/${id}/request-change`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "操作失败");
        return;
      }
      const taskRes = await fetch(`/api/tasks/${id}`);
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        setTask(taskData.task);
      }
    } catch {
      alert("网络错误，操作失败");
    } finally {
      setRequestingChange(false);
    }
  }

  function openEdit() {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditDueDate(
      task.dueDate
        ? new Date(task.dueDate).toISOString().slice(0, 16)
        : ""
    );
    setEditError(null);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!id || !task) return;
    if (!editTitle || !editDescription) {
      setEditError("标题和内容不能为空");
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          dueDate: editDueDate
            ? new Date(editDueDate).toISOString()
            : null,
          responsibleIds: task.responsible?.map((u) => u.id) ?? [],
          memberIds: task.members?.map((m) => m.user.id) ?? [],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditError(data.message || "保存失败");
        return;
      }
      const updated = await res.json();
      setTask((prev) => ({
        ...(prev as any),
        ...updated.task,
      }));
      setEditing(false);
    } catch {
      setEditError("网络错误，保存失败");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleUploadAttachments(e: ChangeEvent<HTMLInputElement>) {
    if (!id) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));

    try {
      const res = await fetch(`/api/tasks/${id}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "上传附件失败");
        return;
      }
      const attachRes = await fetch(`/api/tasks/${id}/attachments`);
      if (attachRes.ok) {
        const attachData = await attachRes.json();
        setAttachments(attachData.attachments || []);
      }
      e.target.value = "";
    } catch {
      alert("网络错误，上传失败");
    }
  }

  async function handleAddComment() {
    if (!id) return;
    if (!commentContent.trim()) {
      setCommentError("评论内容不能为空");
      return;
    }
    setCommentError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCommentError(data.message || "发表评论失败");
        return;
      }
      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setCommentContent("");
    } catch {
      setCommentError("网络错误，发表评论失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (!id) {
    return <p className="text-sm text-red-600 p-4">无效任务 ID</p>;
  }

  if (loading) {
    return <p className="text-sm text-slate-500 p-4">加载中...</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 p-4" aria-live="polite">
        {error}
      </p>
    );
  }

  if (!task) {
    return <p className="text-sm text-slate-500 p-4">任务不存在</p>;
  }

  const statusLabel =
    task.status === "IN_PROGRESS"
      ? "进行中"
      : task.status === "UNDER_REVIEW"
      ? "审核中"
      : task.status === "COMPLETED"
      ? "已完成"
      : task.status === "REVISION"
      ? "修改中"
      : task.status;

  function statusToLabel(status: string | null) {
    if (!status) return "无";
    if (status === "IN_PROGRESS") return "进行中";
    if (status === "UNDER_REVIEW") return "审核中";
    if (status === "COMPLETED") return "已完成";
    if (status === "REVISION") return "修改中";
    return status;
  }

  return (
    <div className="space-y-4 text-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/tasks"
            className="inline-flex items-center text-xs text-slate-500 hover:text-police-600"
          >
            ← 返回任务列表
          </Link>
          <div>
            <h2 className="text-xl font-semibold mb-1">{task.title}</h2>
            <p className="text-sm text-slate-500">
              状态：{statusLabel}{" "}
              {task.dueDate &&
                `｜ 截止：${new Date(task.dueDate).toLocaleString()}`}{" "}
              {!!task.departments &&
                task.departments.length > 0 &&
                `｜ 所属大队：${task.departments
                  .map((d) => d.department?.name)
                  .filter((n): n is string => !!n)
                  .join("、")}`}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          {isMember && memberRecord && task.status !== "COMPLETED" && (
            <button
              type="button"
              disabled={memberRecord.status === "SUBMITTED" || memberSubmitting}
              onClick={handleMemberSubmit}
              className="px-3 py-1.5 rounded-full border border-police-500 text-police-700 bg-white hover:bg-police-50 disabled:opacity-60"
            >
              {memberRecord.status === "SUBMITTED"
                ? "已提交"
                : memberSubmitting
                ? "提交中..."
                : "成员提交"}
            </button>
          )}
          {isResponsible && task.status !== "COMPLETED" && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={approving || task.status === "COMPLETED"}
                onClick={handleApprove}
                className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs hover:bg-emerald-600 disabled:opacity-60"
              >
                {approving ? "通过中..." : "通过"}
              </button>
              <button
                type="button"
                disabled={requestingChange || task.status === "COMPLETED"}
                onClick={handleRequestChange}
                className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs hover:bg-amber-600 disabled:opacity-60"
              >
                {requestingChange ? "退回中..." : "修改"}
              </button>
            </div>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={openEdit}
              className="px-3 py-1.5 rounded-full border border-police-500 text-police-700 bg-white hover:bg-police-50"
            >
              编辑任务
            </button>
          )}
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold mb-2">任务内容</h3>
        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-500">标题</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-police-400 focus:border-police-400"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-500">
                截止日期
              </label>
              <input
                type="datetime-local"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-police-400 focus:border-police-400"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>
            {editError && (
              <p className="text-xs text-red-500" aria-live="polite">
                {editError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  setEditing(false);
                  setEditError(null);
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={handleSaveEdit}
                className="px-4 py-1.5 text-xs rounded-full bg-gradient-to-r from-police-400 to-police-600 text-white hover:from-police-300 hover:to-police-500 disabled:opacity-60"
              >
                {editSaving ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap text-slate-800">
            {task.description}
          </p>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold mb-2">成员信息</h3>
        {(!task.members || task.members.length === 0) ? (
          <p className="text-sm text-slate-500">暂无成员</p>
        ) : (
          <ul className="text-sm text-slate-800 space-y-1">
            {task.members?.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span>{m.user.name}</span>
                <span className="text-xs text-slate-500">
                  {m.status === "SUBMITTED" ? "已提交" : "待处理"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold">状态流转</h3>
        {!task.histories || task.histories.length === 0 ? (
          <p className="text-sm text-slate-500">暂无状态记录</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-800">
            {task.histories.map((h) => (
              <li key={h.id} className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-police-500" />
                <div>
                  <div className="text-xs text-slate-400">
                    {new Date(h.createdAt).toLocaleString()} ·{" "}
                    {h.operator?.name || "系统"}
                  </div>
                  <div>
                    {statusToLabel(h.fromStatus)} → {statusToLabel(h.toStatus)}{" "}
                    <span className="text-xs text-slate-400">
                      （{h.operation}）
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">附件</h3>
          <label className="text-xs text-police-700 cursor-pointer">
            上传附件
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleUploadAttachments}
            />
          </label>
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-slate-500">暂无附件</p>
        ) : (
          <ul className="list-disc pl-4 text-sm text-slate-800">
            {attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/attachments/${a.id}/download`}
                  className="text-police-700 hover:text-police-500 hover:underline"
                >
                  {a.filename}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold">评论</h3>
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500">暂无评论</p>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {comments.map((c) => (
              <li key={c.id} className="text-sm text-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    {c.author.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {c.content}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <textarea
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-police-400 focus:border-police-400"
            rows={3}
            placeholder="输入评论内容…"
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
          />
          {commentError && (
            <p className="text-xs text-red-600">{commentError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={handleAddComment}
              className="px-4 py-1.5 rounded-full bg-police-500 text-white text-xs font-medium hover:bg-police-600 disabled:opacity-60"
            >
              {submitting ? "发送中..." : "发表评论"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
