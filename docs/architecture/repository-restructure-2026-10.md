# FlowCredit Repository Architecture — 梳理与重构记录

> 2026-10-22 · takeover/week-1-hygiene 分支 · 本文档是文件架构与框架梳理的权威记录，
> 也是下一个框架里程碑（kernel/store 拆分）的执行蓝图。

---

## 1. 分层地图（重构后）

```
┌────────────────────────── Founder 触点（只读投影壳） ──────────────────────────┐
│  apps/workspace/   产品主页（单一投影，无写路径）                                │
│  apps/employee/    像素大厅与工牌（唯一写操作：启用/停用员工）                    │
│  apps/desktop/     Relay Code Electron 壳（自带 package.json，devDeps 合法）     │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │ HTTP（loopback，GET 投影 + POST 命令 seam）
┌──────────────────────────────────▼───────────────────────────────────────────┐
│  apps/runtime/server.mjs   最小运行时进程（命令 seam + 投影端点）                │
│  apps/shared/              apps 层共享纯函数（local-origin）                    │
└──────────────────────────────────┬───────────────────────────────────────────┘
┌──────────────────────────────────▼───────────────────────────────────────────┐
│  packages/runtime/   Kernel（命令真相库 + schema v12 迁移 + Continuation       │
│                      Driver + Relay Sense + secret provider）                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  packages/work/      Work/Task 生命周期 · 协作协议 · Continuation Policy 投影   │
│  packages/workforce/ Position/Employee/Assignment/WorkerRun · 派工与资格        │
│  packages/harness/   WorkerHost · Adapter 契约 · 模型 backend · 工具授权        │
│  packages/company/ decision/ planning/   公司根对象 · 决策记录 · 确定性规划      │
├──────────────────────────────────────────────────────────────────────────────┤
│  packages/product/    产品命令（Founder Hiring、Nova 研究员工）—— 允许调 kernel  │
│  packages/experience/ 只读投影（Founder Workspace / Lobby 数据源）—— 只读 kernel │
└──────────────────────────────────────────────────────────────────────────────┘
  fixtures/（种子数据） · scripts/（运行入口） · tests/（521 用例） · tooling/（dev 工具）
```

**依赖规则（由 `scripts/check.mjs` §5 强制执行，非口头约定）**：
- `packages/` 与 `apps/runtime/` 内**只允许** `node:` 内建与相对导入——零第三方依赖是被测试钉死的；
- `packages/product/` 可以调 kernel 命令；`packages/experience/` 只读派生；
- 反向依赖（core → product/experience/fixtures/scripts）被显式禁止。

## 2. 本次重构记录（全部 git mv，保留历史）

| 变更 | Before → After | 理由 |
| --- | --- | --- |
| scripts 职责分组 | `scripts/*.mjs` 平铺 19 个文件 → `scripts/{demos,evidence,ops}/` + `check.mjs`、`lib/` 原地不动 | 混合了运维/演示/证据三类入口；`lib/`（被 12 个测试引用）与 `check.mjs`（被 CI 与 bootstrap 测试钉死）刻意不移动 |
| dev 工具链独立 | 根 package.json devDependencies → `tooling/` 子包（config + deps 同址） | bootstrap 测试强制根 manifest 零依赖；`apps/desktop` 先例的推广 |
| apps 共享层显式化 | `apps/local-origin.mjs` → `apps/shared/local-origin.mjs` | apps 根只留目录；共享纯函数有明确的家 |
| CI 版本矩阵 | 单一 `.nvmrc` 版本 → Node 24.x + 22.x 矩阵（`fail-fast: false`） | 24.x 是支持目标，22.x 是兼容守卫（node:sqlite 22.13 起可用） |
| 覆盖率基线 | 无 → `npm run test:coverage`，**87.10% 行 / 82.35% 分支 / 83.34% 函数** | 后续重构的回归参照 |

