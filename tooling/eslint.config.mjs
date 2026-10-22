// Dev-only lint baseline — config lives inside tooling/ next to its own
// dependencies (@eslint/js, globals resolve from tooling/node_modules), while
// the root manifest stays dependency-free (bootstrap test pins that).
//
// INVOCATION CONTRACT: always run from the repository root, as the npm script
// does — flat-config pattern matching below is CWD-relative (repo root), and
// the root npm script invokes tooling's own eslint binary with --config.
//
//   npm run lint        →  node tooling/node_modules/eslint/bin/eslint.js
//                          --config tooling/eslint.config.mjs .
//
// Ground rules honored here:
//   - ESLint is a tooling devDependency; the zero-third-party-runtime-dependency
//     rule (AGENTS.md charter, scripts/check.mjs §5) applies to core imports and
//     is unaffected by dev tooling.
//   - Starts from `recommended` with a few deliberate tightenings, not a rule
//     avalanche. Tighten gradually; every new rule must pass the suite first.
//
// Known debt, deliberately at "warn" (promote in dedicated batches):
//   - preserve-caught-error: new-in-ESLint-10 rule; 5 legacy catch sites in
//     desktop secret/lifecycle code should gain `{ cause }` attachments.
//   - no-unused-vars in tests/ and apps/: clean per-module instead of one
//     sweeping commit.
import eslint from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

// Plain browser scripts (no bundler, no framework): DOM + window globals.
const browserSources = {
  files: [
    "apps/workspace/**/*.js",
    "apps/employee/**/*.js",
    "apps/desktop/src/**/*.js",
  ],
  languageOptions: { globals: { ...globals.browser } },
};

// Node sources: everything ESM run by Node, including tests and scripts.
const nodeSources = {
  files: ["**/*.mjs"],
  languageOptions: { globals: { ...globals.node } },
};

// The apps/ directory mixes Node servers (server.mjs) and browser pages
// (app.mjs, *.js) under one tree. Classifying every file today buys little:
// grant the union until per-file environments are worth the churn.
const appSources = {
  files: [
    "apps/workspace/**/*.mjs",
    "apps/employee/**/*.mjs",
    "apps/desktop/src/**/*.mjs",
    "apps/shared/local-origin.mjs",
  ],
  languageOptions: { globals: { ...globals.node, ...globals.browser } },
};

const debtScopes = {
  files: ["tests/**/*.mjs", "apps/**"],
  rules: { "no-unused-vars": "warn" },
};

const strictRules = {
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    eqeqeq: ["error", "smart"],
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": ["error", "properties"],
    "preserve-caught-error": "warn",
  },
};

export default defineConfig(
  {
    ignores: [
      "node_modules/",
      "tooling/node_modules/",
      "apps/desktop/dist/",
      "apps/desktop/node_modules/",
      "coverage/",
      "**/assets/**",
      "reports/",
    ],
  },
  eslint.configs.recommended,
  nodeSources,
  browserSources,
  appSources,
  strictRules,
  debtScopes,
);
