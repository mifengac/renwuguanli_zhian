import { Client } from "minio";

const endpoint = process.env.MINIO_ENDPOINT ?? "http://localhost:9000";
const accessKey = process.env.MINIO_ACCESS_KEY ?? "minioadmin";
const secretKey = process.env.MINIO_SECRET_KEY ?? "minioadmin";
const bucketName = process.env.MINIO_BUCKET ?? "zhian_fujian";

const url = new URL(endpoint);

export const minioClient = new Client({
  endPoint: url.hostname,
  port: Number(url.port || 9000),
  useSSL: url.protocol === "https:",
  accessKey,
  secretKey,
});

export const MINIO_BUCKET = bucketName;

export async function ensureBucketExists() {
  const exists = await minioClient.bucketExists(bucketName).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(bucketName, "");
  }
}

