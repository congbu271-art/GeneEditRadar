# GeneEditRadar Netlify Deployment

## 目标

本项目当前按 Netlify 部署规划：

- 前端仍可作为无数据库演示版运行
- 未设置 `DATABASE_URL` 时，不要求登录、不保存历史、不执行持久化订阅推送
- 设置 `DATABASE_URL` 后，Netlify Scheduled Functions 可定时采集最新文献、写入数据库并匹配订阅
- 缺少外部文献源或数据库时，页面继续回退到本地示例数据与规则分析

当未提供 `DATABASE_URL` 时，界面会显示：

`当前为演示版，部分结果基于示例数据和规则分析生成。`

## Netlify 构建设置

仓库根目录已包含 `netlify.toml`：

```toml
[build]
  command = "npm run build"

[build.environment]
  NODE_VERSION = "24"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

Netlify UI 中保持框架识别为 Next.js 即可。构建命令使用：

```bash
npm run build
```

## 定时任务

当前已添加 3 个 Netlify Scheduled Functions：

| 函数 | 频率 | 作用 |
|---|---:|---|
| `collect-literature` | 每 6 小时 | 从 PubMed、Europe PMC、Crossref 采集文献并落库 |
| `collect-rss` | 每小时 | 从重点期刊 RSS / AOP feed 抓取更及时的基因编辑文献 |
| `match-subscriptions` | 每小时 | 将最近入库文献与数据库订阅规则匹配 |
| `send-digest` | 每天 UTC 00:00 | 先记录邮件 digest 去重状态；接入邮件服务后在此发送 |

说明：

- Netlify scheduled functions 只在 published deploy 上运行
- Scheduled functions 执行时间有限，任务应保持小批量、可重复、可恢复
- 若 `DATABASE_URL` 未配置，函数会安全跳过，演示页不受影响

## 环境变量

### 演示版必需项

无必需环境变量。

### 订阅推送必需项

如需启用“最新文献采集 + 订阅匹配 + 推送去重”，需要在 Netlify UI 配置：

- `DATABASE_URL`
  - 建议使用 Neon / Supabase / Railway 等外部 Postgres
  - Netlify Functions 不适合使用本地 SQLite 作为生产持久化

### 可选项

- `LLM_API_KEY`
  - 可选
  - 启用 `/analyze` 的 LLM 增强

- `LLM_BASE_URL`
  - 可选
  - 默认可使用 OpenAI 兼容接口，例如 DeepSeek / OpenAI / 通义 / 智谱 / Kimi

- `LLM_MODEL`
  - 可选

- `OPENAI_API_KEY`
  - 兼容旧变量

- `OPENAI_EXTRACTION_MODEL`
  - 兼容旧变量

- `RESEND_API_KEY` 或 `SENDGRID_API_KEY`
  - 后续接入真实邮件发送时使用

- `LITERATURE_RSS_FEEDS`
  - 可选
  - 用逗号或换行补充更多期刊 RSS URL
  - 默认已包含 Nature Biotechnology、Nature Methods、Nature Genetics AOP feeds

## 文献来源规划

当前后台采集闭环先使用：

- PubMed E-utilities
- Europe PMC
- Crossref
- 重点期刊 RSS / TOC feed

为了实现“基因编辑领域最新文献的及时提取”，下一阶段建议按顺序补充：

1. bioRxiv / medRxiv
2. OpenAlex
3. Semantic Scholar
4. Unpaywall

其中 RSS 和 bioRxiv/medRxiv 最能改善时效性，因为很多论文会先出现在期刊 latest articles 或预印本平台，再进入 PubMed。

## 本地验证

```bash
npm install
npm run lint
npm test
npm run build
npx tsc --noEmit
```

说明：

- 当前项目的 `postinstall` 会自动执行 `prisma generate`
- `npx tsc --noEmit` 建议放在 `npm run build` 之后执行，因为 Next.js 会在构建过程中生成 `.next/types`
- 演示模式下，即使没有生产数据库，页面仍应构建并运行

## 当前限制

- 数据库持久化模型已经补齐，但公开页面仍优先读取 mock/derived data
- `send-digest` 目前只做投递去重标记，尚未接入真实邮件服务
- bioRxiv/medRxiv、OpenAlex、Semantic Scholar 仍是下一阶段数据源
- PI 姓名订阅当前仍是作者名匹配，后续应加入 ORCID、机构和研究方向消歧
