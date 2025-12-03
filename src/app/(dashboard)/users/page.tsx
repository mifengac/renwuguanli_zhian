"use client";

import { useEffect, useState } from "react";

type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

type Department = {
  id: number;
  name: string;
};

type UserRow = {
  id: number;
  name: string;
  badgeNo: string;
  role: Role;
  departmentId: number | null;
  departmentName: string | null;
};

type CurrentUser = {
  id: number;
  name: string;
  badgeNo: string;
  role: Role;
  departmentId: number | null;
};

function EditUserForm({
  user,
  departments,
  currentUser,
  onCancel,
  onSuccess,
}: {
  user: UserRow;
  departments: Department[];
  currentUser: CurrentUser | null;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [formName, setFormName] = useState(user.name);
  const [formRole, setFormRole] = useState<Role>(user.role);
  const [formDepartmentId, setFormDepartmentId] = useState<number | "">(
    user.departmentId ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!formName || !formDepartmentId) {
      setError("姓名和所属大队为必填项");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/user-management/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          role: formRole,
          departmentId: formDepartmentId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "更新失败");
        return;
      }
      onSuccess();
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-50 p-4 border-t border-b border-slate-200 shadow-inner space-y-3">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-[11px] mb-1 text-slate-500">姓名</label>
          <input
            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
        </div>
        <div className="flex-1">
           <label className="block text-[11px] mb-1 text-slate-500">警号 (不可修改)</label>
           <input
             className="w-full border border-slate-200 bg-slate-100 rounded px-2 py-1 text-sm text-slate-500 cursor-not-allowed"
             value={user.badgeNo}
             disabled
           />
        </div>
        <div className="w-32">
          <label className="block text-[11px] mb-1 text-slate-500">角色</label>
          <select
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs h-[30px]"
            value={formRole}
            onChange={(e) => setFormRole(e.target.value as Role)}
          >
            <option value="USER">普通用户</option>
            <option value="ADMIN">管理员</option>
            {currentUser?.role === "SUPER_ADMIN" && (
              <option value="SUPER_ADMIN">超级管理员</option>
            )}
          </select>
        </div>
        <div className="w-48">
          <label className="block text-[11px] mb-1 text-slate-500">
            所属大队
          </label>
          <select
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs h-[30px]"
            value={formDepartmentId}
            onChange={(e) =>
              setFormDepartmentId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">请选择</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pb-0.5">
             <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-3 py-1.5 text-xs rounded bg-police-500 text-white hover:bg-police-600 disabled:opacity-60"
          >
            {saving ? "保存..." : "保存修改"}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded Row ID for editing
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  // Create Form State
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formBadgeNo, setFormBadgeNo] = useState("");
  const [formRole, setFormRole] = useState<Role>("USER");
  const [formDepartmentId, setFormDepartmentId] = useState<number | "">("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Bulk Import State
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  function canManage() {
    if (!currentUser) return false;
    return currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";
  }

  useEffect(() => {
    async function load() {
      try {
        const [meRes, usersRes, deptRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/users"),
          fetch("/api/departments"),
        ]);

        if (!meRes.ok) {
          setError("未登录或登录已失效");
          setLoading(false);
          return;
        }
        const meData = await meRes.json();
        setCurrentUser(meData.user);

        if (!usersRes.ok) {
          const data = await usersRes.json().catch(() => ({}));
          setError(data.message || "加载用户列表失败");
          setLoading(false);
          return;
        }
        const usersData = await usersRes.json();
        const list: UserRow[] = (usersData.users || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          badgeNo: u.badgeNo,
          role: u.role,
          departmentId: u.department?.id ?? null,
          departmentName: u.department?.name ?? null,
        }));
        setUsers(list);

        if (deptRes.ok) {
          const deptData = await deptRes.json();
          setDepartments(deptData.departments || []);
        }
      } catch {
        setError("网络错误");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function refreshUsers() {
    const usersRes = await fetch("/api/users");
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      const list: UserRow[] = (usersData.users || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        badgeNo: u.badgeNo,
        role: u.role,
        departmentId: u.department?.id ?? null,
        departmentName: u.department?.name ?? null,
      }));
      setUsers(list);
    }
  }

  function openCreateForm() {
    setIsCreating(true);
    setFormName("");
    setFormBadgeNo("");
    setFormRole("USER");
    setFormDepartmentId(
      currentUser?.departmentId != null ? currentUser.departmentId : ""
    );
    setFormError(null);
    // Close edit if open
    setEditingUserId(null);
  }

  async function handleCreate() {
    if (!formName || !formBadgeNo || !formDepartmentId) {
      setFormError("姓名、警号、所属大队均为必填");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
        const res = await fetch("/api/user-management/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            badgeNo: formBadgeNo,
            role: formRole,
            departmentId: formDepartmentId,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setFormError(data.message || "创建用户失败");
          return;
        }

      await refreshUsers();
      setIsCreating(false);
      setFormName("");
      setFormBadgeNo("");
      setFormRole("USER");
      setFormDepartmentId(
        currentUser?.departmentId != null ? currentUser.departmentId : ""
      );
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: UserRow) {
      if (!confirm(`确定要删除用户 ${user.name} (${user.badgeNo}) 吗？`)) return;
      
      try {
          const res = await fetch(`/api/user-management/users/${user.id}`, {
              method: "DELETE"
          });
          const data = await res.json();
          if (!res.ok) {
              alert(data.message || "删除失败");
              return;
          }
          await refreshUsers();
      } catch (e) {
          alert("网络错误");
      }
  }

  function roleLabel(role: Role) {
    if (role === "ADMIN") return "管理员";
    if (role === "SUPER_ADMIN") return "超级管理员";
    return "普通用户";
  }

  function parseBulkInput() {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const errors: string[] = [];
    const parsed: {
      name: string;
      badgeNo: string;
      departmentId: number;
      role?: string;
    }[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(/[,，]/).map((p) => p.trim());
      const [name, badgeNo, dept, role] = parts;
      if (!name || !badgeNo || !dept) {
        errors.push(`第 ${idx + 1} 行缺少必填字段`);
        return;
      }
      const deptId = departments.find(
        (d) => String(d.id) === dept || d.name === dept
      )?.id;
      if (!deptId) {
        errors.push(`第 ${idx + 1} 行所属大队无法匹配：${dept}`);
        return;
      }
      parsed.push({
        name,
        badgeNo,
        departmentId: deptId,
        role: role ? role.toUpperCase() : "USER",
      });
    });

    return { parsed, errors };
  }

  async function handleBulkCreate() {
    setBulkError(null);
    const { parsed, errors } = parseBulkInput();
    if (errors.length > 0) {
      setBulkError(errors.join("；"));
      return;
    }
    if (parsed.length === 0) {
      setBulkError("请输入至少一行用户信息");
      return;
    }

    setBulkSaving(true);
    try {
      const res = await fetch("/api/user-management/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: parsed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBulkError(data.message || "批量创建失败");
        return;
      }
      await refreshUsers();
      setBulkText("");
      setShowBulk(false);
    } catch {
      setBulkError("网络错误");
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 text-slate-900">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-1">用户管理</h2>
          <p className="text-[11px] text-slate-300">
            管理员可管理本大队用户，超级管理员可管理所有用户。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/tasks"
            className="px-3 py-1.5 rounded-full border border-slate-300 text-xs text-slate-700 bg-white hover:border-police-300 hover:text-police-700"
          >
            返回任务
          </a>
          {canManage() && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCreateForm}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-police-400 to-police-600 text-white text-xs font-medium shadow-md hover:from-police-300 hover:to-police-500"
              >
                新增用户
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBulk((v) => !v);
                  setBulkError(null);
                }}
                className="px-4 py-2 rounded-full border border-police-200 text-police-700 text-xs font-medium bg-white hover:border-police-300 hover:text-police-800"
              >
                批量新增
              </button>
            </div>
          )}
        </div>
      </header>

      {isCreating && (
        <section className="mt-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold mb-1">
            新增用户
          </h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] mb-1 text-slate-300">
                姓名
              </label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="flex-1">
                <label className="block text-[11px] mb-1 text-slate-300">
                  警号
                </label>
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={formBadgeNo}
                  onChange={(e) => setFormBadgeNo(e.target.value)}
                />
            </div>
            <div>
              <label className="block text-[11px] mb-1 text-slate-300">
                角色
              </label>
              <select
                className="border rounded px-2 py-1 text-xs"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as Role)}
              >
                <option value="USER">普通用户</option>
                <option value="ADMIN">管理员</option>
                {currentUser?.role === "SUPER_ADMIN" && (
                  <option value="SUPER_ADMIN">超级管理员</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1 text-slate-300">
                所属大队
              </label>
              <select
                className="border rounded px-2 py-1 text-xs"
                value={formDepartmentId}
                onChange={(e) =>
                  setFormDepartmentId(
                    e.target.value ? Number(e.target.value) : ""
                  )
                }
              >
                <option value="">请选择</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {formError && (
            <p className="text-xs text-red-400" aria-live="polite">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setIsCreating(false);
              }}
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleCreate}
              className="px-4 py-1.5 text-xs rounded-full bg-gradient-to-r from-police-400 to-police-600 text-white hover:from-police-300 hover:to-police-500 disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </section>
      )}

      {showBulk && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">批量新增用户</h3>
              <p className="text-[11px] text-slate-500">
                每行格式：姓名, 警号, 所属大队(名称或ID), 角色(可选，默认USER)
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => {
                setShowBulk(false);
                setBulkError(null);
              }}
            >
              关闭
            </button>
          </div>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 min-h-[140px] focus:outline-none focus:ring-2 focus:ring-police-400 focus:border-police-400"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"张三, 270001, 信息工作大队, USER\n李四, 270002, 1, ADMIN"}
          />
          {bulkError && (
            <p className="text-xs text-red-500" aria-live="polite">
              {bulkError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setShowBulk(false);
                setBulkError(null);
              }}
            >
              取消
            </button>
            <button
              type="button"
              disabled={bulkSaving}
              onClick={handleBulkCreate}
              className="px-4 py-1.5 text-xs rounded-full bg-gradient-to-r from-police-400 to-police-600 text-white hover:from-police-300 hover:to-police-500 disabled:opacity-60"
            >
              {bulkSaving ? "提交中..." : "导入"}
            </button>
          </div>
        </section>
      )}

      <section className="mt-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        {loading && <p className="text-sm text-slate-500">加载中...</p>}
        {error && (
          <p className="text-sm text-red-500 mb-2" aria-live="polite">
            {error}
          </p>
        )}
        {!loading && !error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 font-normal">姓名</th>
                <th className="py-2 font-normal">警号</th>
                <th className="py-2 font-normal">所属大队</th>
                <th className="py-2 font-normal">角色</th>
                {canManage() && <th className="py-2 font-normal">操作</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                  <>
                    <tr
                    key={u.id}
                    className={`border-b border-slate-100 last:border-b-0 transition-colors ${editingUserId === u.id ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                    >
                    <td className="py-1 text-slate-900">{u.name}</td>
                    <td className="py-1 text-slate-800">{u.badgeNo}</td>
                    <td className="py-1 text-slate-800">
                        {u.departmentName || "-"}
                    </td>
                    <td className="py-1 text-slate-900">{roleLabel(u.role)}</td>
                    {canManage() && (
                        <td className="py-1 flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (editingUserId === u.id) {
                                    setEditingUserId(null);
                                } else {
                                    setEditingUserId(u.id);
                                    setIsCreating(false); // Close create form
                                }
                            }}
                            className="px-3 py-1 text-[11px] rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100"
                        >
                            {editingUserId === u.id ? '收起' : '编辑'}
                        </button>
                        <button
                             type="button"
                             onClick={() => handleDelete(u)}
                             className="px-3 py-1 text-[11px] rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                        >
                            删除
                        </button>
                        </td>
                    )}
                    </tr>
                    {editingUserId === u.id && (
                        <tr key={`${u.id}-edit`}>
                            <td colSpan={5} className="p-0">
                                <EditUserForm 
                                    user={u} 
                                    departments={departments} 
                                    currentUser={currentUser} 
                                    onCancel={() => setEditingUserId(null)}
                                    onSuccess={() => {
                                        refreshUsers();
                                        setEditingUserId(null);
                                    }}
                                />
                            </td>
                        </tr>
                    )}
                  </>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={canManage() ? 5 : 4}
                    className="py-2 text-sm text-slate-400"
                  >
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
