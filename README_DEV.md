# 易宿 - 开发说明 (scaffold)

本目录包含 Next.js + TypeScript + Tailwind 的基础脚手架，基于项目文档建议的技术栈。

快速开始：

```powershell
# 安装依赖
npm install

# 初始化 Prisma（设置 DATABASE_URL 后）
npx prisma generate
npx prisma db push

# 本地运行
npm run dev
```

下一步建议：
- 配置 `.env.local`（`DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `MAPBOX_TOKEN`, `STRIPE_SECRET_KEY`）
- 实现认证（NextAuth）和初始 API 路由（`/api/hotels`）
- 在 `app` 下继续按功能目录添加页面和组件
