import { NextRequest, NextResponse } from "next/server";
import { getMonitorFileStream } from "@/lib/monitor/file-storage";
import { getCurrentUser, unauthorizedResponse } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(req.url);
  const objectKey = searchParams.get("key")?.trim();
  const fileName = searchParams.get("name")?.trim() || "monitor-attachment";

  if (!objectKey) {
    return NextResponse.json({ message: "附件标识不能为空" }, { status: 400 });
  }

  try {
    const stream = await getMonitorFileStream(objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch {
    return NextResponse.json({ message: "读取附件失败" }, { status: 500 });
  }
}
