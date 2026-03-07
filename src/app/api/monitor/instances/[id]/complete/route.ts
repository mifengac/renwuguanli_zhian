import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequestResponse,
  getCurrentUser,
  getRequestIp,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/server-auth";
import { canCompleteMonitorInstance } from "@/lib/monitor/access";
import { buildMonitorOperator } from "@/lib/monitor/audit";
import { completeMonitorInstance } from "@/lib/monitor/instance-actions";
import { normalizeAttachments, parseJsonObject } from "@/lib/monitor/utils";

function getId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const id = getId(params);
  if (!id) {
    return badRequestResponse("实例 ID 不合法");
  }

  const instance = await prisma.monitorInstance.findUnique({
    where: { id },
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
    return notFoundResponse("实例不存在");
  }

  const ownerUserIds = instance.item.itemUsers
    .filter((entry) => entry.roleType === "OWNER" && entry.isEnabled)
    .map((entry) => entry.userId);

  if (!canCompleteMonitorInstance(currentUser, instance.plan.ownerDeptId, ownerUserIds)) {
    return NextResponse.json({ message: "无权限完成该实例" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const payload = parseJsonObject(body);
  const attachments = normalizeAttachments(payload?.attachments ?? []);
  const remark =
    typeof payload?.remark === "string" ? payload.remark.trim() : "";

  try {
    const updated = await completeMonitorInstance({
      instanceId: instance.id,
      operator: buildMonitorOperator(currentUser, getRequestIp(req)),
      remark,
      attachments,
    });

    return NextResponse.json({ instance: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "完成实例失败";

    if (message === "INSTANCE_NOT_FOUND") {
      return notFoundResponse("实例不存在");
    }
    if (message === "INSTANCE_ALREADY_COMPLETED") {
      return badRequestResponse("实例已完成，无需重复提交");
    }
    if (message === "REMARK_REQUIRED") {
      return badRequestResponse("该事项要求填写完成备注");
    }
    if (message === "ATTACHMENT_REQUIRED") {
      return badRequestResponse("该事项要求上传附件");
    }

    throw error;
  }
}
