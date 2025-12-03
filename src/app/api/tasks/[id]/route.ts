import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

function getAuthUser(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}

// 获取任务详情
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ message: "无效任务ID" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      departments: {
        include: { department: true },
      },
      responsible: true,
      members: {
        include: { user: true },
      },
      attachments: true,
      comments: {
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
      histories: {
        include: { operator: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ message: "任务不存在" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

// 更新任务（责任人、管理员、超级管理员可修改）
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ message: "无效任务ID" }, { status: 400 });
  }

  const existing = await prisma.task.findUnique({
    where: { id },
    include: { responsible: true },
  });

  if (!existing) {
    return NextResponse.json({ message: "任务不存在" }, { status: 404 });
  }

  const isResponsible = existing.responsible.some(
    (u) => u.id === auth.userId
  );

  const isAdminLike =
    auth.role === "ADMIN" || auth.role === "SUPER_ADMIN";

  if (!isResponsible && !isAdminLike) {
    return NextResponse.json({ message: "无权限修改任务" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    description,
    dueDate,
    responsibleIds,
    memberIds,
  } = body;

  if (!title || !description) {
    return NextResponse.json(
      { message: "标题和内容必填" },
      { status: 400 }
    );
  }

  const data: any = {
    title,
    description,
  };

  if (dueDate) {
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) {
      return NextResponse.json(
        { message: "截止日期格式不正确" },
        { status: 400 }
      );
    }
    const now = new Date();
    if (due.getTime() <= now.getTime()) {
      return NextResponse.json(
        { message: "截止日期不能小于当前时间" },
        { status: 400 }
      );
    }
    data.dueDate = due;
  } else {
    data.dueDate = null;
  }

  if (Array.isArray(responsibleIds) && responsibleIds.length > 0) {
    data.responsible = {
      set: responsibleIds.map((id: number) => ({ id })),
    };
  }

  if (Array.isArray(memberIds)) {
    // 先清空原有成员，再重建
    await prisma.taskMember.deleteMany({ where: { taskId: id } });
    data.members = {
      create: memberIds.map((uid: number) => ({
        userId: uid,
      })),
    };
  }

  const updated = await prisma.task.update({
    where: { id },
    data,
  });

  return NextResponse.json({ task: updated });
}

// 删除任务（仅超级管理员）
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ message: "无效任务ID" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      departments: true,
    },
  });

  if (!task) {
    return NextResponse.json({ message: "任务不存在" }, { status: 404 });
  }

  if (auth.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { message: "仅超级管理员可以删除任务" },
      { status: 403 }
    );
  }

  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ message: "任务已删除" });
}
