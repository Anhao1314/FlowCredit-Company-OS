# FlowCredit

**Personal AI Company OS — 一台电脑，一家公司。**

FlowCredit 认识 Founder，帮助他建立自己的 AI 公司、招聘 AI 员工，并让员工围绕 Work 持续协作完成工作。Founder 只处理真正需要自己的事情。

- **Category:** AI-native Company OS
- **Audience:** 个人创业者 / Solo Founder / 一人公司（OPC），单机、单用户
- **Long-term shape:** Founder 组建团队，FlowCredit 调度团队，Work 持续存在

---

## 1. Current status

**Foundation + Persistent Work Kernel (schema v13) + Workforce Identity & Assignment v0B1 +
Review / Repair Collaboration v0B2 + Founder Attention & Acceptance v0B3 +
Work Continuity v0B4 + Worker Harness v0 + CodexExecAdapter v1 +
Generic Model Worker v0A + Web Research Actuator v0B + Product Research Employee v0C +
Founder Hiring Loop v0 + Relay Sense v0 (Laya / Jev) +
Workforce Experience v0A + Employee Lobby v0 + Founder Workspace v0C.**

### Capability snapshot

| 能力 | 状态 | 契约 / 证据 |
| --- | --- | --- |
| 持久 Work Kernel | ✅ schema v13：崩溃恢复、generation fencing、幂等交付、v1→v13 迁移链 + 迁移前自动快照 | [persistent-work-kernel-v0](docs/contracts/persistent-work-kernel-v0.md) |
| 团队身份与派工 | ✅ Employee ≠ Model ≠ WorkerRun | [workforce-identity-assignment-v0](docs/contracts/workforce-identity-assignment-v0.md) |
| Review / Repair 协作 | ✅ 协议完整；真实 Repair 证据缺口 `REAL_REPAIR_EVIDENCE_NOT_OBSERVED` | [review-repair-collaboration-v0](docs/contracts/review-repair-collaboration-v0.md) |
| Founder Attention & ACCEPT | ✅ 唯一持久化人类权威动作；Decision UI 未实现 | [founder-attention-acceptance-v0](docs/contracts/founder-attention-acceptance-v0.md) |
| 自动协调（Continuation Driver） | ✅ 实测 0 手动协调（closure gate PASS） | [work-continuity-v0](docs/contracts/work-continuity-v0.md) |
| 执行层 | ✅ Codex exec 真实验证（H1/H1.1）+ DeepSeek 通用模型循环 + 确定性 test backend | [worker-harness-v0](docs/contracts/worker-harness-v0.md) · [codex-exec-adapter-v1](docs/contracts/codex-exec-adapter-v1.md) · [generic-model-worker-v0a](docs/contracts/generic-model-worker-v0a.md) |
| Web 观测 | ✅ 只读 read（SSRF 加固）；search 有接口、无生产 SearchProvider | [web-research-actuator-v0b](docs/contracts/web-research-actuator-v0b.md) |
| 产品员工 | ✅ Nova 选品研究（单场景、市场限 US） | [product-research-employee-v0c](docs/contracts/product-research-employee-v0c.md) |
| Founder 招聘闭环 | 🔶 Founder 侧闭环已实现，未做 closure 审核 | [backend-founder-work-loop-v0a](docs/contracts/backend-founder-work-loop-v0a.md) |
| 观测面 Relay Sense | ✅ Champion/Challenger 影子传感器，仅观测、永不作为决策输入 | — |
| 产品界面 | ✅ Experience 只读投影 + Lobby；写路径全部是诚实占位 | [workforce-experience-v0](docs/contracts/workforce-experience-v0.md) · [employee-lobby-v0](docs/contracts/employee-lobby-v0.md) · [founder-workspace-v0](docs/contracts/founder-workspace-v0.md) |
| 桌面壳 Relay Code | ✅ Electron 44 macOS 壳；未签名未公证 | [relay-code-desktop-v0](docs/contracts/relay-code-desktop-v0.md) |
| Company Genesis（MVP 1） | ❌ 未实现 | — |
| Founder Work 定义 / Decision UI / Canvas 持久化 | ❌ 未开始 | — |
| General A2A / Dynamic Swarm / DAG planner | ❌ 明确不在当前范围 | — |

