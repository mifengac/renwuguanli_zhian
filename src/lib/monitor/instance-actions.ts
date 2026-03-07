import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MonitorOperator, createMonitorOperateLog } from "@/lib/monitor/audit";
import { MonitorAttachmentRef, normalizeAttachments } from "@/lib/monitor/utils";

export async function completeMonitorInstance(params: {
  instanceId: number;
  operator: MonitorOperator;
  remark?: string | null;
  attachments?: MonitorAttachmentRef[];
}) {
  const instance = await prisma.monitorInstance.findUnique({
    where: { id: params.instanceId },
    include: {
      plan: true,
      item: {
        include: {
          itemUsers: true,
        },
      },
    },
  });

  if (!instance) {
    throw new Error("INSTANCE_NOT_FOUND");
  }

  if (instance.status === "COMPLETED") {
    throw new Error("INSTANCE_ALREADY_COMPLETED");
  }

  const remark = params.remark?.trim() || "";
  const attachments = normalizeAttachments(params.attachments ?? []);

  if (instance.item.needRemark && !remark) {
    throw new Error("REMARK_REQUIRED");
  }

  if (instance.item.needAttachment && attachments.length === 0) {
    throw new Error("ATTACHMENT_REQUIRED");
  }

  const completed = await prisma.$transaction(async (tx) => {
    const updated = await tx.monitorInstance.update({
      where: { id: instance.id },
      data: {
        status: "COMPLETED",
        completedBy: params.operator.operatorId,
        completedByName: params.operator.operatorName,
        completedAt: new Date(),
        completeRemark: remark || null,
        attachmentJson:
          attachments.length > 0
            ? (attachments as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
      include: {
        plan: true,
        item: {
          include: {
            itemUsers: true,
          },
        },
      },
    });

    await createMonitorOperateLog(tx, {
      planId: updated.planId,
      itemId: updated.itemId,
      instanceId: updated.id,
      actionType: "COMPLETE",
      operator: params.operator,
      detailJson: {
        remark: remark || null,
        attachmentCount: attachments.length,
      },
    });

    return updated;
  });

  return completed;
}

export async function reopenMonitorInstance(params: {
  instanceId: number;
  operator: MonitorOperator;
  reason?: string | null;
}) {
  const instance = await prisma.monitorInstance.findUnique({
    where: { id: params.instanceId },
    include: {
      plan: true,
      item: {
        include: {
          itemUsers: true,
        },
      },
    },
  });

  if (!instance) {
    throw new Error("INSTANCE_NOT_FOUND");
  }

  if (instance.status !== "COMPLETED") {
    throw new Error("INSTANCE_NOT_COMPLETED");
  }

  const reopened = await prisma.$transaction(async (tx) => {
    const updated = await tx.monitorInstance.update({
      where: { id: instance.id },
      data: {
        status: "PENDING",
        completedBy: null,
        completedByName: null,
        completedAt: null,
        completeRemark: null,
        attachmentJson: Prisma.JsonNull,
      },
      include: {
        plan: true,
        item: {
          include: {
            itemUsers: true,
          },
        },
      },
    });

    await createMonitorOperateLog(tx, {
      planId: updated.planId,
      itemId: updated.itemId,
      instanceId: updated.id,
      actionType: "REOPEN",
      operator: params.operator,
      detailJson: {
        reason: params.reason?.trim() || null,
      },
    });

    return updated;
  });

  return reopened;
}
