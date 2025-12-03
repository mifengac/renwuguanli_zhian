import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const DEPARTMENTS = [
  "信息工作大队",
  "基层基础及人口管理大队",
  "巡警特警及维稳工作大队",
  "治安管理行动大队",
];

async function seed() {
  const badgeNo = "270378";
  const password = "admin123";

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
    userId: user.id,
    departmentIds: departments.map((d) => d.id),
  });
}

export async function POST() {
  return seed();
}

export async function GET() {
  return seed();
}
