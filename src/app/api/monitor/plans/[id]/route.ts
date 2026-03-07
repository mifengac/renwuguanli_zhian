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
import { parsePlanInput } from "@/lib/monitor/input";

const PLAN_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ENABLED"],
  ENABLED: ["PAUSED", "FINISHED"],
  PAUSED: ["ENABLED"],
  FINISHED: [],
};

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

  const id = getId(params);
  if (!id) {
    return badRequestResponse("专项工作 ID 不合法");
  }

  const plan = await prisma.monitorPlan.findFirst({
    where: {
      id,
      deletedFlag: false,
    },
    include: {
      items: {
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
      },
      _count: {
        select: {
          items: true,
          instances: true,
          operateLogs: true,
        },
      },
    },
  });

  if (!plan) {
    return notFoundResponse("专项工作不存在");
  }

  return NextResponse.json({ plan });
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
    return badRequestResponse("专项工作 ID 不合法");
  }

  const existing = await prisma.monitorPlan.findFirst({
    where: {
      id,
      deletedFlag: false,
    },
  });

  if (!existing) {
    return notFoundResponse("专项工作不存在");
  }

  const parsed = parsePlanInput(await req.json());
  if (!("data" in parsed)) {
    return badRequestResponse(parsed.error);
  }
  const payload = parsed.data!;

  if (!canManageMonitorConfig(currentUser, existing.ownerDeptId)) {
    return NextResponse.json({ message: "无权限修改该专项工作" }, { status: 403 });
  }

  if (!canManageMonitorConfig(currentUser, payload.ownerDeptId)) {
    return NextResponse.json({ message: "无权限转移到目标牵头部门" }, { status: 403 });
  }

  const department = await prisma.department.findUnique({
    where: { id: payload.ownerDeptId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!department) {
    return badRequestResponse("牵头部门不存在");
  }

  const operator = buildMonitorOperator(currentUser, getRequestIp(req));

  try {
    const plan = await prisma.$transaction(async (tx) => {
      const updated = await tx.monitorPlan.update({
        where: { id: existing.id },
        data: {
          planCode: payload.planCode,
          planName: payload.planName,
          planType: payload.planType,
          sourceTaskId: payload.sourceTaskId,
          ownerDeptId: department.id,
          ownerDeptName: department.name,
          startDate: payload.startDate,
          endDate: payload.endDate,
          remark: payload.remark,
          updatedBy: currentUser.id,
        },
      });

      await createMonitorOperateLog(tx, {
        planId: updated.id,
        actionType: "UPDATE_PLAN",
        operator,
        detailJson: {
          before: {
            planCode: existing.planCode,
            planName: existing.planName,
            ownerDeptId: existing.ownerDeptId,
            status: existing.status,
          },
          after: {
            planCode: updated.planCode,
            planName: updated.planName,
            ownerDeptId: updated.ownerDeptId,
            status: updated.status,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ plan });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return badRequestResponse("专项编码已存在");
    }

    throw error;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const id = getId(params);
  if (!id) {
    return badRequestResponse("专项工作 ID 不合法");
  }

  const existing = await prisma.monitorPlan.findFirst({
    where: {
      id,
      deletedFlag: false,
    },
  });

  if (!existing) {
    return notFoundResponse("专项工作不存在");
  }

  if (!canManageMonitorConfig(currentUser, existing.ownerDeptId)) {
    return NextResponse.json({ message: "无权限变更该专项状态" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nextStatus =
    body && typeof body.status === "string" ? body.status.trim() : "";

  if (!nextStatus) {
    return badRequestResponse("请选择目标状态");
  }

  const allowed = PLAN_STATUS_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return badRequestResponse("当前状态不允许流转到目标状态");
  }

  const operator = buildMonitorOperator(currentUser, getRequestIp(req));

  const plan = await prisma.$transaction(async (tx) => {
    const updated = await tx.monitorPlan.update({
      where: { id: existing.id },
      data: {
        status: nextStatus as any,
        updatedBy: currentUser.id,
      },
    });

    await createMonitorOperateLog(tx, {
      planId: updated.id,
      actionType: "CHANGE_PLAN_STATUS",
      operator,
      detailJson: {
        fromStatus: existing.status,
        toStatus: updated.status,
      },
    });

    return updated;
  });

  return NextResponse.json({ plan });
}
