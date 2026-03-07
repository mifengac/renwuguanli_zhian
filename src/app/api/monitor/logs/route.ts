import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/server-auth";

function parsePage(value: string | null, fallback: number) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(req.url);
  const page = parsePage(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePage(searchParams.get("pageSize"), 10), 100);
  const skip = (page - 1) * pageSize;
  const planId = Number(searchParams.get("planId"));
  const itemId = Number(searchParams.get("itemId"));
  const channel = searchParams.get("channel")?.trim();
  const sendStatus = searchParams.get("sendStatus")?.trim();
  const receiverUserId = Number(searchParams.get("receiverUserId"));
  const keyword = searchParams.get("keyword")?.trim() ?? "";

  const where: Prisma.MonitorNotifyLogWhereInput = {};
  const instanceFilter: Prisma.MonitorInstanceWhereInput = {};

  if (Number.isInteger(receiverUserId) && receiverUserId > 0) {
    where.receiverUserId = receiverUserId;
  }

  if (channel) {
    where.channel = channel as any;
  }

  if (sendStatus) {
    where.sendStatus = sendStatus as any;
  }

  if (Number.isInteger(planId) && planId > 0) {
    instanceFilter.planId = planId;
  }

  if (Number.isInteger(itemId) && itemId > 0) {
    instanceFilter.itemId = itemId;
  }

  if (Object.keys(instanceFilter).length > 0) {
    where.instance = {
      is: instanceFilter,
    };
  }

  if (keyword) {
    where.OR = [
      {
        receiverName: {
          contains: keyword,
          mode: "insensitive",
        },
      },
      {
        content: {
          contains: keyword,
          mode: "insensitive",
        },
      },
      {
        instance: {
          is: {
            plan: {
              planName: {
                contains: keyword,
                mode: "insensitive",
              },
            },
          },
        },
      },
      {
        instance: {
          is: {
            item: {
              itemName: {
                contains: keyword,
                mode: "insensitive",
              },
            },
          },
        },
      },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.monitorNotifyLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }],
      include: {
        rule: true,
        instance: {
          include: {
            plan: true,
            item: true,
          },
        },
      },
    }),
    prisma.monitorNotifyLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
}
