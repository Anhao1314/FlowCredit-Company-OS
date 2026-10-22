import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  openTempKernel,
  reopenKernel,
  seedCompanyAndWork,
  tempStoreDir,
} from "../support/kernel.mjs";
import { SCHEMA_VERSION, STORE_FILE_NAME } from "../../packages/runtime/index.mjs";

test("a fresh store initialises its schema and reports its version", () => {
  const { dir, kernel, cleanup } = openTempKernel();
  try {
    assert.equal(kernel.status().schemaVersion, SCHEMA_VERSION);
    assert.ok(existsSync(join(dir, STORE_FILE_NAME)));
    const tables = kernel.store.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((row) => row.name);
    for (const table of [
      "activity",
      "artifacts",
      "checkpoints",
      "companies",
      "schema_meta",
      "tasks",
      "works",
      "positions",
      "employees",
      "assignments",
      "task_requirements",
      "worker_runs",
      "reviews",
      "review_requests",
      "repair_bindings",
      "founder_decisions",
      "continuation_traces",
      "worker_execution_bindings",
    ])
      assert.ok(tables.includes(table), `missing table ${table}`);
    assert.deepEqual(kernel.status().counts, {
      companies: 0,
      works: 0,
      tasks: 0,
      checkpoints: 0,
      artifacts: 0,
      positions: 0,
      employees: 0,
      assignments: 0,
      workerRuns: 0,
      reviews: 0,
      reviewRequests: 0,
      repairBindings: 0,
      founderDecisions: 0,
      continuationTraces: 0,
      workerExecutionBindings: 0,
      activity: 0,
    });
  } finally {
    cleanup();
  }
});

test("reopening the same store keeps the version and the data", () => {
  const { dir, kernel, cleanup } = openTempKernel();
  try {
    const { company, work } = seedCompanyAndWork(kernel);
    kernel.close();

    const reopened = reopenKernel(dir);
    assert.equal(reopened.status().schemaVersion, SCHEMA_VERSION);
    assert.equal(reopened.company(company.id).name, company.name);
    assert.equal(reopened.work(work.id).title, work.title);
    assert.equal(reopened.status().counts.companies, 1);
    reopened.close();

    const third = reopenKernel(dir);
    assert.equal(third.status().counts.works, 1, "reopening does not re-initialise the store");
    third.close();
  } finally {
    cleanup();
  }
});

