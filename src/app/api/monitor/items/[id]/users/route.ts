import { NextRequest, NextResponse } from "next/server";
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
import { parseItemUsersInput } from "@/lib/monitor/input";

function getId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const itemId = getId(params);
  if (!itemId) {
    return badRequestResponse("事项 ID 不合法");
  }

  const item = await prisma.monitorItem.findUnique({
    where: { id: itemId },
    include: {
      plan: true,
      itemUsers: true,
    },
  });

  if (!item) {
    return notFoundResponse("事项不存在");
  }

  if (!canManageMonitorConfig(currentUser, item.plan.ownerDeptId)) {
    return NextResponse.json({ message: "无权限配置事项人员" }, { status: 403 });
  }

  const parsed = parseItemUsersInput(await req.json());
  if (!("data" in parsed)) {
    return badRequestResponse(parsed.error);
  }
  const payload = parsed.data!;

  const userIds = [...new Set(payload.map((entry) => entry.userId))];
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    include: {
      department: true,
    },
  });

  if (users.length !== userIds.length) {
    return badRequestResponse("存在无效的用户配置");
  }

  const userMap = new Map(users.map((user) => [user.id, user]));
  const operator = buildMonitorOperator(currentUser, getRequestIp(req));

  for (const roleType of ["OWNER", "REMIND", "CC"] as const) {
    const primaryCount = payload.filter(
      (entry) => entry.roleType === roleType && entry.isPrimary
    ).length;
    if (primaryCount > 1) {
      return badRequestResponse(`${roleType} 角色只能配置一个主责任人`);
    }
  }

  const itemUsers = await prisma.$transaction(async (tx) => {
    await tx.monitorItemUser.deleteMany({
      where: { itemId: item.id },
    });

    const created = [];
    for (const entry of payload) {
      const user = userMap.get(entry.userId);
      if (!user) continue;

      created.push(
        await tx.monitorItemUser.create({
          data: {
            itemId: item.id,
            userId: user.id,
            userName: user.name,
            deptId: user.departmentId,
            deptName: user.department?.name ?? null,
            mobile: entry.mobile,
            roleType: entry.roleType,
            isPrimary: entry.isPrimary,
            isEnabled: entry.isEnabled,
          },
        })
      );
    }

    await createMonitorOperateLog(tx, {
      planId: item.planId,
      itemId: item.id,
      actionType: "CONFIG_ITEM_USER",
      operator,
      detailJson: {
        previousCount: item.itemUsers.length,
        currentCount: created.length,
        users: created.map((entry) => ({
          userId: entry.userId,
          userName: entry.userName,
          roleType: entry.roleType,
          isPrimary: entry.isPrimary,
        })),
      },
    });

    return created;
  });

  return NextResponse.json({ itemUsers });
}
