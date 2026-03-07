import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequestResponse,
  getCurrentUser,
  unauthorizedResponse,
} from "@/lib/server-auth";

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

  const id = getId(params);
  if (!id) {
    return badRequestResponse("实例 ID 不合法");
  }

  const logs = await prisma.monitorNotifyLog.findMany({
    where: {
      instanceId: id,
    },
    include: {
      rule: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ logs });
}
