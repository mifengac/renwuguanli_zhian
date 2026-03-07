import { randomUUID } from "crypto";
import { Readable } from "stream";
import { MINIO_BUCKET, ensureBucketExists, minioClient } from "@/lib/minio";
import { MonitorAttachmentRef } from "@/lib/monitor/utils";

export async function uploadMonitorFiles(
  files: File[],
  folder = "monitor"
): Promise<MonitorAttachmentRef[]> {
  await ensureBucketExists();

  const created: MonitorAttachmentRef[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const objectKey = `${folder}/${randomUUID()}_${file.name}`;

    await minioClient.putObject(MINIO_BUCKET, objectKey, buffer, file.size, {
      "Content-Type": file.type || "application/octet-stream",
    });

    created.push({
      fileName: file.name,
      objectKey,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });
  }

  return created;
}

export async function getMonitorFileStream(objectKey: string): Promise<Readable> {
  return minioClient.getObject(MINIO_BUCKET, objectKey);
}
