"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [badgeNo, setBadgeNo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeNo, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "登录失败");
        return;
      }
      window.location.href = "/tasks";
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-sky-100 to-sky-200 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/90 border border-sky-200 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-md mb-1">
            <span className="text-lg font-semibold text-white">警</span>
          </div>
          <h1 className="text-xl font-semibold tracking-wide text-slate-900">
            治安任务管理系统
          </h1>
          <p className="text-xs text-slate-500">
            云浮市公安局 · 治安管理支队
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-xs text-slate-600">警号</label>
            <input
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
              value={badgeNo}
              onChange={(e) => setBadgeNo(e.target.value)}
              placeholder="请输入警号"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-xs text-slate-600">密码</label>
            <input
              type="password"
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          {error && (
            <p className="text-red-500 text-xs" aria-live="polite">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 text-white text-sm font-medium py-2.5 shadow-md hover:from-sky-400 hover:to-sky-500 disabled:opacity-60 transition-colors"
          >
            {loading ? "登录中..." : "登录"}
          </button>
          {/* <p className="mt-1 text-[11px] text-slate-500 text-center">
            初始超级管理员：警号 270378，密码 admin123
          </p> */}
        </form>
      </div>
    </main>
  );
}
