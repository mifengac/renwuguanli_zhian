import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  badRequestResponse,
  getCurrentUser,
  getRequestIp,
  unauthorizedResponse,
} from "@/lib/server-auth";
import { canManageMonitorConfig } from "@/lib/monitor/access";
import { buildMonitorOperator, createMonitorOperateLog } from "@/lib/monitor/audit";
import { parsePlanInput } from "@/lib/monitor/input";

function parsePage(value: string | null, fallback: number) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword")?.trim() ?? "";
  const status = searchParams.get("status")?.trim();
  const ownerDeptId = Number(searchParams.get("ownerDeptId"));
  const page = parsePage(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePage(searchParams.get("pageSize"), 10), 100);
  const skip = (page - 1) * pageSize;

  const where: Prisma.MonitorPlanWhereInput = {
    deletedFlag: false,
  };

  if (status) {
    where.status = status as any;
  }

  if (keyword) {
    where.OR = [
      {
        planCode: {
          contains: keyword,
          mode: "insensitive",
        },
      },
      {
        planName: {
          contains: keyword,
          mode: "insensitive",
        },
      },
    ];
  }

  if (Number.isInteger(ownerDeptId) && ownerDeptId > 0) {
    where.ownerDeptId = ownerDeptId;
  }

  const [plans, total] = await Promise.all([
    prisma.monitorPlan.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }],
      include: {
        _count: {
          select: {
            items: true,
            instances: true,
          },
        },
      },
    }),
    prisma.monitorPlan.count({ where }),
  ]);

  return NextResponse.json({
    plans,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const parsed = parsePlanInput(await req.json());
  if (!("data" in parsed)) {
    return badRequestResponse(parsed.error);
  }
  const payload = parsed.data!;

  if (!canManageMonitorConfig(currentUser, payload.ownerDeptId)) {
    return NextResponse.json({ message: "无权限创建该牵头部门的专项工作" }, { status: 403 });
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
      const created = await tx.monitorPlan.create({
        data: {
          planCode: payload.planCode,
          planName: payload.planName,
          planType: payload.planType,
          sourceTaskId: payload.sourceTaskId,
          ownerDeptId: department.id,
          ownerDeptName: department.name,
          startDate: payload.startDate,
          endDate: payload.endDate,
          status: payload.status ?? "DRAFT",
          remark: payload.remark,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
      });

      await createMonitorOperateLog(tx, {
        planId: created.id,
        actionType: "CREATE_PLAN",
        operator,
        detailJson: {
          planCode: created.planCode,
          planName: created.planName,
          ownerDeptId: created.ownerDeptId,
          status: created.status,
        },
      });

      return created;
    });

    return NextResponse.json({ plan });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return badRequestResponse("专项编码已存在");
    }

    throw error;
  }
}
