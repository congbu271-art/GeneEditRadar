# GeneEditRadar Deployment

## 目标

本项目当前支持以“演示版”方式部署到 Vercel。

- 不要求登录
- 不保存用户分析历史
- 不要求提供 `DATABASE_URL`
- 缺少外部文献源或数据库时，自动回退到本地示例数据与规则分析

当未提供 `DATABASE_URL` 时，界面会显示：

`当前为演示版，部分结果基于示例数据和规则分析生成。`

## 本地构建与验证

1. 安装依赖：

```bash
npm install
```

2. 启动本地开发环境：

```bash
npm run dev
```

3. 运行校验：

```bash
npm run lint
npm test
npm run build
npx tsc --noEmit
```

说明：

- 当前项目的 `postinstall` 会自动执行 `prisma generate`
- `npx tsc --noEmit` 建议放在 `npm run build` 之后执行，因为 Next.js 会在构建过程中生成 `.next/types`
- 演示模式下，即使没有 `DATABASE_URL`，应用仍可构建并运行

## 上传到 GitHub

如果当前目录还没有 Git 仓库：

```bash
git init
git add .
git commit -m "Prepare GeneEditRadar for Vercel demo deployment"
```

如果你已经有 GitHub 仓库：

```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

如果仓库已存在远程地址，直接提交并推送即可：

```bash
git add .
git commit -m "Prepare demo deployment"
git push
```

## Vercel 部署步骤

1. 登录 Vercel
2. 点击 `Add New...` → `Project`
3. 选择你的 GitHub 仓库 `GeneEditRadar`
4. 保持 Framework Preset 为 `Next.js`
5. 安装命令保持默认 `npm install`
6. 构建命令保持默认 `next build`
7. Output Directory 保持默认，不需要手动修改
8. 点击 `Deploy`

部署完成后，Vercel 会自动构建并生成公开演示地址。

## 环境变量说明

### 演示版必需项

无必需环境变量。

### 可选项

- `OPENAI_API_KEY`
  - 可选
  - 仅用于增强字段提取
  - 未提供时，系统继续使用规则提取与示例数据，不影响演示

- `OPENAI_EXTRACTION_MODEL`
  - 可选
  - 默认值可保持为 `gpt-4o-mini`

- `DATABASE_URL`
  - 演示版可不提供
  - 当前公开演示不依赖数据库运行
  - 即使未设置，`/analyze` 也会继续使用本地示例文献和规则分析

## 演示模式限制

- 当前结果可能来自本地示例论文，而不是实时数据库记录
- 外部文献源不可用时，会自动回退到示例数据
- 不保存用户分析历史
- 不提供用户登录
- Prisma schema 仍保留在项目中，但演示部署不依赖数据库读写
- `journalSuggestions`、`evaluation`、`paperStrategySummary` 等结果仍以规则和启发式为主，不应视为正式投稿保证

## 演示时建议

- 优先展示 `/analyze`
- 可直接测试：

```text
prime editing rice
```

或：

```text
Multiplex gene editing enables the multibiofortification of essential vitamins and other health-promoting phytonutrients in tomato
```

第二个示例更适合演示 paper-mode 的：

- 文献策略解读
- 最优衍生方向
- 衍生选题
- 可发表性评估
