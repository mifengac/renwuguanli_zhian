# 治安任务管理系统

一个基于 Next.js 和 TypeScript 开发的治安任务管理系统，用于云浮市公安局治安管理支队的任务分配、跟踪和管理。

## 项目简介

治安任务管理系统是一个现代化的 Web 应用，帮助公安机关高效管理各类治安任务，包括任务创建、分配、执行、审核等全流程管理。系统支持多角色权限管理（普通用户、管理员、超级管理员），并提供完整的任务生命周期跟踪。

## 技术栈

- **前端框架**: Next.js 14 (React 18)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: PostgreSQL
- **ORM**: Prisma
- **认证**: JWT (jsonwebtoken)
- **密码加密**: bcryptjs
- **文件存储**: MinIO
- **导出功能**: xlsx

## 主要功能

### 用户管理
- 用户登录/登出
- 基于角色的权限控制（USER, ADMIN, SUPER_ADMIN）
- 用户档案管理
- 部门管理

### 任务管理
- 任务创建和编辑
- 任务分配给多个责任人
- 任务状态跟踪：进行中、审核中、已完成、待修改
- 任务成员管理：支持多个成员参与
- 任务附件上传和管理（集成 MinIO）

### 审批流程
- 成员提交任务成果
- 审核人审批任务
- 审核意见反馈
- 任务状态历史记录

### 其他功能
- 任务评论系统
- 任务数据导出（Excel 格式）
- 响应式设计，支持移动端访问

## 项目结构

```
zhian-renwuguanli/
├── prisma/                          # Prisma 配置
│   ├── schema.prisma               # 数据库模型定义
│   └── ...
├── public/                         # 静态资源
├── src/
│   ├── app/                        # Next.js 13+ App Router
│   │   ├── (dashboard)/            # 登录后页面
│   │   │   ├── layout.tsx          # 仪表盘布局
│   │   │   ├── tasks/              # 任务管理页面
│   │   │   │   ├── page.tsx        # 任务列表
│   │   │   │   └── [id]/           # 任务详情
│   │   │   └── users/              # 用户管理
│   │   ├── api/                    # API 路由
│   │   │   ├── auth/               # 认证相关
│   │   │   ├── tasks/              # 任务管理 API
│   │   │   ├── users/              # 用户管理 API
│   │   │   └── ...
│   │   ├── layout.tsx              # 根布局
│   │   ├── page.tsx                # 首页
│   │   └── login/                  # 登录页面
│   ├── components/                 # 公共组件
│   ├── generated/prisma/          # Prisma 生成的客户端
│   ├── lib/                       # 工具库
│   │   ├── auth.ts               # 认证工具
│   │   ├── minio.ts              # MinIO 配置
│   │   └── prisma.ts             # Prisma 客户端
│   └── middleware.ts             # 中间件
├── .env                          # 环境变量
├── next.config.mjs               # Next.js 配置
├── package.json                  # 依赖管理
├── tailwind.config.js           # Tailwind 配置
├── tsconfig.json                # TypeScript 配置
└── ...
```

## 快速开始

### 环境要求

- Node.js >= 16
- PostgreSQL
- MinIO (可选，用于文件存储)

### 安装步骤

1. 克隆项目
```bash
git clone https://github.com/mifengac/renwuguanli_zhian.git
cd renwuguanli_zhian
```

2. 安装依赖
```bash
npm ci
```

3. 配置环境变量
```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件：
```env
# 数据库连接（注意：密码里有特殊字符（如 @）时需要 URL 编码，例如 @ -> %40）
# 示例：docker-compose-offline.yml 默认密码 Asd@199312 -> Asd%40199312
DATABASE_URL="postgresql://postgres:Asd%40199312@localhost:5432/postgres?schema=public"

# JWT 密钥
JWT_SECRET=somesupersecretkeyforjwt

# MinIO 配置（可选，使用 docker-compose-offline.yml 启动 minio 时）
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=zhian_fujian
MINIO_USE_SSL=false

# Cookie secure（本地 http 访问建议 false）
COOKIE_SECU=false
```

4. 初始化数据库
```bash
# 生成 Prisma 客户端（也会在 npm install/ci 后自动生成）
npm run prisma:generate

# 初始化表结构（二选一）
# 方式 A：通过 Prisma 同步 schema（推荐本地开发）
npx prisma db push
# 方式 B：直接执行 SQL（prisma/init.sql）
```

5. 创建超级管理员（如果未运行 seed）
```bash
# 访问 API 创建超级管理员
curl -X POST http://localhost:3000/api/users/seed-super-admin \
  -H "Content-Type: application/json" \
  -d '{"badgeNo":"270378","password":"admin123"}'

