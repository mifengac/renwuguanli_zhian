"use client";

import { useEffect, useState } from "react";

type MeResponse = {
  user: {
    id: number;
    name: string;
    badgeNo: string;
  } | null;
};

export default function UserMenu() {
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = (await res.json()) as MeResponse;
        setMe(data.user);
      } catch {
        // ignore
      }
    }
    load();
  }, []);

  const initial = me?.name?.[0] ?? "警";

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      {!me && (
         <button
           type="button"
           onClick={logout}
           className="text-xs text-sky-200 hover:text-white hover:underline mr-2"
         >
           强制退出
         </button>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-medium shadow-sm cursor-pointer transition-colors ${
          me 
            ? "bg-slate-900/70 border-slate-500 text-slate-50" 
            : "bg-slate-800/50 border-slate-600 text-slate-300"
        }`}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-32 rounded-xl bg-slate-950/95 border border-slate-700/70 shadow-lg text-xs text-slate-100 py-2 z-50">
          <div className="px-3 pb-1 text-[11px] text-slate-300 border-b border-slate-800/50 mb-1">
            {me ? `${me.name}（${me.badgeNo}）` : "未获取用户信息"}
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 text-red-300 text-xs transition-colors"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
