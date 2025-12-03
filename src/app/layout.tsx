import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "治安任务管理系统",
  description: "云浮市公安局治安管理支队任务管理",
  icons: {
    icon: "/logo-zhi.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-sky-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
