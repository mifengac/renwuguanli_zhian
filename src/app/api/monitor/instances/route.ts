import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/server-auth";
import { refreshOverdueMonitorInstances } from "@/lib/monitor/reminder-service";

function parsePage(value: string | null, fallback: number) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  await refreshOverdueMonitorInstances();

  const { searchParams } = new URL(req.url);
  const page = parsePage(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePage(searchParams.get("pageSize"), 10), 100);
  const skip = (page - 1) * pageSize;
  const planId = Number(searchParams.get("planId"));
  const itemId = Number(searchParams.get("itemId"));
  const status = searchParams.get("status")?.trim();
  const keyword = searchParams.get("keyword")?.trim() ?? "";
  const periodKey = searchParams.get("periodKey")?.trim() ?? "";

  const where: Prisma.MonitorInstanceWhereInput = {};

  if (Number.isInteger(planId) && planId > 0) {
    where.planId = planId;
  }

  if (Number.isInteger(itemId) && itemId > 0) {
    where.itemId = itemId;
  }

  if (status) {
    where.status = status as any;
  }

  if (periodKey) {
    where.periodKey = {
      contains: periodKey,
      mode: "insensitive",
    };
  }

  if (keyword) {
    where.OR = [
      {
        plan: {
          planName: {
            contains: keyword,
            mode: "insensitive",
          },
        },
      },
      {
        item: {
          itemName: {
            contains: keyword,
            mode: "insensitive",
          },
        },
      },
      {
        periodLabel: {
          contains: keyword,
          mode: "insensitive",
        },
      },
    ];
  }

  const [instances, total] = await Promise.all([
    prisma.monitorInstance.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ dueAt: "asc" }, { id: "desc" }],
      include: {
        plan: true,
        item: {
          include: {
            itemUsers: {
              where: {
                isEnabled: true,
              },
              orderBy: [{ roleType: "asc" }, { id: "asc" }],
            },
          },
        },
      },
    }),
    prisma.monitorInstance.count({ where }),
  ]);

  return NextResponse.json({
    instances,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
}
