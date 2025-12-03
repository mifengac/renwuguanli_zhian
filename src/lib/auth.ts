import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export async function findUserByBadgeNo(badgeNo: string) {
  return prisma.user.findUnique({
    where: { badgeNo },
  });
}

export async function verifyPassword(
  plain: string,
  passwordHash: string
): Promise<boolean> {
  if (!passwordHash) return false;
  return bcrypt.compare(plain, passwordHash);
}

export function signAuthToken(payload: {
  userId: number;
  badgeNo: string;
  role: string;
  departmentId: number | null;
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: number;
      badgeNo: string;
      role: string;
      departmentId: number | null;
      iat: number;
      exp: number;
    };
  } catch {
    return null;
  }
}
