import { NextRequest, NextResponse } from "next/server";
import { authorizeMonitorJobRequest, canTriggerMonitorJobs } from "@/lib/monitor/access";
import { buildMonitorOperator } from "@/lib/monitor/audit";
import { generateMonitorInstances } from "@/lib/monitor/instance-generator";
import {
  retryFailedMonitorNotifications,
  scanMonitorReminders,
} from "@/lib/monitor/reminder-service";
import { getRequestIp } from "@/lib/server-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  const { actor, byToken } = await authorizeMonitorJobRequest(req);

  if (!byToken && !canTriggerMonitorJobs(actor)) {
    return NextResponse.json({ message: "无权限触发监测任务" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const planId =
    body && Number.isInteger(Number(body.planId)) && Number(body.planId) > 0
      ? Number(body.planId)
      : undefined;
  const operator = buildMonitorOperator(actor, getRequestIp(req));
  const action = params.action?.trim();

  if (action === "generate") {
    const result = await generateMonitorInstances({
      actor: operator,
      planId,
    });
    return NextResponse.json({ result });
  }

  if (action === "scan") {
    const result = await scanMonitorReminders({
      actor: operator,
      planId,
    });
    return NextResponse.json({ result });
  }

  if (action === "retry") {
    const result = await retryFailedMonitorNotifications({
      actor: operator,
    });
    return NextResponse.json({ result });
  }

  return NextResponse.json({ message: "不支持的任务动作" }, { status: 400 });
}
