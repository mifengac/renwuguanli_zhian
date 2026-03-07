import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  badRequestResponse,
  getCurrentUser,
  getRequestIp,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/server-auth";
import { canManageMonitorConfig } from "@/lib/monitor/access";
import { buildMonitorOperator, createMonitorOperateLog } from "@/lib/monitor/audit";
import { parseItemInput } from "@/lib/monitor/input";

function getId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const id = getId(params);
  if (!id) {
    return badRequestResponse("事项 ID 不合法");
  }

  const existing = await prisma.monitorItem.findUnique({
    where: { id },
    include: {
      plan: true,
    },
  });

  if (!existing) {
    return notFoundResponse("事项不存在");
  }

  if (!canManageMonitorConfig(currentUser, existing.plan.ownerDeptId)) {
    return NextResponse.json({ message: "无权限修改该事项" }, { status: 403 });
  }

  const parsed = parseItemInput(await req.json());
  if (!("data" in parsed)) {
    return badRequestResponse(parsed.error);
  }
  const payload = parsed.data!;

  const operator = buildMonitorOperator(currentUser, getRequestIp(req));

  try {
    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.monitorItem.update({
        where: { id: existing.id },
        data: {
          itemCode: payload.itemCode,
          itemName: payload.itemName,
          itemCategory: payload.itemCategory,
          cycleType: payload.cycleType,
          cycleConf: payload.cycleConf,
          dueTime: payload.dueTime,
          completeMode: payload.completeMode,
          needAttachment: payload.needAttachment,
          needRemark: payload.needRemark,
          sortNo: payload.sortNo,
          isEnabled: payload.isEnabled,
          remark: payload.remark,
          updatedBy: currentUser.id,
        },
      });

      await createMonitorOperateLog(tx, {
        planId: existing.planId,
        itemId: updated.id,
        actionType: "UPDATE_ITEM",
        operator,
        detailJson: {
          before: {
            itemCode: existing.itemCode,
            itemName: existing.itemName,
            cycleType: existing.cycleType,
            isEnabled: existing.isEnabled,
          },
          after: {
            itemCode: updated.itemCode,
            itemName: updated.itemName,
            cycleType: updated.cycleType,
            isEnabled: updated.isEnabled,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return badRequestResponse("事项编码在该专项下已存在");
    }

    throw error;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const id = getId(params);
  if (!id) {
    return badRequestResponse("事项 ID 不合法");
  }

  const existing = await prisma.monitorItem.findUnique({
    where: { id },
    include: {
      plan: true,
    },
  });

  if (!existing) {
    return notFoundResponse("事项不存在");
  }

  if (!canManageMonitorConfig(currentUser, existing.plan.ownerDeptId)) {
    return NextResponse.json({ message: "无权限停用该事项" }, { status: 403 });
  }

  const operator = buildMonitorOperator(currentUser, getRequestIp(req));

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.monitorItem.update({
      where: { id: existing.id },
      data: {
        isEnabled: false,
        updatedBy: currentUser.id,
      },
    });

    await createMonitorOperateLog(tx, {
      planId: existing.planId,
      itemId: existing.id,
      actionType: "DISABLE_ITEM",
      operator,
      detailJson: {
        previousEnabled: existing.isEnabled,
        currentEnabled: updated.isEnabled,
      },
    });

    return updated;
  });

  return NextResponse.json({ item });
}
