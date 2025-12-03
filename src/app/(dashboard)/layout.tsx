import Link from "next/link";
import "../../styles/globals.css";
import UserMenu from "@/components/UserMenu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 顶部导航栏 - 采用紧凑的深色实底风格，减少渲染开销 */}
      <header className="bg-slate-900 text-white shadow-sm z-30 flex-none">
        <div className="max-w-[1440px] mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 简单的Logo或图标区域 */}
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <span className="font-bold text-xs">警</span>
            </div>
            <div className="leading-none">
              <h1 className="text-sm font-bold tracking-wide text-slate-100">
                治安任务管理系统
              </h1>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>

      {/* 主内容区域 - 限制最大宽度但保持适度紧凑 */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto p-2 sm:p-4">
        {children}
      </div>
    </main>
  );
}
