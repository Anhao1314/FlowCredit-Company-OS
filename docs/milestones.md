# FlowCredit milestone narrative — 按合并顺序的完整里程碑叙述

> 本文档保存原 README「Current status」段的编年史全文（2026-10-22 迁出）。
> 段中出现的 schema 版本号是**当时**的值；store 现为 **schema v12**，旧 store 沿
> v1→v12 逐级迁移、保留全部历史。当前能力权威清单以 README 状态表与
> [docs/contracts/](contracts/) 为准。

## v0A — Persistent Work Kernel（合并时 schema v1）

已实现的是一个不绑定任何特定模型 provider 的持久 Work Kernel：`Company` / `Work` /
`Task` / `Artifact` / `Checkpoint` / `Activity` 在进程退出与重启后保持一致、可恢复，
并带 generation 隔离（旧 execution 的迟到结果无法覆盖新现实）。它跑在 Node 内置的
`node:sqlite` 上，零第三方依赖。

## v0B1 — Workforce Identity & Assignment（合并时 schema v2）

在 Kernel 之上加入团队身份与派工：`Position`（岗位能力）/ `Employee`（长期存在的
AI 员工）/ `Assignment`（谁负责这项 Task）/ `WorkerRun`（一次执行尝试，带自己的
id 与状态）。员工身份与模型、provider、执行尝试完全解耦：换 provider 不会换人，
崩溃不会让员工永远"忙碌"。

## v0B2 — Review / Repair Collaboration（合并时 schema v3）

加入企业协作协议：一个员工交付 Artifact 后，另一个员工可以正式 **Review** 它
（`PASS` / `REQUEST_REVISION`），Review 发现问题时 Runtime 会开出带完整 lineage 的
**Repair Task**（新的 Task，不是重开旧的），修复产出的 Artifact 通过
`supersedesArtifactId` 取代旧版本，并且必须再次接受 Review。Review 记录不可修改，
旧 Artifact 永不改写，循环次数不设上限。Review 之后 Work 只会变成
`READY_FOR_DECISION` —— **Reviewer PASS ≠ Founder ACCEPT**。

## v0B3 — Founder Attention & Acceptance（合并时 schema v4）

补上这条链路的最后一段：**Founder Attention + Founder ACCEPT**。Work 停下等待
人类时，`WorkKernel.founderAttention({ companyId })` 会给出一个派生 projection ——
哪些 Work 真的需要 Founder、可以做什么、以及为什么。它不是第二套 Todo：没有
Inbox 表、没有 read/unread/done/dismissed，读它不写任何东西，每个 Work 最多一条。
Founder 的 ACCEPT 是**唯一被持久化的人类权威动作**，写入一张 append-only、不可修
改、每个 Work 最多一条的 `founder_decisions`，并绑定**确切的 Artifact、确切的
digest、确切的 DecisionBasis（该 Work 的 activity head）**。ACCEPT 与 Review 完全
解耦：Review 不可能自动变成接受，接受也不会写入 Knowledge。Work 的 outcome 是派
生的（`NO_CANDIDATE` / `READY` / `AMBIGUOUS` / `ACCEPTED`），collaboration status
仍是 `READY_FOR_DECISION`：`ACCEPT` 是动作，`ACCEPTED` 是状态。

v0B3 同时记录了一个 **AI Workforce MVP closure gate**：

> Founder 建好 Work 之后，能否不亲自做日常协调，一直等到 FlowCredit 合理地需要他？

## v0B4 — Work Continuity（合并时 schema v6）

