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

  const member = await prisma.taskMember.findFirst({
    where: {
      taskId,
      userId: auth.userId,
    },
  });

  if (!member) {
    return NextResponse.json({ message: "您不是该任务成员" }, { status: 403 });
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { status: true },
  });

  if (!task) {
    return NextResponse.json({ message: "任务不存在" }, { status: 404 });
  }

  if (task.status === "COMPLETED") {
    return NextResponse.json(
      { message: "已完成任务不能再提交" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskMember.update({
      where: { id: member.id },
      data: { status: "SUBMITTED" },
    });

    const allMembers = await tx.taskMember.findMany({
      where: { taskId },
    });

    const allSubmitted = allMembers.length > 0 &&
      allMembers.every((m) => m.status === "SUBMITTED");

    if (allSubmitted) {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: "UNDER_REVIEW",
          histories: {
            create: {
              operatorId: auth.userId,
              fromStatus: "IN_PROGRESS",
              toStatus: "UNDER_REVIEW",
              operation: "MEMBERS_SUBMITTED",
            },
          },
        },
      });
    }
  });

  return NextResponse.json({ message: "提交成功" });
}