### The three core MVPs

| # | MVP | 回答的问题 | 核心产物 |
| --- | --- | --- | --- |
| 1 | **Company Genesis** | 这是谁的公司？ | `FounderProfile` `CompanyProfile` `WorkspaceProfile` |
| 2 | **AI Workforce Loop** | 这家公司怎么工作？ | `Work` `Task` `WorkerRun` `Artifact` `Review` `Repair` `Decision` |
| 3 | **AI Hiring Loop** | 公司缺能力时如何增加员工？ | `Position` `Employee`（经 Trial Task 与 Founder 确认） |

Three MVPs: **still not complete.** Company Genesis 还没有实现；AI Hiring Loop 已实现
Founder 侧闭环但尚未做正式 closure 审核；AI Workforce Loop 也还没有被正式宣布 PASS
（协调 closure gate 已 PASS，见 [里程碑叙述](docs/milestones.md)）。Kernel 是三者共同的
Runtime 地基。Company Canvas 不是第四个 MVP，它是三个 MVP 的统一 Founder Workspace；
Jev 是可选的 Semantic Sensor；Dynamic Swarm 不是当前 blocker。

按合并顺序的完整里程碑叙述（schema 演进、H0/H1 实验证据、每层的诚实边界）在
[docs/milestones.md](docs/milestones.md)。

## 2. Frozen principles

**Founder = Authority · Work = Continuity · Runtime = Control · Semantic Sensors = Sense · AI Employee = Think + Act · Knowledge = Memory**

四条不可协商的判断：

- Agent COMPLETE ≠ Accepted
- Reviewer PASS ≠ Human Approval（Reviewer PASS ≠ Founder ACCEPT）
- Founder ACCEPT ≠ Knowledge Admission
- Prompt ≠ Permission，Capability ≠ Permission

完整清单见 [架构原则](docs/architecture/principles.md) 与 [对象模型](docs/architecture/object-model.md)。

## 3. Architecture（一屏）

```
Founder 触点        apps/workspace（主页）  apps/employee（大厅）  apps/desktop（Electron 壳）
                        │ HTTP：GET 只读投影 + POST 命令 seam（loopback only）
运行时进程          apps/runtime/server.mjs + apps/shared
Kernel             packages/runtime   WorkKernel · Continuation Driver · schema v12 · Relay Sense
领域包             packages/work · workforce · harness · company · decision · planning
产品层             packages/product（可写命令）  packages/experience（只读投影）
基础设施           scripts（check·lib·demos·evidence·ops）  tooling（dev-only ESLint）
                   tests（526 用例）  fixtures（种子数据）
```

依赖规则被 `scripts/check.mjs` §5 强制执行：`packages/` 与 `apps/runtime/` 只允许
`node:` 内建与相对导入（零第三方运行时依赖），反向依赖被测试钉死。仓库结构、重构
记录与 kernel/store 拆分蓝图见
[docs/architecture/repository-restructure-2026-10.md](docs/architecture/repository-restructure-2026-10.md)。

## 4. Quick start

要求 Node **24.19.0**（`.nvmrc`，CI 另跑 22.x 兼容守卫）。

### 验证与质量门

```sh
npm run check          # 结构 / 密钥 / 生成物 / 核心语言与依赖检查
npm test               # node --test（单元 + 真实进程重启集成测试）
npm run test:coverage  # 覆盖率（基线：行 87.1% / 分支 82.4% / 函数 83.3%）
npm run lint           # ESLint（dev-only，tooling/ 子包；0 error，32 条已登记 warning）
```

### 演示（每个都是可复现的最小闭环）

