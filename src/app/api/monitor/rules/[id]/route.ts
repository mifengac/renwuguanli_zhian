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
    return badRequestResponse("规则 ID 不合法");
  }

  const existing = await prisma.monitorRule.findUnique({
    where: { id },
    include: {
      item: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!existing) {
    return notFoundResponse("提醒规则不存在");
  }

  if (!canManageMonitorConfig(currentUser, existing.item.plan.ownerDeptId)) {
    return NextResponse.json({ message: "无权限修改该提醒规则" }, { status: 403 });
  }

  const parsed = parseRuleInput(await req.json());
  if (!("data" in parsed)) {
    return badRequestResponse(parsed.error);
  }
  const payload = parsed.data!;

  const operator = buildMonitorOperator(currentUser, getRequestIp(req));

  const rule = await prisma.$transaction(async (tx) => {
    const updated = await tx.monitorRule.update({
      where: { id: existing.id },
      data: {
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
        updatedBy: currentUser.id,
      },
    });

    await createMonitorOperateLog(tx, {
      planId: existing.item.planId,
      itemId: existing.itemId,
      actionType: "UPDATE_RULE",
      operator,
      detailJson: {
        ruleId: existing.id,
        before: {
          ruleName: existing.ruleName,
          triggerType: existing.triggerType,
          repeatType: existing.repeatType,
          isEnabled: existing.isEnabled,
        },
        after: {
          ruleName: updated.ruleName,
          triggerType: updated.triggerType,
          repeatType: updated.repeatType,
          isEnabled: updated.isEnabled,
        },
      },
    });

    return updated;
  });

  return NextResponse.json({ rule });
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
    return badRequestResponse("规则 ID 不合法");
  }

  const existing = await prisma.monitorRule.findUnique({
    where: { id },
    include: {
      item: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!existing) {
    return notFoundResponse("提醒规则不存在");
  }

  if (!canManageMonitorConfig(currentUser, existing.item.plan.ownerDeptId)) {
    return NextResponse.json({ message: "无权限变更该提醒规则状态" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const isEnabled = typeof body.isEnabled === "boolean" ? body.isEnabled : null;
  if (isEnabled == null) {
    return badRequestResponse("请指定规则启停状态");
  }

  const operator = buildMonitorOperator(currentUser, getRequestIp(req));

  const rule = await prisma.$transaction(async (tx) => {
    const updated = await tx.monitorRule.update({
      where: { id: existing.id },
      data: {
        isEnabled,
        updatedBy: currentUser.id,
      },
    });

    await createMonitorOperateLog(tx, {
      planId: existing.item.planId,
      itemId: existing.itemId,
      actionType: "CHANGE_RULE_STATUS",
      operator,
      detailJson: {
        ruleId: existing.id,
        beforeEnabled: existing.isEnabled,
        afterEnabled: updated.isEnabled,
      },
    });

    return updated;
  });

  return NextResponse.json({ rule });
}
