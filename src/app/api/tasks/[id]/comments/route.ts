import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const taskId = Number(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "无效任务ID" }, { status: 400 });
  }

  const comments = await prisma.comment.findMany({
    where: { taskId },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const taskId = Number(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "无效任务ID" }, { status: 400 });
  }

  const { content } = await req.json();
  if (!content || !content.trim()) {
    return NextResponse.json(
      { message: "评论内容不能为空" },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      taskId,
      authorId: payload.userId,
      content: content.trim(),
    },
    include: { author: true },
  });

  return NextResponse.json({ comment });
}

