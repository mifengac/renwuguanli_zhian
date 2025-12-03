import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const auth = verifyAuthToken(token);
  if (!auth) return NextResponse.json({ message: "未登录" }, { status: 401 });

  try {
    const body = await req.json();
    const rawTasks = body.tasks; // Array of { title, description, dueDate, departmentNames, responsibleNames, memberNames }

    if (!Array.isArray(rawTasks)) {
      return NextResponse.json({ message: "格式错误" }, { status: 400 });
    }

    // 预加载所有部门和用户以减少数据库查询
    const allDepts = await prisma.department.findMany();
    const allUsers = await prisma.user.findMany();

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawTasks.length; i++) {
      const t = rawTasks[i];
      const lineNum = i + 1;

      if (!t.title || !t.description) {
        errors.push(`第 ${lineNum} 行：标题和内容不能为空`);
        continue;
      }

      // 解析部门
      // departmentNames: "信息大队, 治安大队" (逗号分隔)
      const deptNamesStr = String(t.departmentNames || "").replace(/，/g, ",");
      const deptNames = deptNamesStr.split(",").map(s => s.trim()).filter(Boolean);
      
      const deptIds: number[] = [];
      for (const dn of deptNames) {
        const d = allDepts.find(x => x.name === dn || x.name.includes(dn)); // 简单的包含匹配
        if (d) deptIds.push(d.id);
      }

      if (deptIds.length === 0) {
         // 如果没填部门，且当前用户有部门，默认使用当前用户的部门
         if (auth.departmentId) deptIds.push(auth.departmentId);
         else {
            errors.push(`第 ${lineNum} 行：未找到匹配的部门`);
            continue;
         }
      }

      // 解析负责人
      const respNamesStr = String(t.responsibleNames || "").replace(/，/g, ",");
      const respNames = respNamesStr.split(",").map(s => s.trim()).filter(Boolean);
      const respIds: number[] = [];

      for (const rn of respNames) {
        // 尝试匹配警号或姓名
        const u = allUsers.find(x => x.badgeNo === rn || x.name === rn);
        if (u) respIds.push(u.id);
      }

      if (respIds.length === 0) {
        errors.push(`第 ${lineNum} 行：未找到匹配的负责人`);
        continue;
      }

      // 解析成员
      const memNamesStr = String(t.memberNames || "").replace(/，/g, ",");
      const memNames = memNamesStr.split(",").map(s => s.trim()).filter(Boolean);
      const memIds: number[] = [];

      for (const mn of memNames) {
        const u = allUsers.find(x => x.badgeNo === mn || x.name === mn);
        if (u) memIds.push(u.id);
      }
      
      if (memIds.length === 0) {
         errors.push(`第 ${lineNum} 行：未找到匹配的成员`);
         continue;
      }

      // 创建任务
      try {
        await prisma.task.create({
            data: {
                title: t.title,
                description: t.description,
                dueDate: t.dueDate ? new Date(t.dueDate) : null,
                creatorId: auth.userId,
                departments: {
                    create: [...new Set(deptIds)].map(id => ({ departmentId: id }))
                },
                responsible: {
                    connect: [...new Set(respIds)].map(id => ({ id }))
                },
                members: {
                    create: [...new Set(memIds)].map(id => ({ userId: id }))
                },
                histories: {
                    create: {
                        operatorId: auth.userId,
                        fromStatus: null,
                        toStatus: "IN_PROGRESS",
                        operation: "IMPORT",
                        remark: "批量导入"
                    }
                }
            }
        });
        successCount++;
      } catch (e) {
        console.error(e);
        errors.push(`第 ${lineNum} 行：数据库写入失败`);
      }
    }

    return NextResponse.json({ success: successCount, errors });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "服务器错误" }, { status: 500 });
  }
}
