import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SystemRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export type AuthPayload = {
  userId: number;
  badgeNo: string;
  role: SystemRole;
  departmentId: number | null;
};

export type CurrentUser = {
  id: number;
  name: string;
  badgeNo: string;
  role: SystemRole;
  departmentId: number | null;
};

export function getAuthPayload(req: NextRequest): AuthPayload | null {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = verifyAuthToken(token);
  if (!payload) return null;

  return {
    userId: payload.userId,
    badgeNo: payload.badgeNo,
    role: payload.role as SystemRole,
    departmentId: payload.departmentId ?? null,
  };
}

export async function getCurrentUser(
  req: NextRequest
): Promise<CurrentUser | null> {
  const auth = getAuthPayload(req);
  if (!auth) return null;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      name: true,
      badgeNo: true,
      role: true,
      departmentId: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    badgeNo: user.badgeNo,
    role: user.role as SystemRole,
    departmentId: user.departmentId ?? null,
  };
}

export function getRequestIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  return realIp || null;
}

export function isAdminLike(user: Pick<CurrentUser, "role"> | null): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
}

export function isSuperAdmin(
  user: Pick<CurrentUser, "role"> | null
): boolean {
  return user?.role === "SUPER_ADMIN";
}

export function unauthorizedResponse(message = "未登录") {
  return NextResponse.json({ message }, { status: 401 });
}

export function forbiddenResponse(message = "无权限执行该操作") {
  return NextResponse.json({ message }, { status: 403 });
}

export function badRequestResponse(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export function notFoundResponse(message: string) {
  return NextResponse.json({ message }, { status: 404 });
}
