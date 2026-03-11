import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequestResponse,
  getCurrentUser,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/server-auth";
import {
  formatMonitorTimeZoneDateTime,
  formatMonitorWallClockDateTime,
} from "@/lib/monitor/time";

function getId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const id = getId(params);
  if (!id) {
    return badRequestResponse("实例 ID 不合法");
  }

  const instance = await prisma.monitorInstance.findUnique({
    where: { id },
    include: {
      plan: true,
      item: {
        include: {
          itemUsers: {
            orderBy: [{ roleType: "asc" }, { id: "asc" }],
          },
          rules: {
            orderBy: [{ id: "asc" }],
          },
        },
      },
      notifyLogs: {
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });

  if (!instance) {
    return notFoundResponse("实例不存在");
  }

  return NextResponse.json({
    instance: {
      ...instance,
      dueAt: formatMonitorWallClockDateTime(instance.dueAt),
      firstRemindAt: formatMonitorTimeZoneDateTime(instance.firstRemindAt),
      lastRemindAt: formatMonitorTimeZoneDateTime(instance.lastRemindAt),
      completedAt: formatMonitorTimeZoneDateTime(instance.completedAt),
      createdAt: formatMonitorTimeZoneDateTime(instance.createdAt),
      updatedAt: formatMonitorTimeZoneDateTime(instance.updatedAt),
      notifyLogs: instance.notifyLogs.map((log) => ({
        ...log,
        sendTime: formatMonitorTimeZoneDateTime(log.sendTime),
        createdAt: formatMonitorTimeZoneDateTime(log.createdAt),
        oraclePushTime: formatMonitorTimeZoneDateTime(log.oraclePushTime),
      })),
    },
  });
}
