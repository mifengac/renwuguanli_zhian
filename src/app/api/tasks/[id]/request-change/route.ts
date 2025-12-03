import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

function getAuthUser(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const taskId = Number(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "无效任务ID" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { responsible: true },
  });

  if (!task) {
    return NextResponse.json({ message: "任务不存在" }, { status: 404 });
  }

  if (task.status === "COMPLETED") {
    return NextResponse.json(
      { message: "已完成任务无法退回修改" },
      { status: 400 }
    );
  }

  const isResponsible = task.responsible.some((u) => u.id === auth.userId);
  if (!isResponsible) {
    return NextResponse.json({ message: "只有任务负责人可以执行此操作" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: "REVISION",
        histories: {
          create: {
            operatorId: auth.userId,
            fromStatus: task.status,
            toStatus: "REVISION",
            operation: "REQUEST_CHANGE",
          },
        },
      },
    });

    // 重置所有成员为待处理
    await tx.taskMember.updateMany({
      where: { taskId },
      data: { status: "PENDING" },
    });
  });

  return NextResponse.json({ message: "已退回修改" });
}