**连带修复**：
- 移动脚本的相对导入（`../packages/` → `../../packages/` 等，perl 批量）与 5 处 `import.meta` 路径计算（REPOSITORY_ROOT、stub 路径、3 个防越界守卫 `dirname/..` → `dirname/../..`）；
- 13 处测试/文档引用同步更新（README 命令区、repository map、契约文档中的可执行命令路径）；
- **顺手消灭一批真实代码债**（见 lint 部分）：约 25 处死导入、死赋值、optional catch binding、`prefer-const`，全部位于 packages/scripts 核心。

## 3. 框架评估：下一个里程碑 = 拆分两个 god-file

当前框架的最大结构问题不是目录，而是**两个巨型文件**：

### 3.1 `packages/runtime/kernel.mjs`（3395 行）
单一 `WorkKernel` 类承载：公司/Work/Task 生命周期、Workforce 命令、执行 seam（submit/interrupt/binding）、Review/Repair、Founder 决策、Hiring、全部读投影。除 `packages/runtime/index.mjs` 外**无外部直接导入**（已验证）——拆分对外不可见，风险可控。

**拆分蓝图**（facade 不变，`index.mjs` 的公共 API 逐字保留）：
```
packages/runtime/kernel/
  context.mjs          共享上下文（store、now、error 工厂、观察者 seams）
  lifecycle.mjs        company/work/task 创建与生命周期命令
  workforce.mjs        position/employee/assignment/workerRun 命令
  execution.mjs        执行 seam：startWorkerRun/submitWorkerResult/interrupt/bind
  collaboration.mjs    review/repair/reviewRequest 协作协议
  decisions.mjs        founderAttention/acceptWork/founder decisions
  hiring.mjs           draft/trial/confirm/hiring 命令
  reads.mjs            全部只读查询与 projection
  kernel.mjs           WorkKernel facade：组合上述模块，保持现有方法签名
```
验收标准：521 测试全绿（除已知沙箱项）+ `check.mjs` 通过 + 公共 API diff 为零。

### 3.2 `packages/runtime/store.mjs`（1843 行）
承载 schema v12 全部建表、v1→v12 迁移链与查询。拆分优先级低于 kernel：
```
store/schema.mjs    v12 建表 DDL（权威）
store/migrations.mjs  v1→v12 迁移链（append-only，永不改写已合并迁移）
store/queries.mjs   按聚合分组的查询
store.mjs           facade
```
**执行纪律**：kernel 与 store 拆分是**两个独立里程碑**，各自单独提交、单独全量验证；禁止同批进行。

## 4. 债务台账（lint warn 级，已登记）

| 债务 | 数量 | 位置 | 处置计划 |
| --- | --- | --- | --- |
| `preserve-caught-error`（ESLint 10 新规） | 5 | apps/desktop 密钥/生命周期代码 | 专项批次补 `{ cause }`，不动桌面安全代码语义 |
| tests/ 未用变量 | ~12 | tests/unit | 逐模块清理 |
| apps/ 未用变量 | ~15 | workspace/employee UI | 逐模块清理 |
| ESLint 覆盖基线 | 0 error / 32 warn 全仓 | — | warn 清零后可将选规则升 error |

## 5. 验证证据（本次重构）

- `npm run check` → OK（24 必需文件、316 tracked、无凭据、无 legacy、核心词汇干净）
- `node --test`（Node 24.19）→ **521 tests / 520 pass / 1 fail**（唯一失败为 `desktop-worker-shutdown-process` 的沙箱 `ps` EPERM，重构前即存在）
- `npm run lint` → **0 error / 32 warning**（探针文件验证管线有效：故意违规被精确捕获）
- `npm run test:coverage` → 行 87.10% / 分支 82.35% / 函数 83.34%
- 上游同步：`git fetch` 确认本地与 origin/main 同在 `f4aa221`；已建立每日 09:00 自动同步检查（只读，不 merge）
