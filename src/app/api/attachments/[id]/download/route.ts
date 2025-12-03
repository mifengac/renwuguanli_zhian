import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import { minioClient, MINIO_BUCKET } from "@/lib/minio";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ message: "无效附件ID" }, { status: 400 });
  }

  const attachment = await prisma.attachment.findUnique({
    where: { id },
  });

  if (!attachment) {
    return NextResponse.json({ message: "附件不存在" }, { status: 404 });
  }

  try {
    const stream = await minioClient.getObject(MINIO_BUCKET, attachment.objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          attachment.filename
        )}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "读取附件出错" },
      { status: 500 }
    );
  }
}

