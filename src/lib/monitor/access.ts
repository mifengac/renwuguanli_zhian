import { NextRequest } from "next/server";
import {
  CurrentUser,
  getCurrentUser,
  isAdminLike,
  isSuperAdmin,
} from "@/lib/server-auth";

export function canManageMonitorConfig(
  user: CurrentUser | null,
  ownerDeptId: number
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (!isAdminLike(user)) return false;
  return user.departmentId === ownerDeptId;
}

export function canTriggerMonitorJobs(user: CurrentUser | null): boolean {
  return isAdminLike(user);
}

export function canCompleteMonitorInstance(
  user: CurrentUser | null,
  ownerDeptId: number,
  ownerUserIds: number[]
): boolean {
  if (!user) return false;
  if (ownerUserIds.includes(user.id)) return true;
  return canManageMonitorConfig(user, ownerDeptId);
}

export async function authorizeMonitorJobRequest(req: NextRequest): Promise<{
  actor: CurrentUser | null;
  byToken: boolean;
}> {
  const jobToken = process.env.MONITOR_JOB_TOKEN?.trim();
  const requestToken = req.headers.get("x-monitor-job-token")?.trim();

  if (jobToken && requestToken && requestToken === jobToken) {
    return { actor: null, byToken: true };
  }

  const actor = await getCurrentUser(req);
  return {
    actor,
    byToken: false,
  };
}
