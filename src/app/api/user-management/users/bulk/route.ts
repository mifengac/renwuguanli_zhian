import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

type IncomingUser = {
  name: string;
  badgeNo: string;
  role?: Role | string;
  departmentId: number;
};

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

  const body = await req.json().catch(() => ({}));
  const users: IncomingUser[] = Array.isArray(body.users) ? body.users : [];

  if (users.length === 0) {
    return NextResponse.json({ message: "未提供用户数据" }, { status: 400 });
  }

  const normalized = users.map((u) => ({
    name: (u.name || "").trim(),
    badgeNo: String(u.badgeNo || "").trim(),
    departmentId: Number(u.departmentId),
    role: ((u.role as string) || "USER").toUpperCase(),
  }));

  const errors: string[] = [];
  const seen = new Set<string>();
  normalized.forEach((u, idx) => {
    if (!u.name || !u.badgeNo || !u.departmentId) {
      errors.push(`第 ${idx + 1} 行缺少必填项`);
    }
    if (u.role && !["USER", "ADMIN", "SUPER_ADMIN"].includes(u.role)) {
      errors.push(`第 ${idx + 1} 行角色无效: ${u.role}`);
    }
    if (seen.has(u.badgeNo)) {
      errors.push(`警号重复: ${u.badgeNo}`);
    }
    seen.add(u.badgeNo);
  });
  if (errors.length > 0) {
    return NextResponse.json({ message: errors.join("；") }, { status: 400 });
  }

  const existing = await prisma.user.findMany({
    where: { badgeNo: { in: normalized.map((u) => u.badgeNo) } },
    select: { badgeNo: true },
  });
  if (existing.length > 0) {
    const exists = existing.map((e) => e.badgeNo).join("、");
    return NextResponse.json(
      { message: `以下警号已存在：${exists}` },
      { status: 400 }
    );
  }

  const defaultPasswordHash = await bcrypt.hash("admin123", 10);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const u of normalized) {
        ensureCanManageUser(
          { role: payload.role, departmentId: payload.departmentId },
          u.departmentId,
          u.role
        );

        const user = await tx.user.create({
          data: {
            name: u.name,
            badgeNo: u.badgeNo,
            role: u.role as Role,
            departmentId: u.departmentId,
            passwordHash: defaultPasswordHash,
            isInitialPassword: true,
          },
        });
        results.push(user);
      }
      return results;
    });

    return NextResponse.json({ created: created.length, users: created });
  } catch (err: any) {
    if (err?.message === "NO_PERMISSION") {
      return NextResponse.json({ message: "无权限操作这些用户" }, { status: 403 });
    }
    return NextResponse.json(
      { message: "批量创建失败", detail: err?.message },
      { status: 500 }
    );
  }
}
