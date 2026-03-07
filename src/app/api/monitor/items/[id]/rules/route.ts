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
import { parseRuleInput } from "@/lib/monitor/input";

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

  const itemId = getId(params);
  if (!itemId) {
    return badRequestResponse("事项 ID 不合法");
  }

  const rules = await prisma.monitorRule.findMany({
    where: { itemId },
    orderBy: [{ id: "asc" }],
  });

  return NextResponse.json({ rules });
}

export async function POST(
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
    },
  });

  if (!item) {
    return notFoundResponse("事项不存在");
  }

  if (!canManageMonitorConfig(currentUser, item.plan.ownerDeptId)) {
    return NextResponse.json({ message: "无权限配置提醒规则" }, { status: 403 });
  }

  const parsed = parseRuleInput(await req.json());
  if (!("data" in parsed)) {
    return badRequestResponse(parsed.error);
  }
  const payload = parsed.data!;

  const operator = buildMonitorOperator(currentUser, getRequestIp(req));

  const rule = await prisma.$transaction(async (tx) => {
    const created = await tx.monitorRule.create({
      data: {
        itemId: item.id,
        ruleName: payload.ruleName,
        triggerType: payload.triggerType,
        offsetDays: payload.offsetDays,
        offsetHours: payload.offsetHours,
        repeatType: payload.repeatType,
        repeatInterval: payload.repeatInterval,
        remindTime: payload.remindTime,
        maxTimes: payload.maxTimes,
        channelSms: payload.channelSms,
        channelSystem: payload.channelSystem,
        stopWhenDone: payload.stopWhenDone,
        contentTpl: payload.contentTpl,
        isEnabled: payload.isEnabled,
        createdBy: currentUser.id,
        updatedBy: currentUser.id,
      },
    });

    await createMonitorOperateLog(tx, {
      planId: item.planId,
      itemId: item.id,
      actionType: "CREATE_RULE",
      operator,
      detailJson: {
        ruleId: created.id,
        ruleName: created.ruleName,
        triggerType: created.triggerType,
        repeatType: created.repeatType,
      },
    });

    return created;
  });

  return NextResponse.json({ rule });
}
