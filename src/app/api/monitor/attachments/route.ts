import { NextRequest, NextResponse } from "next/server";
import { uploadMonitorFiles } from "@/lib/monitor/file-storage";
import { getCurrentUser, unauthorizedResponse } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const formData = await req.formData();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ message: "请选择待上传的附件" }, { status: 400 });
  }

  const folder =
    typeof formData.get("folder") === "string" && String(formData.get("folder")).trim()
      ? String(formData.get("folder")).trim()
      : "monitor";

  const attachments = await uploadMonitorFiles(files, folder);

  return NextResponse.json({ attachments });
}
