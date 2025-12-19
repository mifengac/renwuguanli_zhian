import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const DEPARTMENTS = [
  "信息工作大队",
  "基层基础及人口管理大队",
  "巡警特警及维稳工作大队",
  "治安管理行动大队",
];

function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function seed(params?: { badgeNo?: string; password?: string }) {
  const badgeNo = params?.badgeNo?.trim() || "270378";
  const password = params?.password?.trim() || "admin123";

  try {
    // 初始化四个大队
    const departments = await Promise.all(
      DEPARTMENTS.map((name) =>
        prisma.department.upsert({
          where: { name },
          update: {},
          create: { name },
        })
      )
    );

    const existing = await prisma.user.findUnique({
      where: { badgeNo },
    });

    if (existing) {
      return NextResponse.json({
        message: "超级管理员已存在，已确保四个大队存在",
        badgeNo,
        departmentIds: departments.map((d) => d.id),
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const dept = departments[0];

    const user = await prisma.user.create({
      data: {
        name: "超级管理员",
        badgeNo,
        passwordHash,
        isInitialPassword: true,
        role: "SUPER_ADMIN",
        departmentId: dept.id,
      },
    });

    return NextResponse.json({
      message: "超级管理员已创建，并初始化四个大队",
      badgeNo,
      userId: user.id,
      departmentIds: departments.map((d) => d.id),
    });
  } catch (error) {
    console.error("seed-super-admin failed:", error);
    return NextResponse.json(
      {
        message: "seed-super-admin 执行失败",
        hint:
          "请检查本地已设置 DATABASE_URL 且可连接（密码包含 @ 等字符时需 URL 编码，例如 @ -> %40）。",
        details:
          process.env.NODE_ENV !== "production" ? errorToMessage(error) : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return seed({
    badgeNo: typeof body?.badgeNo === "string" ? body.badgeNo : undefined,
    password: typeof body?.password === "string" ? body.password : undefined,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return seed({
    badgeNo: searchParams.get("badgeNo") ?? undefined,
    password: searchParams.get("password") ?? undefined,
  });
}