```sh
node scripts/demos/demo-work-kernel.mjs              # 持久化与恢复（真实进程，SIGKILL 后恢复）
node scripts/demos/demo-workforce-v0b1.mjs           # 派工：员工身份跨崩溃存活，Artifact 指明 producer
node scripts/demos/demo-review-repair-v0b2.mjs       # Review → Repair → 再次 Review → PASS
node scripts/demos/demo-founder-acceptance-v0b3.mjs  # Attention → ACCEPT → ACCEPTED（含硬重启）
node scripts/demos/demo-work-continuity-v0b4.mjs     # Driver 自动派工/开工/Review/Repair（0 手动协调）
node scripts/demos/demo-worker-harness-v0.mjs        # 执行→评审→ACCEPT、REVISION→Repair、超时重派、重试预算
```

### 运行时与界面

```sh
node apps/runtime/server.mjs   # Kernel 长期进程（默认临时端口，仅监听 127.0.0.1）
npm run start:workspace        # Founder Workspace：http://127.0.0.1:4320/workspace
npm run start:employees        # 像素大厅：http://127.0.0.1:4318/employees
npm run start:desktop          # Relay Code（macOS Electron 壳，开发态）
npm run package:desktop        # 打包 Relay Code.app（未签名未公证）
```

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `FLOWCREDIT_RUNTIME_DIR` | — | store 目录 |
| `FLOWCREDIT_PORT` | `0`（临时端口） | 仅监听 127.0.0.1 |
| `FLOWCREDIT_COORDINATION` | `off` | 设为 `driver` 启动 Continuation Driver（启动 drive 一次 + 每次命令提交后唤醒） |
| `FLOWCREDIT_WORKER_BACKEND` | `off` | `test-worker`（确定性）/ `codex-exec`（真实本地 Codex CLI，需 `FLOWCREDIT_CODEX_REPO` 等，见契约） |

界面均为 LIVE 只读投影客户端：读失败时保留最后已知投影并明确标注，绝不回退演示数据；
`/employees?demo=1` 是显式标记的浏览器内模拟。唯一的 Founder 写操作是启用/停用员工；
ACCEPT 执行、新建 Work 均为诚实占位。行为细节以
[Employee Lobby v0](docs/contracts/employee-lobby-v0.md) 与
[Founder Workspace v0](docs/contracts/founder-workspace-v0.md) 契约为准。

### H1 / H1.1 真实执行证据

需本机已安装并登录 Codex CLI；只写 `/tmp/flowcredit-h1*`，不触仓库。

```sh
node scripts/evidence/h1-codex-exec.mjs smoke|A|B|C   # 冒烟 / 执行→评审→ACCEPT / 超时重派 / 协议失败
node scripts/evidence/h1-1-codex-repair.mjs 1|2|3     # 三个真实"执行→评审"场景
node scripts/evidence/h1-1-codex-repair.mjs boundary 1|2|3
```

CI（GitHub Actions `FlowCredit CI`）在 `pull_request` 与 push 到 `main` 时运行
`node scripts/check.mjs` 与 `node --test`（Node **24.x + 22.x** 矩阵），外加
ESLint 与覆盖率门禁（`scripts/coverage-gate.mjs`，Node 24.x 单独 job）；权限仅
`contents: read`，无密钥、无网络模型调用。CI 只是回归保护，不是 provider 验证：
真实 Codex 证据仍需手动运行。

## 5. Repository map

```
README.md          产品入口与当前状态
AGENTS.md          工程章程（AI/人类协作者都适用）
docs/product/      MVP 定义
docs/architecture/ 原则、对象模型、仓库重构记录
docs/contracts/    20 份里程碑契约（能力权威清单）
docs/milestones.md 按合并顺序的完整里程碑叙述（自 README 迁出）
docs/migration/    旧仓库能力迁移清单与 provenance
packages/          foundation（跨域原语：digestOf——依赖图 DAG 的叶子）·
                   company · work · decision · planning · workforce · harness ·
                   runtime（Kernel、schema v13、Continuation Driver、Relay Sense、
                   secret provider）· product · experience
apps/runtime/      Kernel 最小运行时进程（命令 seam + Founder Attention 与 Experience 端点）
apps/shared/       apps 层共享纯函数（local-origin）
apps/workspace/    Founder Workspace 产品主页（只读投影壳，无写路径）
apps/employee/     AI 员工像素大厅与工牌（只读 + 启用/停用）
apps/desktop/      Relay Code Electron 桌面壳（独立 package.json，devDeps 合法）
fixtures/          种子数据（system workforce roster），不属于核心语言
scripts/           check（结构/凭据/依赖方向质量门）· coverage-gate（覆盖率门禁）·
                   lib（进程 harness，测试共用）· demos（可复现演示）·
                   evidence（H1/H1.1 与人工证据）· ops（UI 启动与种子写入）
tooling/           dev-only 工具链（ESLint 基线；根 manifest 保持零依赖，bootstrap 测试钉死）
tests/             smoke · unit · integration（node --test）
```

