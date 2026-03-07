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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const planId = getId(params);
  if (!planId) {
    return badRequestResponse("专项工作 ID 不合法");
  }

  const items = await prisma.monitorItem.findMany({
    where: { planId },
    orderBy: [{ sortNo: "asc" }, { id: "asc" }],
    include: {
      itemUsers: {
        orderBy: [{ roleType: "asc" }, { id: "asc" }],
      },
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

  return NextResponse.json({ items });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const planId = getId(params);
  if (!planId) {
    return badRequestResponse("专项工作 ID 不合法");
  }

  const plan = await prisma.monitorPlan.findFirst({
    where: {
      id: planId,
      deletedFlag: false,
    },
  });

  if (!plan) {
    return notFoundResponse("专项工作不存在");
  }

  if (!canManageMonitorConfig(currentUser, plan.ownerDeptId)) {
    return NextResponse.json({ message: "无权限维护该专项事项" }, { status: 403 });
  }

  const parsed = parseItemInput(await req.json());
  if (!("data" in parsed)) {
    return badRequestResponse(parsed.error);
  }
  const payload = parsed.data!;

  const operator = buildMonitorOperator(currentUser, getRequestIp(req));

  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.monitorItem.create({
        data: {
          planId: plan.id,
          itemCode: payload.itemCode,
          itemName: payload.itemName,
          itemCategory: payload.itemCategory,
          status: "ACTIVE",
          cycleType: payload.cycleType,
          cycleConf: payload.cycleConf,
          dueTime: payload.dueTime,
          completeMode: payload.completeMode,
          needAttachment: payload.needAttachment,
          needRemark: payload.needRemark,
          sortNo: payload.sortNo,
          isEnabled: payload.isEnabled,
          remark: payload.remark,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
      });

      await createMonitorOperateLog(tx, {
        planId: plan.id,
        itemId: created.id,
        actionType: "CREATE_ITEM",
        operator,
        detailJson: {
          itemCode: created.itemCode,
          itemName: created.itemName,
          cycleType: created.cycleType,
        },
      });

      return created;
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return badRequestResponse("事项编码在该专项下已存在");
    }

    throw error;
  }
}