test("an incompatible schema version fails clearly instead of being read", () => {
  const dir = tempStoreDir();
  try {
    const db = new DatabaseSync(join(dir, STORE_FILE_NAME));
    db.exec("CREATE TABLE schema_meta(version INTEGER NOT NULL)");
    db.prepare("INSERT INTO schema_meta(version) VALUES(?)").run(999);
    db.close();
    assert.throws(() => reopenKernel(dir), {
      code: "INCOMPATIBLE_SCHEMA_VERSION",
    });
    assert.throws(() => reopenKernel(dir), /schema version 999/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a schema_meta table without a version is not silently accepted", () => {
  const dir = tempStoreDir();
  try {
    const db = new DatabaseSync(join(dir, STORE_FILE_NAME));
    db.exec("CREATE TABLE schema_meta(version INTEGER NOT NULL)");
    db.close();
    assert.throws(() => reopenKernel(dir), {
      code: "INCOMPATIBLE_SCHEMA_VERSION",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failed transaction leaves no partial write", () => {
  const { kernel, cleanup } = openTempKernel();
  try {
    assert.throws(
      () =>
        kernel.store.transaction(() => {
          kernel.store.insertCompany({
            id: "cmp_rollback",
            name: "Rollback Ltd",
            createdAt: new Date().toISOString(),
          });
          throw new Error("boom");
        }),
      /boom/,
    );
    assert.deepEqual(kernel.companies(), []);
    assert.equal(kernel.status().counts.companies, 0);

    const company = kernel.createCompany({ name: "Still works" });
    assert.equal(kernel.company(company.id).name, "Still works", "the store stays usable");
  } finally {
    cleanup();
  }
});

test("foreign keys and the state/generation constraints are enforced by the store", () => {
  const { kernel, cleanup } = openTempKernel();
  try {
    assert.throws(
      () =>
        kernel.store.db
          .prepare("INSERT INTO works(id,company_id,title,intent,created_at) VALUES(?,?,?,?,?)")
          .run("wrk_orphan", "cmp_missing", "t", "i", new Date().toISOString()),
      /FOREIGN KEY/,
    );

    const { work } = seedCompanyAndWork(kernel);
    const task = kernel.createTask({ workId: work.id, title: "T", intent: "I" });
    kernel.startTask({ taskId: task.id });
    assert.throws(
      () => kernel.store.db.prepare("UPDATE tasks SET generation=? WHERE id=?").run(0, task.id),
      /GENERATION_REGRESSION/,
    );
    assert.throws(
      () =>
        kernel.store.db
          .prepare("UPDATE tasks SET state=? WHERE id=?")
          .run("NOT_A_STATE", task.id),
      (error) => /CHECK/i.test(error.message),
    );
    assert.equal(kernel.task(task.id).state, "RUNNING");
    assert.equal(kernel.task(task.id).generation, 1);
  } finally {
    cleanup();
  }
});

test("a pre-existing store is snapshotted before the migration chain runs", () => {
  const { dir, kernel, cleanup } = openTempKernel();
  try {
    const { company } = seedCompanyAndWork(kernel);
    // Force the store back one version: reopening must walk it forward again —
    // and must not do so before a snapshot of the v12 facts exists.
    kernel.store.db.exec("UPDATE schema_meta SET version=12");
    kernel.close();

    const backupPath = join(dir, `${STORE_FILE_NAME}.bak-v12`);
    assert.ok(!existsSync(backupPath), "no snapshot exists before the migration is attempted");
    const reopened = reopenKernel(dir);
    assert.equal(reopened.status().schemaVersion, SCHEMA_VERSION);
    assert.ok(existsSync(backupPath), "the migration is preceded by a crash-consistent snapshot");
    const backup = new DatabaseSync(backupPath);
    try {
      const rows = backup.prepare("SELECT id, name FROM companies WHERE id=?").all(company.id);
      assert.equal(rows.length, 1, "the snapshot holds the pre-migration facts");
      assert.equal(rows[0].name, company.name);
    } finally {
      backup.close();
    }
    reopened.close();
  } finally {
    cleanup();
  }
});

test("a fresh install snapshots nothing", () => {
  const { dir, cleanup } = openTempKernel();
  try {
    const backups = readdirSync(dir).filter((name) => name.includes(".bak-v"));
    assert.deepEqual(backups, [], "a brand-new store has no pre-migration facts to protect");
  } finally {
    cleanup();
  }
});

test("an existing snapshot is left untouched on a re-open", () => {
  const { dir, kernel, cleanup } = openTempKernel();
  try {
    kernel.close();
    const backupPath = join(dir, `${STORE_FILE_NAME}.bak-v12`);
    let db = new DatabaseSync(join(dir, STORE_FILE_NAME));
    db.exec("UPDATE schema_meta SET version=12");
    db.close();
    const first = reopenKernel(dir);
    first.close();
    assert.ok(existsSync(backupPath), "the first pass creates the snapshot");
    const before = readFileSync(backupPath);
    // Second pass: downgrade again. The migration is idempotent
    // (IF NOT EXISTS), so the re-open succeeds — and the first snapshot, the
    // one that guarded the only real migration, must survive byte for byte.
    db = new DatabaseSync(join(dir, STORE_FILE_NAME));
    db.exec("UPDATE schema_meta SET version=12");
    db.close();
    const second = reopenKernel(dir);
    second.close();
    assert.deepEqual(readFileSync(backupPath), before, "the first snapshot is the good one");
  } finally {
    cleanup();
  }
});

test("the delivery receipts are targeted lookups backed by the kind index", () => {
  const { kernel, cleanup } = openTempKernel();
  try {
    const { company, work } = seedCompanyAndWork(kernel);
    const store = kernel.store;
    const append = (runId, kind, attempt) =>
      store.appendActivity({
        companyId: company.id,
        workId: work.id,
        taskId: null,
        generation: null,
        kind,
        detail: { workerRunId: runId, attempt },
        createdAt: new Date().toISOString(),
      });
    append("run_a", "WORKER_RESULT_SUBMITTED", 1);
    append("run_a", "WORKER_RESULT_SUBMITTED", 2);
    append("run_b", "WORKER_REVIEW_RESULT_SUBMITTED", 1);

    const submitted = store.resultSubmissionForRun("run_a");
    assert.equal(submitted.detail.workerRunId, "run_a");
    assert.equal(submitted.detail.attempt, 2, "the newest delivery answers, never an older one");
    const review = store.reviewResultSubmissionForRun("run_b");
    assert.equal(review.detail.workerRunId, "run_b");
    assert.equal(store.resultSubmissionForRun("run_b"), null);
    assert.equal(store.reviewResultSubmissionForRun("run_a"), null);
    assert.ok(
      store.db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='activity_kind_sequence'")
        .get(),
      "the delivery read walks an index, not the whole stream",
    );
  } finally {
    cleanup();
  }
});
