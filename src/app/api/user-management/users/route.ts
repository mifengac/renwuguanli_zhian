import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

function ensureCanManageUser(
  actor: { role: string; departmentId: number | null },
  targetDepartmentId: number | null,
  targetRole?: string
) {
  if (actor.role === "USER") {
    throw new Error("NO_PERMISSION");
  }

  if (actor.role === "ADMIN") {
    if (targetDepartmentId == null || actor.departmentId == null) {
      throw new Error("NO_PERMISSION");
    }
    if (targetDepartmentId !== actor.departmentId) {
      throw new Error("NO_PERMISSION");
    }
    if (targetRole === "SUPER_ADMIN") {
      throw new Error("NO_PERMISSION");
    }
  }

  if (actor.role === "SUPER_ADMIN") {
    if (targetRole && !["USER", "ADMIN", "SUPER_ADMIN"].includes(targetRole)) {
      throw new Error("NO_PERMISSION");
    }
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const { name, badgeNo, role, departmentId } = await req.json();

  if (!name || !badgeNo || !role || !departmentId) {
    return NextResponse.json(
      { message: "姓名、警号、角色、所属大队均为必填" },
      { status: 400 }
    );
  }

  try {
    ensureCanManageUser(
      { role: payload.role, departmentId: payload.departmentId },
      departmentId,
      role
    );
  } catch {
    return NextResponse.json({ message: "无权限操作该用户" }, { status: 403 });
  }

  const exist = await prisma.user.findUnique({ where: { badgeNo } });
  if (exist) {
    return NextResponse.json({ message: "该警号已存在" }, { status: 400 });
  }

  const defaultPassword = "admin123";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const user = await prisma.user.create({
    data: {
      name,
      badgeNo,
      role,
      departmentId,
      passwordHash,
      isInitialPassword: true,
    },
  });

  return NextResponse.json({ user });
}

