import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

function getAuthUser(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const keyword = searchParams.get("keyword")?.trim() ?? "";
  const departmentIdRaw = searchParams.get("departmentId");
  const pageRaw = searchParams.get("page");
  const pageSizeRaw = searchParams.get("pageSize");

  const page = Number.isInteger(Number(pageRaw)) && Number(pageRaw) > 0 ? Number(pageRaw) : 1;
  const requestedPageSize =
    Number.isInteger(Number(pageSizeRaw)) && Number(pageSizeRaw) > 0 ? Number(pageSizeRaw) : 10;
  const pageSize = Math.min(requestedPageSize, 100);

  const where: any = {};
  const now = new Date();

  if (
    status === "IN_PROGRESS" ||
    status === "UNDER_REVIEW" ||
    status === "COMPLETED" ||
    status === "REVISION"
  ) {
    where.status = status;
  }

  if (status === "OVERDUE") {
    where.AND = [{ dueDate: { lt: now } }, { status: { not: "COMPLETED" } }];
  }

  if (keyword) {
    where.title = {
      contains: keyword,
      mode: "insensitive",
    };
  }

  if (departmentIdRaw) {
    const departmentId = Number(departmentIdRaw);
    if (Number.isInteger(departmentId) && departmentId > 0) {
      where.departments = {
        some: {
          departmentId,
        },
      };
    }
  }

  const skip = (page - 1) * pageSize;

  const [
    tasks,
    total,
    totalAll,
    totalInProgress,
    totalUnderReview,
    totalRevision,
    totalCompleted,
    totalOverdue,
    deptRows,
  ] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        departments: {
          include: { department: true },
        },
        responsible: true,
        members: {
          include: { user: true },
        },
      },
    }),
    prisma.task.count({ where }),
    prisma.task.count(),
    prisma.task.count({ where: { status: "IN_PROGRESS" } }),
    prisma.task.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.task.count({ where: { status: "REVISION" } }),
    prisma.task.count({ where: { status: "COMPLETED" } }),
    prisma.task.count({
      where: {
        AND: [{ dueDate: { lt: now } }, { status: { not: "COMPLETED" } }],
      },
    }),
    prisma.taskDepartment.findMany({
      select: {
        departmentId: true,
      },
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const deptCounts = deptRows.reduce<Record<number, number>>((acc, row) => {
    acc[row.departmentId] = (acc[row.departmentId] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    tasks,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
    stats: {
      ALL: totalAll,
      IN_PROGRESS: totalInProgress,
      UNDER_REVIEW: totalUnderReview,
      REVISION: totalRevision,
      COMPLETED: totalCompleted,
      OVERDUE: totalOverdue,
    },
    deptCounts,
  });
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const {
    title,
    description,
    departmentIds,
    dueDate,
    responsibleIds,
    memberIds,
  } = body;

  if (!title || !description) {
    return NextResponse.json(
      { message: "标题和内容必填" },
      { status: 400 }
    );
  }

  if (!Array.isArray(responsibleIds) || responsibleIds.length === 0) {
    return NextResponse.json(
      { message: "请选择至少一名负责人" },
      { status: 400 }
    );
  }

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json(
      { message: "请选择至少一名成员" },
      { status: 400 }
    );
  }

  const deptIdsRaw: unknown = departmentIds;
  const deptIds: number[] = Array.isArray(deptIdsRaw)
    ? (deptIdsRaw as any[])
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v))
    : [];

  if (deptIds.length === 0) {
    if (auth.departmentId) {
      deptIds.push(auth.departmentId);
    } else {
      return NextResponse.json(
        { message: "请至少选择一个所属大队" },
        { status: 400 }
      );
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      creatorId: auth.userId,
      dueDate: dueDate ? new Date(dueDate) : null,
      departments: {
        create: deptIds.map((id) => ({ departmentId: id })),
      },
      responsible: responsibleIds
        ? {
            connect: (responsibleIds as number[]).map((id) => ({ id })),
          }
        : undefined,
      members: memberIds
        ? {
            create: (memberIds as number[]).map((id) => ({
              userId: id,
            })),
          }
        : undefined,
      histories: {
        create: {
          operatorId: auth.userId,
          fromStatus: null,
          toStatus: "IN_PROGRESS",
          operation: "CREATE",
        },
      },
    },
  });

  return NextResponse.json({ task });
}