把"调度团队"这一段交还给 Runtime：Continuation Driver 是一个**无状态执行器**
（读真相 → 选一个合法动作 → 跑一条命令 → 重新读），没有时钟、没有队列、没有调度
策略；每次迭代最多提交一次业务写入（`MAX_CONTINUATION_STEPS = 16` 是循环保险丝）。
协调规则冻结在 Work Continuity v0B4 契约里：eligibility（组织能力事实）≠
dispatchability（此刻能否自动开工），BUSY 不等于能力缺口
（`NO_DISPATCHABLE_EMPLOYEE`）；Reviewer 独立性（reviewer ≠ 该 Artifact 的
producer）在 `assignTask` 与 `startWorkerRun` 两处 fail-closed 强制；
`WORK_ALREADY_ACTIVATED` 是良性收敛而不是失败。跨 Work 的唤醒只是"公司人力事实变
了（run 结束 / enabled 变化 / 新员工）→ 重新读真相"的信号：不写别的 Work 的
Activity、不推进它的 basis、没有持久队列、没有 event bus。新增 append-only 的
`continuation_traces`（仅供观测，永不作为决策输入）。

`FLOWCREDIT_COORDINATION=driver` 时，普通 Task 的指派与启动、Review 的指派、
Repair 的协调都由 Continuation Driver 逐步完成；Scenario 1 / Scenario 2 实测
Founder Extra Touch 与 Manual Coordination 均为 **0**。这个结果的名字是
`Deterministic Workforce Coordination Closure = PASS`，**不是**"完整产品自主"。
v0B4 不包含 scheduler、capability ranking、DAG planner、Dynamic Swarm、Hiring 或
Knowledge Admission；历史能力留在旧 R&D 仓库。

## Backend Founder Work Loop v0A

增加独立的 `CreateFounderWork` 产品命令和不可变的 Work 级本地执行绑定（仓库指纹 +
固定 commit，不存绝对路径）。默认 Runtime 仍不开启协调或 Worker backend。契约见
[backend-founder-work-loop-v0a.md](contracts/backend-founder-work-loop-v0a.md)。

## H0 / H0.1 / H0.2 — 执行层实验证据

用真实 `codex exec` 子进程验证执行层假设——真实 Codex 执行从实验上确认了 Harness
的隔离边界、中断与结构化结果假设，这些结论随后被固化成执行契约。committed 的
Worker Harness v0 是 **provider-neutral** 的生产执行架构；`CodexExecAdapter` 是它
的第一个真实 backend，已在真实 CLI（`codex-cli 0.154.0-alpha.6.2`）上完成 H1 验证。

执行层的形态：一次 WorkerRun 的结束由 Worker host 报告——失败走
`interruptWorkerRun`（`WORKER_TIMEOUT` / `WORKER_PROCESS_EXIT` /
`WORKER_PROTOCOL_ERROR` / `WORKER_OUTPUT_REJECTED`，与崩溃恢复共用同一个中断
primitive），成功走 `submitWorkerResult`。成功交付是**原子**的：Artifact 记录、
WorkerRun 收口、Task 状态与 **Runtime 自己推导的** Review 交接在同一事务提交，
host 无法自行选择交接方式；重放 `(workerRunId, generation, resultDigest)` 幂等，
换 digest 则 `WORKER_RESULT_CONFLICT`。候选 outcome 只认 producer Task **当前
generation** 的 Artifact：被放弃 generation 的残留永远是历史而不是候选，所以"崩
溃 + 自动重试"不会再制造假的 `OUTCOME_AMBIGUOUS`。完整 Harness evidence 永不入
库，只留 digest。

## Worker Harness v0 Slice 1.1 — 执行层（合并时 schema v6）

`WorkerHost` 只执行 Runtime 已经开工的 WorkerRun——派工、开工、Review/Repair 调度
仍属于 v0B4。开工观察走与 v0B4 同形的 post-commit seam（重复通知安全，错过可被
reconcile 修复，没有轮询/事件总线/持久队列）。每次尝试持久化一条不可变的
`WorkerExecutionBinding`（1 WorkerRun : 1 binding），并把「运行目录」按
`run + generation` 隔离：新 generation 一定是新 workspace，旧的孤儿目录永不复用
——正确性来自 generation fencing + isolation，不依赖杀掉孤儿进程。WorkerResult
（Worker 自述）与 HarnessEvidence（Host 观测）是两个对象，都不等于批准；
`executionPolicy.requested ≠ effective`：请求的限制不等于已证明的隔离。

