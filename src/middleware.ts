import { NextRequest, NextResponse } from "next/server";

// 只做最基本的“是否有登录 cookie”检查，具体鉴权在各个 API 里完成
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 保护页面路由（/tasks 及主页），仅检查是否存在 auth_token
  if (pathname.startsWith("/tasks") || pathname === "/") {
    const token = req.cookies.get("auth_token")?.value;
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
