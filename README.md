# FDEC 2026 · 圆桌选座

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![GSAP](https://img.shields.io/badge/GSAP-3.15-88CE02?style=flat-square&logo=greensock&logoColor=white)](https://gsap.com/)
[![Deploy](https://img.shields.io/github/actions/workflow/status/LeoLee0812/fdec2026/deploy.yml?style=flat-square&label=deploy)](../../actions)

FDEC 2026 前沿部署工程师大会（2026-08-22 · 杭州湖畔良仓）的**圆桌话题分组与选座系统**。
20 张圆桌 × 10 人 = 200 座，参会者用报名时的姓名 + 手机号登录，在会场平面图上挑一张桌、挑一个位置。

线上地址：<https://hangzhou0822.openfde.online>

## 它长什么样

- **封面**：海报同款黑底霓虹，GSAP 打字机 + 鼠标视差
- **全场平面图**：SVG 画的 20 桌俯视图，舞台在上、签到处在下，桌子从场地中心波纹弹入
- **单桌详情**：每个座位一个小人，坐在椅子上敲笔记本（屏幕上有滚动的代码行），空位是虚线圈
- **移动端**：默认列表视图，随时切平面图；所有动效遵循 `prefers-reduced-motion`

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + lucide |
| 动效 | GSAP 3.15（TextPlugin / DrawSVG / Flip / CustomBounce / Physics2D） |
| 后端 | Hono（业务逻辑在 `shared/routes.ts`，与运行平台解耦） |
| 数据 | Cloudflare D1（`fdec2026`）/ Neon Postgres，由适配器抹平 |
| 部署 | Cloudflare Workers（GitHub Actions）+ Vercel（Git 自动部署），两套并行 |

### 一份逻辑两处跑

```
shared/routes.ts   业务路由（只依赖 shared/db.ts 的 Db 接口）
  ├── worker/index.ts        D1 适配器  → Cloudflare Workers
  └── api/[[...route]].ts    Neon 适配器 → Vercel Functions
```

约定：SQL 一律写 `?` 占位符（Postgres 适配器负责转 `$1`）；要自增主键就用
`INSERT ... RETURNING id`（两种数据库都支持）；可能撞关键字的标识符
（`audit_log."at"`、`config."key"`）一律加双引号。

## 登录与防爬

- **白名单直通**：报名表导入的姓名 + 手机号，姓名对不上直接拒（防止拿别人手机号冒名）
- **邀请码兜底**：不在名单里的临时来宾凭邀请码入场，支持一人一码和带配额/有效期的现场万能码
- **手机号不落明文**：库里只存 `HMAC-SHA256(手机号)` 和后四位
- 登录态是 HMAC 签名 token，写在 httpOnly Cookie 里
- `/api/state` 强制鉴权，未登录一个字段都拿不到
- Turnstile 人机校验（配了 secret 才启用）+ 同 IP 登录失败 8 次/分钟冷却 + 表单蜜罐字段
- 一人一座由 `seats` 表的唯一索引兜底，换桌是「删旧 + 插新」放在同一批事务里

## 本地开发

```bash
pnpm install
pnpm db:init        # 初始化本地 D1：建表 + 灌 20 个话题
pnpm dev:api        # 终端 A：Worker 跑在 8787
pnpm dev            # 终端 B：Vite 跑在 5173，/api 自动代理到 8787
```

本地需要一个 `.dev.vars`：

```
AUTH_SECRET=随便一串长的
PHONE_SALT=另一串长的
```

## 导入报名名单

```bash
PHONE_SALT=<与线上 secret 一致> node scripts/import-attendees.mjs 报名表.csv > db/attendees.sql
npx wrangler d1 execute fdec2026 --remote --file=db/attendees.sql
```

CSV 需要「姓名」「手机号」两列，可选「公司」「职位」。**PHONE_SALT 必须和线上完全一致**，否则谁都登录不上。

生成邀请码：

```bash
node scripts/gen-invites.mjs 30                                  # 30 个一人一码
node scripts/gen-invites.mjs 1 --universal --quota=20 --hours=6  # 1 个限量万能码
```

## 部署

### Cloudflare Workers（hangzhou0822.openfde.online）

push 到 `main` 由 GitHub Actions 自动部署。首次需要：

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put PHONE_SALT
npx wrangler d1 execute fdec2026 --remote --file=db/schema.sql
npx wrangler d1 execute fdec2026 --remote --file=db/seed.sql
```

### Vercel（hangzhou0822.openfde.net）

Vercel 项目连上本仓库后 push 即自动部署。首次需要：

1. 在团队里开一个 Neon Postgres（Vercel → Storage / Marketplace），连到本项目，
   会自动注入 `DATABASE_URL`
2. 建表灌种子：

   ```bash
   vercel env pull .env.local          # 拿到 DATABASE_URL
   set -a && . ./.env.local && set +a
   pnpm db:init:pg                     # = schema.pg.sql + seed.sql
   ```

3. 配环境变量（Production + Preview）：`AUTH_SECRET`、`PHONE_SALT`、`EVENT_NAME`，
   可选 `TURNSTILE_SECRET` / `TURNSTILE_SITEKEY`
4. 加自定义域 `hangzhou0822.openfde.net`，按 Vercel 给的值去域名 DNS 后台加 CNAME

> 两边的数据库是各自独立的：同一个人在 online 和 net 上会各占一个座位，
> 正式对外只宣传一个入口。名单导入 Postgres 时给脚本加 `--pg`：
> `PHONE_SALT=... node scripts/import-attendees.mjs 报名表.csv --pg > db/attendees.pg.sql`

## 踩过的坑

- **GSAP 的 `from` 在 React 里会把元素留在初始态**（`opacity:0` 再也不动），全项目一律用 `fromTo` 把终点写死；同时不要套 `StrictMode`，双挂载会让动画卡住
- **SVG 元素上不能对带 `transform` 属性的 `<g>` 做 scale 动画**：GSAP 会重写整个矩阵，把定位一起吃掉，小人全飞到画布左上角。正确做法是「外层 `<g>` 负责 translate/rotate，内层 `<g>` 只做动画」
- **`clearProps: 'transform'` 会连原生 transform 属性一起清掉**，只能用在本来就没有 transform 的元素上
- shadcn CLI 读的是根 `tsconfig.json` 的 `paths`，缺了会把组件写进字面量的 `@/` 目录
