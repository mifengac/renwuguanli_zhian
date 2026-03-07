import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const [departments, users, tasks, plans, items] = await Promise.all([
    prisma.department.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.user.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        badgeNo: true,
        role: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.task.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        title: true,
      },
      take: 200,
    }),
    prisma.monitorPlan.findMany({
      where: { deletedFlag: false },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        planCode: true,
        planName: true,
        status: true,
      },
      take: 500,
    }),
    prisma.monitorItem.findMany({
      where: {
        plan: {
          deletedFlag: false,
        },
      },
      orderBy: [{ sortNo: "asc" }, { id: "asc" }],
      select: {
        id: true,
        planId: true,
        itemCode: true,
        itemName: true,
        isEnabled: true,
      },
      take: 1000,
    }),
  ]);

  return NextResponse.json({
    currentUser,
    departments,
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      badgeNo: user.badgeNo,
      role: user.role,
      departmentId: user.departmentId,
      departmentName: user.department?.name ?? null,
    })),
    tasks,
    plans,
    items,
  });
}
