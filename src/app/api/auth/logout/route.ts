import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ message: "已退出登录" });
  res.cookies.set("auth_token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}

