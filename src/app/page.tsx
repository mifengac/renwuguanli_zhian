import { redirect } from "next/navigation";

export default function HomePage() {
  // 登录后访问根路径时，默认进入任务管理界面
  redirect("/tasks");
}