# 或者用 GET（方便浏览器直接访问）
# http://localhost:3000/api/users/seed-super-admin
```

### 开发模式

```bash
npm run dev
```

应用将在 [http://localhost:3000](http://localhost:3000) 运行

### 生产构建

```bash
npm run build
npm start
```

## 默认账户

**超级管理员账户**:
- 警号: `270378`
- 密码: `admin123` (首次登陆后建议修改)

注意：此账户仅在开发环境中创建，生产环境请使用适当的部署流程。

## API 文档

### 认证相关

#### POST /api/auth/login
登录系统
- 请求体: `{ badgeNo: string, password: string }`
- 响应: JWT token

#### POST /api/auth/logout
登出系统
- 清除 cookie

#### GET /api/auth/me
获取当前登录用户信息
- 需要认证

### 任务管理

#### GET /api/tasks
获取任务列表（分页）
- 查询参数: page, pageSize, status
- 需要认证

#### POST /api/tasks
创建新任务
- 请求体: 任务数据
- 需要认证和相应权限

#### GET /api/tasks/:id
获取任务详情
- 需要认证且有权限

#### PUT /api/tasks/:id
更新任务
- 需要认证和相应权限

#### DELETE /api/tasks/:id
删除任务
- 需要认证和相应权限

#### POST /api/tasks/:id/approve
审批通过任务
- 任务负责人或 SUPER_ADMIN

#### POST /api/tasks/:id/request-change
请求修改任务
- 仅任务负责人

#### POST /api/tasks/:id/member-submit
成员提交任务
- 任务成员可用

#### POST /api/tasks/:id/comments
添加评论
- 需要认证且有权限

#### POST /api/tasks/:id/attachments
上传附件
- 需要认证且有权限

#### GET /api/attachments/:id/download
下载附件
- 需要认证且有权限

#### GET /api/tasks/export
导出任务数据
- 返回 Excel 文件

### 用户管理

#### GET /api/users
获取用户列表
- 需要认证

#### POST /api/users
创建用户
- 需要 ADMIN 或 SUPER_ADMIN 权限

#### GET /api/user-management/users
高级用户查询（分页、搜索）
- 需要 ADMIN 或 SUPER_ADMIN 权限

#### PUT /api/user-management/users/:id
更新用户信息
- 需要 ADMIN 或 SUPER_ADMIN 权限

#### DELETE /api/user-management/users/:id
删除用户
- 需要 SUPER_ADMIN 权限

### 部门管理

#### GET /api/departments
获取部门列表
- 需要认证

#### POST /api/departments
创建部门
- 需要 ADMIN 或 SUPER_ADMIN 权限

## 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量
4. 部署

注意：Vercel 函数有执行时间和资源限制，考虑使用数据库托管服务（如 Supabase、Neon）。

### Docker 部署

本项目支持使用 Docker Compose 进行快速部署。

1. **构建并启动服务**

```bash
docker-compose up -d --build
```

此命令将启动以下服务：
- `web`: Next.js 应用服务 (端口 3000)
- `postgres`: PostgreSQL 数据库 (端口 5432)
- `minio`: MinIO 对象存储服务 (端口 9000, 控制台端口 9001)

2. **查看日志**

```bash
docker-compose logs -f
```

3. **停止服务**

```bash
docker-compose down
```

**注意**: 
- 首次启动时，数据库会自动初始化。
- 请确保 `.env` 文件中的配置与 `docker-compose.yml` 中的环境变量保持一致，或者直接使用 `docker-compose.yml` 中定义的默认值进行测试。
- 如果需要离线部署，可以使用 `docker-compose-offline.yml`。

## 本地开发（只启动 Postgres + MinIO）

```bash
docker compose -f docker-compose-offline.yml up -d db minio
```

然后按 `.env.example` 配好本地的 `DATABASE_URL`（如果密码里包含 `@` 之类特殊字符，要做 URL 编码，例如 `@ -> %40`）。

## 开发规范

### 代码风格
- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 规范
- 使用语义化命名

### Git 规范
- 使用有意义的 commit 信息
- 分支命名：feature/xxx, bugfix/xxx, hotfix/xxx
- 主分支：main

## 许可证

ISC License

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。

## 致谢

- 云浮市公安局治安管理支队
- 项目开发团队