尝试按角色持有各自的 `ResultContract`（执行/Repair = `ARTIFACT_DELIVERY`，Review
= `REVIEW_JUDGMENT`，由 WorkPacket 决定，adapter 不能改）。两条交付 seam 都是原子
的：`submitWorkerResult` 写 Artifact，`submitWorkerReviewResult` 写 **Reviewer 的
判断**——Runtime 从 WorkerRun 推导 Review Task → ReviewRequest → 目标 Artifact +
digest 的全部 lineage，复用同一个 `submitReview` 原语，绝不伪造 verdict，也不会在
事务里顺手创建 Repair。两条 seam 都以 `(workerRunId, generation, resultDigest)` 幂
等，冲突返回 409；Provider 专属解析属于 adapter，schema 验证属于 Host：没有可用
的结果协议时中断尝试（`WORKER_PROTOCOL_ERROR`），协议合法但被独立 Harness 证据或
执行策略拒绝时中断尝试（`WORKER_OUTPUT_REJECTED`，具体原因如 verification /
HEAD / 受保护路径留在 evidence 侧），两者都永远不会变成 Runtime truth。自动重试
是**有界**的：`MAX_AUTONOMOUS_ATTEMPTS_PER_TASK = 3`（1 次初始 + 2 次自动重试），
计数完全从持久的 WorkerRun 历史推导，不存计数器、不加 Task 状态；预算用尽后
Driver 停止（`AUTO_RETRY_EXHAUSTED`），Work 进入 Founder Attention
（`RESUME_EXECUTION` / `ASSIGN_EMPLOYEE` / `ENABLE_EMPLOYEE` / `ABANDON_TASK`）。

## CodexExecAdapter v1 — 真实 codex exec（H1 / H1.1）

把同一个 WorkerAdapter 契约接到真实的本地 `codex exec` 上：一次 WorkerRun = 一个
全新的子进程（`--ephemeral`，不 resume）；base repository + 精确 baseRevision 通过
`git worktree --detach` 变成 run-scoped workspace，源 checkout 永不被触碰、worker
永不 commit / push；`TMPDIR`/`TMP`/`TEMP` 指向 run scratch，并诚实记录
sandbox ≠ OS 级隔离。prompt 只由 WorkPacket + run envelope 编译（角色、目标、成功
标准、独立验证命令、受保护路径、禁止的外部效果、结果 JSON 形状；不要求
chain-of-thought）。结果解析先 strict JSON、再在文本里提取**唯一**的顶层 JSON 对
象（fenced 或裸对象同样对待；两个可解析对象直接拒绝），绝不推断缺失字段、绝不用
第二次 LLM 修 malformed 输出；模型自述与 Harness 独立观测（进程 / git diff vs
baseRevision / 受保护路径 / 独立运行验证命令）是两个对象。

H1 已在真实 CLI 上跑通：真实执行 → 独立验证通过 → 真实 Codex reviewer PASS →
`READY_FOR_DECISION` → Founder ACCEPT（Work 提出后 0 条手动协调命令）；真实超时
→ `WORKER_TIMEOUT` → 自动重派到新 generation 的新 workspace（旧 workspace 被投毒
也永不复用）；结果协议非法时 3 次尝试全部 `WORKER_PROTOCOL_ERROR`、不产生
Artifact / Review、交给 Founder。H1.1 收口了失败原因词汇（协议非法 vs 交付被拒）
并用三个真实任务场景（输入规范化、ISO-8601 时长、区间代数）各跑通一条"真实执行
→ 真实评审"链路：Reviewer 每次都是自主判定且诚实地 PASS，**没有观测到真实的
`REQUEST_REVISION`**，所以 Repair 证据缺口记为
`REAL_REPAIR_EVIDENCE_NOT_OBSERVED`（协议本身由确定性测试覆盖）。重启、评审与修
复语义完全复用 v0A–v0B4，Runtime 不受 Codex 影响。

## Workforce Experience v0A — 产品读模型（合并时 schema v6+）

