import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "xlsx";
  const status = searchParams.get("status");

  if (!["xlsx", "csv"].includes(format)) {
    return NextResponse.json({ message: "不支持的导出格式" }, { status: 400 });
  }

  const where: any = {};

  if (
    status === "IN_PROGRESS" ||
    status === "UNDER_REVIEW" ||
    status === "COMPLETED" ||
    status === "REVISION"
  ) {
    where.status = status;
  }

  if (status === "OVERDUE") {
    where.AND = [
      { dueDate: { lt: new Date() } },
      { status: { not: "COMPLETED" } },
    ];
  }

  const tasks = await prisma.task.findMany({
    where,
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
  });

  const rows = tasks.map((t) => ({
    任务ID: t.id,
    标题: t.title,
    状态:
      t.status === "IN_PROGRESS"
        ? "进行中"
        : t.status === "UNDER_REVIEW"
        ? "审核中"
        : t.status === "COMPLETED"
        ? "已完成"
        : t.status === "REVISION"
        ? "修改中"
        : t.status,
    所属大队: (t.departments || [])
      .map((d) => d.department?.name)
      .filter((n): n is string => !!n)
      .join("、"),
    负责人: t.responsible.map((u) => u.name).join("、"),
    成员: t.members.map((m) => m.user.name).join("、"),
    截止时间: t.dueDate ? t.dueDate.toISOString() : "",
    创建时间: t.createdAt.toISOString(),
  }));

  const fileNameBase =
    status && status !== "ALL" ? `tasks_${status.toLowerCase()}` : "tasks_all";

  if (format === "csv") {
    const header = Object.keys(rows[0] || {}).join(",");
    const lines = rows.map((r) =>
      Object.values(r)
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...lines].join("\r\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileNameBase}.csv"`,
      },
    });
  }

  // 默认导出 Excel
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "任务");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileNameBase}.xlsx"`,
    },
  });
}
