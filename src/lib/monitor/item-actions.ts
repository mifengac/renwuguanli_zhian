import { prisma } from "@/lib/prisma";
import { MonitorOperator, createMonitorOperateLog } from "@/lib/monitor/audit";

export async function updateMonitorItemStatus(params: {
  itemId: number;
  status: "ACTIVE" | "COMPLETED";
  operator: MonitorOperator;
  reason?: string | null;
}) {
  const item = await prisma.monitorItem.findUnique({
    where: { id: params.itemId },
    include: {
      plan: true,
      itemUsers: true,
    },
  });

  if (!item) {
    throw new Error("ITEM_NOT_FOUND");
  }

  if (item.status === params.status) {
    throw new Error("ITEM_STATUS_UNCHANGED");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.monitorItem.update({
      where: { id: item.id },
      data: {
        status: params.status,
        updatedBy: params.operator.operatorId,
      },
      include: {
        plan: true,
        itemUsers: true,
        rules: {
          orderBy: [{ id: "asc" }],
        },
        _count: {
          select: {
            instances: true,
          },
        },
      },
    });

    await createMonitorOperateLog(tx, {
      planId: next.planId,
      itemId: next.id,
      actionType: "UPDATE_ITEM",
      operator: params.operator,
      detailJson: {
        action: params.status === "COMPLETED" ? "complete_item" : "reopen_item",
        fromStatus: item.status,
        toStatus: next.status,
        reason: params.reason?.trim() || null,
      },
    });

    return next;
  });

  return updated;
}
