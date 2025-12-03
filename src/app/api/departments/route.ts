import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const departments = await prisma.department.findMany({
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ departments });
}

