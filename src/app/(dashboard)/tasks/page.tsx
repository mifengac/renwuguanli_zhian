"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";

const tabs = [
  { key: "ALL", label: "全部" },
  { key: "IN_PROGRESS", label: "进行中" },
  { key: "UNDER_REVIEW", label: "待审核" },
  { key: "REVISION", label: "修改中" },
  { key: "COMPLETED", label: "已完成" },
  { key: "OVERDUE", label: "超期" },
];

type Task = {
  id: number;
  title: string;
  status: string;
  dueDate: string | null;
  departmentNames: string;
  departmentIds: number[];
  responsibleNames: string;
  memberNames: string;
  responsibleIds: number[];
};

type UserOption = {
  id: number;
  name: string;
  badgeNo: string;
  departmentId: number | null;
  departmentName: string | null;
};

type DepartmentOption = {
  id: number;
  name: string;
};

type MultiSelectProps = {
  label: string;
  options: UserOption[];
  departments: DepartmentOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
};

function MultiSelect({
  label,
  options,
  departments,
  selectedIds,
  onChange,
  placeholder,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedDeptIds, setExpandedDeptIds] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setExpandedDeptIds([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(ev: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      if (ev.target instanceof Node && !el.contains(ev.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleDepartmentExpanded(id: number) {
    setExpandedDeptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function userMatchesSearch(u: UserOption, keywordRaw: string) {
    const keyword = keywordRaw.trim();
    if (!keyword) return true;
    const text = `${u.name}${u.badgeNo}${u.departmentName ?? ""}`;
    return text.toLowerCase().includes(keyword.toLowerCase());
  }

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const summary =
    selectedIds.length === 0
      ? placeholder || `请选择${label}`
      : `${label}（${selectedIds.length}）`;

  return (
    <div className="space-y-1 text-xs">
      <span className="block text-[11px] mb-1 text-slate-600">{label}</span>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 hover:border-sky-400"
        >
          <span className="truncate">{summary}</span>
          <span className="ml-2 text-slate-400">▾</span>
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="p-2 border-b border-slate-100">
              <input
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400"
                placeholder="输入姓名或警号搜索"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-slate-400">
                先展开大队（+）再勾选人员
              </p>
            </div>

            <div className="max-h-56 overflow-auto p-2 space-y-2">
              {(
                departments.length
                  ? [...departments, { id: -1, name: "未分配部门" }]
                  : Array.from(
                      new Map(
                        options
                          .filter((u) => u.departmentId != null)
                          .map((u) => [u.departmentId as number, u.departmentName ?? "未命名部门"])
                      ),
                      ([id, name]) => ({ id, name })
                    ).concat({ id: -1, name: "未分配部门" })
              ).map((dept) => {
                  const deptUsers =
                    dept.id === -1
                      ? options.filter((u) => u.departmentId == null)
                      : options.filter((u) => u.departmentId === dept.id);

                  const visibleUsers = deptUsers.filter((u) =>
                    userMatchesSearch(u, search)
                  );

                  const expanded = dept.id !== -1 && expandedDeptIds.includes(dept.id);
                  const canExpand = dept.id !== -1;
                  const showUsers = search.trim() ? true : expanded;

                  return (
                    <div key={dept.id} className="space-y-1">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 text-left px-2 py-1 rounded hover:bg-slate-50"
                        onClick={() => {
                          if (canExpand) toggleDepartmentExpanded(dept.id);
                        }}
                      >
                        <span className="w-4 text-slate-500 font-mono">
                          {canExpand ? (expanded ? "-" : "+") : "•"}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700 truncate">
                          {dept.name}
                        </span>
                        <span className="ml-auto text-[10px] text-slate-400">
                          {deptUsers.length}
                        </span>
                      </button>

                      {showUsers && (
                        <div className="pl-6 space-y-1">
                          {visibleUsers.length === 0 ? (
                            <p className="text-[11px] text-slate-400">
                              {deptUsers.length === 0
                                ? "该大队暂无人员"
                                : "无匹配结果"}
                            </p>
                          ) : (
                            visibleUsers.map((u) => (
                              <label
                                key={u.id}
                                className="flex items-center gap-2 text-[11px] text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  className="h-3 w-3"
                                  checked={selectedIds.includes(u.id)}
                                  onChange={() => toggle(u.id)}
                                />
                                <span className="truncate">
                                  {u.name}（{u.badgeNo}）
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [active, setActive] = useState<string>("ALL");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<{
    ALL: number;
    IN_PROGRESS: number;
    UNDER_REVIEW: number;
    REVISION: number;
    COMPLETED: number;
    OVERDUE: number;
  }>({
    ALL: 0,
    IN_PROGRESS: 0,
    UNDER_REVIEW: 0,
    REVISION: 0,
    COMPLETED: 0,
    OVERDUE: 0,
  });
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    role: string;
    departmentId: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [departments, setDepartments] = useState<{"id": number; "name": string}[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [deptCounts, setDeptCounts] = useState<Record<number, number>>({});

  const [newDepartmentIds, setNewDepartmentIds] = useState<number[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newResponsibleIds, setNewResponsibleIds] = useState<number[]>([]);
  const [newMemberIds, setNewMemberIds] = useState<number[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "ALL">(10);

  const pageSizeOptions: (number | "ALL")[] = [10, 20, 50, "ALL"];

  // Calculate paginated tasks
  const paginatedTasks = (() => {
    if (pageSize === "ALL") return tasks;
    const start = (page - 1) * pageSize;
    return tasks.slice(start, start + pageSize);
  })();

  const totalPages = pageSize === "ALL" ? 1 : Math.ceil(tasks.length / (pageSize as number));
  const totalCount = tasks.length;

  function isOverdue(task: Task) {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    return due.getTime() < Date.now() && task.status !== "COMPLETED";
  }

  function filterTasks(statusKey: string, list: Task[], deptId: number | null): Task[] {
    let filtered = list;
    
    // Filter by Status
    if (statusKey === "ALL") {
      filtered = list;
    } else if (statusKey === "OVERDUE") {
      filtered = list.filter((t) => isOverdue(t));
    } else if (statusKey === "UNDER_REVIEW") {
      if (currentUser) {
        filtered = list.filter(
          (t) =>
            t.status === "UNDER_REVIEW" &&
            t.responsibleIds.includes(currentUser.id)
        );
      } else {
        filtered = [];
      }
    } else {
      filtered = list.filter((t) => t.status === statusKey);
    }

    // Filter by Department
    if (deptId !== null) {
      filtered = filtered.filter((t) => t.departmentIds.includes(deptId));
    }

    // Filter by Search Keyword
    const kw = searchKeyword.trim().toLowerCase();
    if (kw) {
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(kw)
      );
    }

    return filtered;
  }

  async function loadAllTasks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "加载失败");
        setTasks([]);
        return;
      }
      const data = await res.json();
      const list: Task[] = (data.tasks || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        departmentNames: (t.departments || [])
          .map((d: any) => d.department?.name)
          .filter((n: string | null | undefined) => !!n)
          .join("、"),
        departmentIds: (t.departments || []).map((d: any) => d.departmentId),
        responsibleNames: (t.responsible || [])
          .map((u: any) => u.name)
          .join("、"),
        memberNames: (t.members || [])
          .map((m: any) => m.user?.name)
          .join("、"),
        responsibleIds: (t.responsible || []).map((u: any) => u.id),
      }));
      setAllTasks(list);

      // Stats calculation
      const nextStats = {
        ALL: list.length,
        IN_PROGRESS: 0,
        UNDER_REVIEW: 0,
        REVISION: 0,
        COMPLETED: 0,
        OVERDUE: 0,
      };
      
      // Department counts calculation
      const counts: Record<number, number> = {};
      
      list.forEach((t) => {
        if (t.status === "IN_PROGRESS") nextStats.IN_PROGRESS += 1;
        if (t.status === "UNDER_REVIEW") nextStats.UNDER_REVIEW += 1;
        if (t.status === "REVISION") nextStats.REVISION += 1;
        if (t.status === "COMPLETED") nextStats.COMPLETED += 1;
        if (isOverdue(t)) nextStats.OVERDUE += 1;

        t.departmentIds.forEach(did => {
          counts[did] = (counts[did] || 0) + 1;
        });
      });
      
      setStats(nextStats);
      setDeptCounts(counts);
      setTasks(filterTasks(active, list, activeDeptId));
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllTasks();
  }, []);

  useEffect(() => {
    setTasks(filterTasks(active, allTasks, activeDeptId));
    setPage(1); // Reset to first page when filter changes
  }, [active, allTasks, searchKeyword, activeDeptId]);

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        setCurrentUser(data.user);
      } catch {
        // ignore
      }
    }
    loadMe();
  }, []);

  useEffect(() => {
    async function loadUsers() {
      setUsersError(null);
      try {
        const res = await fetch("/api/users");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setUsersError(data.message || "加载用户失败");
          return;
        }
        const data = await res.json();
        const list = (data.users || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          badgeNo: u.badgeNo,
          departmentId: u.department?.id ?? null,
          departmentName: u.department?.name ?? null,
        }));
        setUsers(list);
        setUsersLoaded(true);
      } catch {
        setUsersError("网络错误");
      }
    }
    loadUsers();
  }, []);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) return;
        const data = await res.json();
        setDepartments(data.departments || []);
      } catch {
        // ignore
      }
    }
    loadDepartments();
  }, []);

  async function handleCreate() {
    if (!newTitle || !newDescription) {
      setCreateError("标题和内容不能为空");
      return;
    }
    if (newResponsibleIds.length === 0) {
      setCreateError("请至少选择一名负责人");
      return;
    }
    if (newMemberIds.length === 0) {
      setCreateError("请至少选择一名成员");
      return;
    }
    if (newDepartmentIds.length === 0) {
      setCreateError("请至少选择一个所属大队");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          departmentIds: newDepartmentIds,
          dueDate: newDueDate ? new Date(newDueDate).toISOString() : null,
          responsibleIds: newResponsibleIds,
          memberIds: newMemberIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.message || "创建任务失败");
        return;
      }
      
      await loadAllTasks();
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
      setNewDueDate("");
      setNewDepartmentIds([]);
      setNewResponsibleIds([]);
      setNewMemberIds([]);
    } catch {
      setCreateError("网络错误");
    } finally {
      setCreateLoading(false);
    }
  }

  function formatStatus(status: string) {
    switch (status) {
      case "IN_PROGRESS":
        return "进行中";
      case "UNDER_REVIEW":
        return "审核中";
      case "COMPLETED":
        return "已完成";
      case "REVISION":
        return "修改中";
      default:
        return status;
    }
  }

  async function handleDelete(taskId: number) {
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      alert("仅超级管理员可以删除任务");
      return;
    }
    const ok = window.confirm("确定要删除该任务吗？此操作不可撤销。");
    if (!ok) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "删除任务失败");
        return;
      }
      await loadAllTasks();
    } catch {
      alert("网络错误，删除任务失败");
    }
  }

  function downloadTemplate() {
    const headers = ["title", "description", "dueDate", "departmentNames", "responsibleNames", "memberNames"];
    const data = [
      {
        title: "示例任务标题",
        description: "示例任务内容描述",
        dueDate: "2025-12-31 12:00",
        departmentNames: "信息工作大队",
        responsibleNames: "张三",
        memberNames: "李四, 王五"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    XLSX.utils.sheet_add_aoa(ws, [["任务标题", "任务内容", "截止时间(YYYY-MM-DD HH:mm)", "所属大队(逗号分隔)", "负责人(姓名或警号,逗号分隔)", "成员(姓名或警号,逗号分隔)"]], { origin: "A1" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "任务模板");
    XLSX.writeFile(wb, "批量导入任务模板.xlsx");
    setShowImport(false);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
    setShowImport(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Convert to JSON, starting from row 2 (index 1) because row 1 is Chinese header
        const rawData = XLSX.utils.sheet_to_json(ws, { header: ["title", "description", "dueDate", "departmentNames", "responsibleNames", "memberNames"], range: 1 });
        
        if (rawData.length === 0) {
          alert("文件内容为空或格式不正确");
          return;
        }

        const res = await fetch("/api/tasks/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: rawData }),
        });
        
        const result = await res.json();
        if (res.ok) {
          if (result.errors && result.errors.length > 0) {
            alert(`成功导入 ${result.success} 条任务。\n以下行出错：\n${result.errors.join("\n")}`);
          } else {
            alert(`成功导入 ${result.success} 条任务！`);
          }
          loadAllTasks();
        } else {
          alert(result.message || "导入失败");
        }
      } catch (err) {
        console.error(err);
        alert("文件解析失败，请确保使用了正确的模板");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  }

  return (
    <div className="w-full space-y-3 text-slate-900">
      {showCreate && (
        // 移除 backdrop-blur，使用纯色半透明背景，减轻GPU负担
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-xl border border-slate-300 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              aria-label="关闭"
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-800 font-bold"
              onClick={() => {
                setShowCreate(false);
                setCreateError(null);
              }}
            >
              ✕
            </button>
            <h3 className="text-base font-bold text-slate-800 border-l-4 border-blue-600 pl-2">新增任务</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">标题</label>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">截止日期</label>
                <input
                  type="datetime-local"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">
                所属大队（可多选）
              </label>
              <div className="flex flex-wrap gap-2 border border-slate-300 rounded p-2 max-h-32 overflow-auto bg-slate-50">
                {departments.length === 0 && (
                  <span className="text-slate-400 text-xs">暂无大队数据</span>
                )}
                {departments.map((d) => (
                  <label
                    key={d.id}
                    className="inline-flex items-center gap-1 text-xs cursor-pointer hover:bg-slate-200 px-2 py-1 rounded"
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={newDepartmentIds.includes(d.id)}
                      onChange={(e) => {
                        setNewDepartmentIds((prev) =>
                          e.target.checked
                            ? [...prev, d.id]
                            : prev.filter((id) => id !== d.id)
                        );
                      }}
                    />
                    <span>{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">内容</label>
              <textarea
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 min-h-[100px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                {!usersLoaded && !usersError && (
                  <p className="text-xs text-slate-500">用户加载中...</p>
                )}
                {usersError && (
                  <p className="text-xs text-red-600">{usersError}</p>
                )}
                {usersLoaded && (
                  <div className="relative">
                    <MultiSelect
                      label="负责人（可多选）"
                      options={users}
                      departments={departments}
                      selectedIds={newResponsibleIds}
                      onChange={setNewResponsibleIds}
                      placeholder="请选择负责人"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                {usersLoaded && (
                  <div className="relative">
                    <MultiSelect
                      label="成员（可多选）"
                      options={users}
                      departments={departments}
                      selectedIds={newMemberIds}
                      onChange={setNewMemberIds}
                      placeholder="请选择成员"
                    />
                  </div>
                )}
              </div>
            </div>
            {createError && (
              <p className="text-xs text-red-600 font-medium" aria-live="polite">
                {createError}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-100 bg-white"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={createLoading}
                onClick={handleCreate}
                className="px-4 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {createLoading ? "创建中..." : "保存任务"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 统计卡片区域 - 纯色背景，增强视觉区分 */}
      <section className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          
          let cardClasses = "";
          let textColorClasses = "";

          if (isActive) {
            switch (tab.key) {
              case "ALL":
                cardClasses = "bg-slate-700 border-slate-700 shadow-md";
                textColorClasses = "text-white";
                break;
              case "IN_PROGRESS":
                cardClasses = "bg-sky-600 border-sky-600 shadow-md";
                textColorClasses = "text-white";
                break;
              case "UNDER_REVIEW":
                cardClasses = "bg-amber-600 border-amber-600 shadow-md";
                textColorClasses = "text-white";
                break;
              case "REVISION":
                cardClasses = "bg-purple-600 border-purple-600 shadow-md";
                textColorClasses = "text-white";
                break;
              case "COMPLETED":
                cardClasses = "bg-emerald-600 border-emerald-600 shadow-md";
                textColorClasses = "text-white";
                break;
              case "OVERDUE":
                cardClasses = "bg-red-600 border-red-600 shadow-md";
                textColorClasses = "text-white";
                break;
              default:
                cardClasses = "bg-slate-700 border-slate-700 shadow-md";
                textColorClasses = "text-white";
            }
          } else {
            switch (tab.key) {
              case "ALL":
                cardClasses = "bg-slate-50 border-slate-200 hover:bg-slate-100";
                textColorClasses = "text-slate-600";
                break;
              case "IN_PROGRESS":
                cardClasses = "bg-sky-50 border-sky-200 hover:bg-sky-100";
                textColorClasses = "text-sky-700";
                break;
              case "UNDER_REVIEW":
                cardClasses = "bg-amber-50 border-amber-200 hover:bg-amber-100";
                textColorClasses = "text-amber-700";
                break;
              case "REVISION":
                cardClasses = "bg-purple-50 border-purple-200 hover:bg-purple-100";
                textColorClasses = "text-purple-700";
                break;
              case "COMPLETED":
                cardClasses = "bg-emerald-50 border-emerald-200 hover:bg-emerald-100";
                textColorClasses = "text-emerald-700";
                break;
              case "OVERDUE":
                cardClasses = "bg-red-50 border-red-200 hover:bg-red-100";
                textColorClasses = "text-red-700";
                break;
              default:
                cardClasses = "bg-slate-50 border-slate-200 hover:bg-slate-100";
                textColorClasses = "text-slate-600";
            }
          }
          
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              // 移除 left bar，直接使用卡片的背景色作为指示
              className={`h-16 w-full rounded border text-sm flex flex-col items-center justify-center transition-all duration-200 ${cardClasses}`}
            >
              <span className={`text-xs ${textColorClasses} opacity-80 mb-0.5`}>{tab.label}</span>
              <span className={`text-lg font-bold ${textColorClasses}`}>
                {tab.key === "ALL"
                  ? stats.ALL
                  : tab.key === "IN_PROGRESS"
                  ? stats.IN_PROGRESS
                  : tab.key === "UNDER_REVIEW"
                  ? allTasks.filter(
                      (t) =>
                        t.status === "UNDER_REVIEW" &&
                        currentUser &&
                        t.responsibleIds.includes(currentUser.id)
                    ).length
                  : tab.key === "REVISION"
                  ? stats.REVISION
                  : tab.key === "COMPLETED"
                  ? stats.COMPLETED
                  : stats.OVERDUE}
              </span>
            </button>
          );
        })}
      </section>

      {/* 工具栏区域 - 紧凑型设计 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center border border-slate-300 rounded-md bg-slate-50 p-0.5">
            <Link
              href="/tasks"
              className="px-3 py-1 rounded-sm text-xs font-bold bg-white shadow-sm text-blue-700"
            >
              任务管理
            </Link>
            <Link
              href="/users"
              className="px-3 py-1 rounded-sm text-xs text-slate-600 hover:text-slate-900"
            >
              用户管理
            </Link>
          </div>
          
          {/* 导入导出按钮组 */}
          <div className="flex items-center gap-1">
             <div
              className="relative"
              onMouseEnter={() => setShowImport(true)}
              onMouseLeave={() => setShowImport(false)}
            >
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                导入
              </button>
              {showImport && (
                <div className="absolute top-full left-0 mt-1 w-24 rounded-md bg-white border border-slate-200 shadow-lg text-xs text-slate-800 py-1 z-20">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
                    onClick={downloadTemplate}
                  >
                    下载模板
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
                    onClick={handleImportClick}
                  >
                    导入数据
                  </button>
                </div>
              )}
              <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
            </div>

            <div
              className="relative"
              onMouseEnter={() => setShowExport(true)}
              onMouseLeave={() => setShowExport(false)}
            >
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                导出
              </button>
              {showExport && (
                <div className="absolute top-full left-0 mt-1 w-24 rounded-md bg-white border border-slate-200 shadow-lg text-xs text-slate-800 py-1 z-20">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
                    onClick={() => {
                      const params =
                        active === "ALL"
                          ? "?format=xlsx"
                          : `?format=xlsx&status=${encodeURIComponent(active)}`;
                      window.open(`/api/tasks/export${params}`, "_blank");
                      setShowExport(false);
                    }}
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
                    onClick={() => {
                      const params =
                        active === "ALL"
                          ? "?format=csv"
                          : `?format=csv&status=${encodeURIComponent(active)}`;
                      window.open(`/api/tasks/export${params}`, "_blank");
                      setShowExport(false);
                    }}
                  >
                    CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="flex-1 md:max-w-xs relative">
             <input
              type="text"
              placeholder="输入任务名称搜索..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-1.5 rounded-md bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 shadow-sm whitespace-nowrap"
          >
            + 新增
          </button>
        </div>
      </div>

      {/* 部门筛选栏 */}
      {departments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
           <button
              onClick={() => setActiveDeptId(null)}
              className={`px-2.5 py-1 rounded-sm text-xs border transition-colors ${activeDeptId === null
                  ? "bg-slate-700 border-slate-700 text-white font-medium"
                  : "bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              全部大队
            </button>
          {departments.map(dept => (
            <button
              key={dept.id}
              onClick={() => setActiveDeptId(dept.id === activeDeptId ? null : dept.id)}
              className={`px-2.5 py-1 rounded-sm text-xs border transition-colors flex items-center gap-1 ${activeDeptId === dept.id
                  ? "bg-blue-600 border-blue-600 text-white font-medium"
                  : "bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              {dept.name} 
              {deptCounts[dept.id] ? (
                 <span className={`text-[10px] px-1 rounded-full ${activeDeptId === dept.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                   {deptCounts[dept.id]}
                 </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* 表格区域 - 移除大阴影，使用简单边框 */}
      <section className="bg-white rounded border border-slate-300 overflow-hidden min-h-[300px]">
        {loading && <div className="p-8 text-center text-sm text-slate-500">正在加载数据...</div>}
        {error && (
          <div className="p-8 text-center text-sm text-red-600 bg-red-50">
            {error}
          </div>
        )}
        {!loading && !error && tasks.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center">
             <span className="text-2xl mb-2">📭</span>
             <span>暂无相关任务</span>
          </div>
        )}
        {!loading && !error && tasks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-300">
                <tr>
                  <th className="px-3 py-2.5 whitespace-nowrap w-1/4 min-w-[200px]">任务标题</th>
                  <th className="px-3 py-2.5 whitespace-nowrap w-32">所属大队</th>
                  <th className="px-3 py-2.5 whitespace-nowrap w-24">负责人</th>
                  <th className="px-3 py-2.5 whitespace-nowrap w-24">成员</th>
                  <th className="px-3 py-2.5 whitespace-nowrap w-24">状态</th>
                  <th className="px-3 py-2.5 whitespace-nowrap w-32">截止日期</th>
                  <th className="px-3 py-2.5 whitespace-nowrap w-20">超期</th>
                  {currentUser?.role === "SUPER_ADMIN" && (
                    <th className="px-3 py-2.5 whitespace-nowrap w-20 text-center">操作</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-blue-700 font-medium hover:underline hover:text-blue-800 text-left line-clamp-1"
                        onClick={() => router.push(`/tasks/${task.id}`)}
                        title={task.title}
                      >
                        {task.title}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs truncate max-w-[120px]" title={task.departmentNames}>
                      {task.departmentNames || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs truncate max-w-[100px]" title={task.responsibleNames}>
                      {task.responsibleNames || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs truncate max-w-[100px]" title={task.memberNames}>
                      {task.memberNames || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs border ${task.status === "IN_PROGRESS"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : task.status === "UNDER_REVIEW"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : task.status === "REVISION"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : task.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {formatStatus(task.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap font-mono">
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleString("zh-CN", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isOverdue(task) ? (
                        <span className="text-red-600 font-bold text-xs bg-red-50 px-1 py-0.5 rounded border border-red-100">是</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    {currentUser?.role === "SUPER_ADMIN" && (
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="text-xs text-red-600 hover:text-red-800 hover:underline"
                        >
                          删除
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页控件 */}
        {!loading && !error && tasks.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>每页显示：</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const value = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
                  setPageSize(value);
                  setPage(1);
                }}
                className="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "ALL" ? "全部" : `${opt}条`}
                  </option>
                ))}
              </select>
              <span className="ml-2">
                共 <span className="font-semibold text-slate-800">{totalCount}</span> 条记录
              </span>
            </div>

            {pageSize !== "ALL" && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  首页
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span className="text-xs text-slate-600 px-2">
                  <span className="font-semibold text-blue-600">{page}</span> / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  末页
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
