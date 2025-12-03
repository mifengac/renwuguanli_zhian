import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

function ensureCanManageUser(
  actor: { role: string; departmentId: number | null },
  targetDepartmentId: number | null,
  targetRole?: string
) {
  if (actor.role === "USER") {
    throw new Error("NO_PERMISSION");
  }

  if (actor.role === "ADMIN") {
    if (targetDepartmentId == null || actor.departmentId == null) {
      throw new Error("NO_PERMISSION");
    }
    if (targetDepartmentId !== actor.departmentId) {
      throw new Error("NO_PERMISSION");
    }
    if (targetRole === "SUPER_ADMIN") {
      throw new Error("NO_PERMISSION");
    }
  }

  if (actor.role === "SUPER_ADMIN") {
    if (targetRole && !["USER", "ADMIN", "SUPER_ADMIN"].includes(targetRole)) {
      throw new Error("NO_PERMISSION");
    }
  }
}

export async function PUT(
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
    return NextResponse.json({ message: "无效用户ID" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "用户不存在" }, { status: 404 });
  }

  const { name, role, departmentId } = await req.json();

  const nextDepartmentId =
    departmentId !== undefined ? departmentId : existing.departmentId;
  const nextRole = role || existing.role;

  try {
    ensureCanManageUser(
      { role: payload.role, departmentId: payload.departmentId },
      nextDepartmentId,
      nextRole
    );
  } catch {
    return NextResponse.json({ message: "无权限操作该用户" }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      role: nextRole,
      departmentId: nextDepartmentId,
    },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(
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
    return NextResponse.json({ message: "无效用户ID" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "用户不存在" }, { status: 404 });
  }

  // 鉴权：与修改权限一致
  try {
    ensureCanManageUser(
      { role: payload.role, departmentId: payload.departmentId },
      existing.departmentId,
      existing.role
    );
  } catch {
    return NextResponse.json({ message: "无权限删除该用户" }, { status: 403 });
  }

  // 检查关联任务
  // 1. 创建的任务
  const createdCount = await prisma.task.count({ where: { creatorId: id } });
  // 2. 负责的任务 (ManyToMany) - Prisma 的 count 不能直接对隐式多对多做 filter，
  // 但这里我们可以查 User 是否有关联。
  // 简单的做法是：检查 TaskMember 和 TaskResponsible
  
  // TaskMember (显式表)
  const memberCount = await prisma.taskMember.count({ where: { userId: id } });

  // TaskResponsible (隐式表) - 需要反向查
  const responsibleCount = await prisma.task.count({
    where: {
        responsible: {
            some: { id }
        }
    }
  });
  
  const totalTasks = createdCount + memberCount + responsibleCount;
  if (totalTasks > 0) {
    return NextResponse.json({ 
        message: `无法删除：该用户关联了 ${totalTasks} 条任务（作为创建人、负责人或成员），请先删除任务或解除关联。` 
    }, { status: 400 });
  }

  // 检查评论
  const commentCount = await prisma.comment.count({ where: { authorId: id } });
  if (commentCount > 0) {
    return NextResponse.json({
        message: `无法删除：该用户发表了 ${commentCount} 条评论。`
    }, { status: 400 });
  }

  // 检查附件
  const attachmentCount = await prisma.attachment.count({ where: { uploaderId: id } });
  if (attachmentCount > 0) {
     return NextResponse.json({
         message: `无法删除：该用户上传了 ${attachmentCount} 个附件。`
     }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ message: "用户已删除" });
}