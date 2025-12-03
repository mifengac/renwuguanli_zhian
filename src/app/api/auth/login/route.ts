import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signAuthToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { badgeNo, password } = await req.json();

  if (!badgeNo || !password) {
    return NextResponse.json(
      { message: "警号和密码不能为空" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { badgeNo },
  });

  if (!user) {
    return NextResponse.json({ message: "用户不存在" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ message: "警号或密码错误" }, { status: 401 });
  }

  const token = signAuthToken({
    userId: user.id,
    badgeNo: user.badgeNo,
    role: user.role,
    departmentId: user.departmentId ?? null,
  });

  const { passwordHash, ...safeUser } = user;

  const res = NextResponse.json({ user: safeUser });

  // 在目前 HTTP 部署场景下，不能强制使用 secure cookie，否则浏览器不会保存
  // 如需在 HTTPS 下启用，请在部署时设置 COOKIE_SECURE=true
  const secureCookie = process.env.COOKIE_SECURE === "true";

  res.cookies.set("auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