**产品读模型**而不是新 Runtime：`packages/experience/` 从 Kernel 公开 read seam 派
生 Founder Workspace 与 Employee Lobby 需要的内容（Company 状态、Founder
Attention、主 Work lineage、AI Workforce、Recent Deliveries、Company Pulse）。
availability 冻结为派生的 `AVAILABLE` / `WORKING` / `DISABLED`，当前角色冻结为派
生的 `EXECUTION` / `REVIEW` / `REPAIR` —— 两者都不存储、不缓存、不猜；执行
backend（`backendType` / `backendVersion`）只是执行细节，不是员工身份。四个
GET-only 端点暴露这些投影：`/experience/companies/:id/workspace`、
`/experience/companies/:id/workforce`、`/experience/employees/:id`、
`/experience/works/:id/lineage`。读投影不写任何东西、没有第二套 lifecycle、没有
缓存、没有 Todo 表：读时从 Runtime truth 重新派生，重启后同一 truth 投影完全一
致，未知 id 显式 404。Founder Attention 仍然只是 Runtime projection；Reviewer
PASS 不会经由此层变成 ACCEPTED。

**Employee Lobby v0** 把像素大厅（PR #1）接入 Experience API：大厅只是投影的只读
客户端，唯一的 Founder 写操作是启用/停用员工。

**Founder Workspace v0C** 把同一层投影接成产品主页 `apps/workspace`
（`/workspace`）：主 Work lineage、Needs You、AI Workforce、Recent Deliveries 与
Company Pulse 全部来自 `GET /experience/companies/:id/workspace` 的**单一投影**，
每 ~2 秒整体替换；工作台自身**没有任何写路径**（`+ 新建 Work` 是诚实的禁用占
位，ACCEPT 的执行属于 Founder Decision UI 里程碑）。

## Generic Model Worker v0A · Web Research Actuator v0B · Product Research Employee v0C · Founder Hiring Loop v0 · Relay Sense v0

在此之上，执行层已接入**通用模型员工循环**：`GenericModelWorkerAdapter`（Host 授
权的 ToolSession + 有界模型循环）+ OpenAI 兼容 Chat Completions
ModelBackend（LLM 层已迁移至可配置 API backend：修复模型名、`max_tokens` 按
ResultContract 调整、截断显式映射为 `MODEL_OUTPUT_TRUNCATED`、瞬时故障有界指数退
避重试）+ `WebResearchActuator`（`research.web.search` /
`research.web.read`，SSRF 加固的只读公共 web 观测；v0B 无生产 SearchProvider，配
置后可用）。产品层已有 **Nova 选品研究员工**
（`packages/product/product-research.mjs`）与 **Founder Hiring Loop v0**（草稿 →
试用 Work → 真实模型执行 → 评审 → Founder 确认，
`packages/product/founder-hiring.mjs` / `employee-hiring.mjs` + `/workspace` 招聘
页）。观测面 **Relay Sense v0** 已实现（`packages/runtime/relay-sense.mjs` +
`jev-sense-backend.mjs` / `laya-shadow-sensor.mjs`：Champion/Challenger 双传感
器、仅观测、永不作为决策输入）。General A2A 仍未开始。

## Three MVPs: closure 状态

Three MVPs: **still not complete.** Company Genesis 还没有实现；AI Hiring Loop 已
实现 Founder 侧闭环（草稿 → 试用 → 评审 → 确认，`docs/contracts/` 与
`packages/product/founder-hiring.mjs`）但尚未做正式 closure 审核；AI Workforce
Loop 也还没有被正式宣布 PASS。Kernel 是三者共同的 Runtime 地基。

Company Canvas 不是第四个 MVP，它是三个 MVP 的统一 Founder Workspace。Jev 不是
第四个 MVP，它是可选的 Semantic Sensor 实现；新 Runtime 不得硬依赖 TypeSafe SDK
才能运行。Dynamic Swarm（动态分配、并行 fan-out、自主组队）不是当前 MVP blocker。
