import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MINIO_BUCKET, minioClient } from "@/lib/minio";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token || !verifyAuthToken(token)) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const taskId = Number(params.id);
  if (!taskId) {
    return NextResponse.json({ message: "无效任务ID" }, { status: 400 });
  }

  const attachments = await prisma.attachment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ attachments });
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

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { status: true },
  });

  if (!task) {
    return NextResponse.json({ message: "任务不存在" }, { status: 404 });
  }

  if (task.status === "COMPLETED") {
    return NextResponse.json(
      { message: "已完成任务不允许上传附件" },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ message: "未选择文件" }, { status: 400 });
  }

  const created: { id: number; filename: string }[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const objectKey = `task_${taskId}/${randomUUID()}_${file.name}`;

    await minioClient.putObject(MINIO_BUCKET, objectKey, buffer);

    const record = await prisma.attachment.create({
      data: {
        taskId,
        uploaderId: payload.userId,
        filename: file.name,
        objectKey,
      },
    });

    created.push({ id: record.id, filename: record.filename });
  }

  return NextResponse.json({ message: "上传成功", attachments: created });
}
