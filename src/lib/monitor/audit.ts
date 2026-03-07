import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CurrentUser } from "@/lib/server-auth";
import { MonitorOperateActionTypeValue } from "@/lib/monitor/constants";

type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

export type MonitorOperator = {
  operatorId: number | null;
  operatorName: string | null;
  operatorDeptId: number | null;
  operatorIp: string | null;
};

export function buildMonitorOperator(
  user: CurrentUser | null,
  operatorIp: string | null
): MonitorOperator {
  return {
    operatorId: user?.id ?? null,
    operatorName: user?.name ?? "系统任务",
    operatorDeptId: user?.departmentId ?? null,
    operatorIp,
  };
}

export async function createMonitorOperateLog(
  db: PrismaExecutor,
  params: {
    planId?: number | null;
    itemId?: number | null;
    instanceId?: number | null;
    actionType: MonitorOperateActionTypeValue;
    operator: MonitorOperator;
    detailJson?: Prisma.InputJsonValue | null;
  }
) {
  await db.monitorOperateLog.create({
    data: {
      planId: params.planId ?? null,
      itemId: params.itemId ?? null,
      instanceId: params.instanceId ?? null,
      actionType: params.actionType,
      operatorId: params.operator.operatorId,
      operatorName: params.operator.operatorName,
      operatorDeptId: params.operator.operatorDeptId,
      operatorIp: params.operator.operatorIp,
      detailJson: params.detailJson ?? Prisma.JsonNull,
    },
  });
}