只有存在真实内容时才新增目录；不做占位式空结构。

## 6. Documentation index

- **产品**：[MVP 定义](docs/product/mvp-v0.md)（三大 MVP 与边界）
- **架构**：[原则](docs/architecture/principles.md) · [对象模型](docs/architecture/object-model.md) · [仓库重构记录](docs/architecture/repository-restructure-2026-10.md)
- **契约**（能力权威清单，先契约后实现）：Kernel [v0A](docs/contracts/persistent-work-kernel-v0.md) · Workforce [v0B1](docs/contracts/workforce-identity-assignment-v0.md) · Review/Repair [v0B2](docs/contracts/review-repair-collaboration-v0.md) · Founder Acceptance [v0B3](docs/contracts/founder-attention-acceptance-v0.md) · Continuity [v0B4](docs/contracts/work-continuity-v0.md) · Founder Work [v0A](docs/contracts/backend-founder-work-loop-v0a.md) · 执行 [seam](docs/contracts/worker-execution-seam-v0.md) / [harness](docs/contracts/worker-harness-v0.md) / [codex](docs/contracts/codex-exec-adapter-v1.md) / [backend discovery](docs/contracts/desktop-worker-backend-discovery-v0.md) · 模型 [generic-worker](docs/contracts/generic-model-worker-v0a.md) · 工具 [web-research](docs/contracts/web-research-actuator-v0b.md) · 员工 [nova](docs/contracts/product-research-employee-v0c.md) · 界面 [experience](docs/contracts/workforce-experience-v0.md) / [lobby](docs/contracts/employee-lobby-v0.md) / [workspace](docs/contracts/founder-workspace-v0.md) / [integration](docs/contracts/founder-workspace-product-integration-v1.md) · 桌面 [relay-code](docs/contracts/relay-code-desktop-v0.md)
- **历史**：[里程碑叙述](docs/milestones.md) · [迁移清单](docs/migration/from-flowcredit-worklab-v1.md)

## 7. Engineering charter

[AGENTS.md](AGENTS.md) 一页章程，对人类与 AI 协作者同样生效：

1. clean re-foundation——禁止整目录复制旧仓库（`cp -R` 一律禁止）
2. 三个 MVP 是最高优先级，任何 feature 不得高于主线
3. 旧仓库 READ ONLY，只作 provenance；迁移 **capability by capability, contract by
   contract, test by test**，逐项记录来源与验证
4. 一次只做一个里程碑；声明完成必须给出证据
5. Runtime truth > UI——不放 fake production data
6. Founder = Authority——Agent 不写知识、不替 Founder 决定
7. Git 与凭据安全——未经明确授权不 commit / 不 push；禁止 `git add .`

## 8. Relationship to the old worklab repositories

旧的 `FlowCredit-worklab` 系仓库（含其 worktree）**不再是产品主线**，角色是
READ ONLY 的 R&D / Provenance / Historical Evidence Source。未来能力迁移遵循
**capability by capability, contract by contract, test by test**，每一项都要在
[迁移清单](docs/migration/from-flowcredit-worklab-v1.md) 中留下来源、提交与验证
测试，禁止整目录复制。

## 9. Next milestones

1. **框架**：拆分 `packages/runtime/kernel.mjs` 与 `store.mjs`（蓝图见
   [重构记录](docs/architecture/repository-restructure-2026-10.md)）
2. **垂直切片**：原生 tool calling + 流式、真实 SearchProvider、Founder Decision UI
   —— 让 Founder 第一次能在界面里点下 ACCEPT
3. **Company Genesis**：MVP 1 从零开始
