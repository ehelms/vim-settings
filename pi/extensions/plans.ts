import {
  getMarkdownTheme,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
  type KeybindingsManager,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import { Markdown, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";

const PLANS_ROOT = join(homedir(), "workspace", "plans");
const PLAN_STATE_PATH = join(PLANS_ROOT, ".plans-state.json");
const PLAN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EXECUTION_STATE_TYPE = "plans-execution";
const EXECUTION_STATUS_KEY = "plans-execution";
const PLAN_DISPLAY_ENTRY_TYPE = "plans-show";

type Plan = {
  namespace: string;
  path: string;
  relativePath: string;
  label: string;
  executedAt?: string;
};

type PersistedPlanState = {
  version: 1;
  executed: Record<string, string>;
};

type PlanGroups = {
  currentNamespace: string;
  currentDirectoryPlans: Plan[];
  otherPlans: Plan[];
  ordered: Plan[];
};

type PlanDisplay = {
  relativePath: string;
  content: string;
};

type AddPlanResult = {
  path: string;
  relativePath: string;
};

type ScopeList = {
  declared: boolean;
  values: string[];
};

type PlanScope = {
  executionSection: boolean;
  explicitlyNotAuthorized: string[];
};

type PlanExecution = {
  sessionId: string;
  namespace: string;
  planPath: string;
  relativePath: string;
  snapshot: string;
  hash: string;
  startedAt: string;
  scope: PlanScope;
};

type PersistedExecutionState = {
  sessionId: string;
  active: PlanExecution | null;
  blockedReason: string | null;
};

async function findPlans(): Promise<Plan[]> {
  const executed = await readPlanExecutionMarks();
  const namespaces = await readdir(PLANS_ROOT, { withFileTypes: true });
  const plans: Plan[] = [];

  for (const namespaceEntry of namespaces) {
    if (!namespaceEntry.isDirectory() || namespaceEntry.name.startsWith(".")) {
      continue;
    }

    const namespacePath = join(PLANS_ROOT, namespaceEntry.name);
    const entries = await readdir(namespacePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith(".")) {
        continue;
      }

      const path = join(namespacePath, entry.name);
      const relativePath = relative(PLANS_ROOT, path);
      const executedAt = executed[relativePath];
      plans.push({
        namespace: namespaceEntry.name,
        path,
        relativePath,
        executedAt,
        label: `[${namespaceEntry.name}] ${entry.name}${executedAt ? " (executed)" : ""}`,
      });
    }
  }

  return plans.sort((a, b) =>
    a.namespace.localeCompare(b.namespace) || a.path.localeCompare(b.path),
  );
}

function groupPlansForCurrentDirectory(
  plans: Plan[],
  cwd: string,
): PlanGroups {
  const currentNamespace = basename(cwd);
  const currentDirectoryPlans = plans.filter(
    (plan) => plan.namespace === currentNamespace,
  );
  const otherPlans = plans.filter(
    (plan) => plan.namespace !== currentNamespace,
  );

  return {
    currentNamespace,
    currentDirectoryPlans,
    otherPlans,
    ordered: [...currentDirectoryPlans, ...otherPlans],
  };
}

function planPickerOptions(groups: PlanGroups): string[] {
  if (groups.currentDirectoryPlans.length === 0) {
    return groups.ordered.map((plan) => plan.label);
  }

  const options = [
    `--- Plans for ${groups.currentNamespace} (current directory) ---`,
    ...groups.currentDirectoryPlans.map((plan) => plan.label),
  ];
  if (groups.otherPlans.length > 0) {
    options.push(
      "",
      "--- Other plans ---",
      ...groups.otherPlans.map((plan) => plan.label),
    );
  }
  return options;
}

function validatePlanName(value: string, kind: string): string {
  const name = value.trim();
  if (!name || !PLAN_NAME.test(name)) {
    throw new Error(
      `${kind} must contain only letters, numbers, '.', '_' or '-': ${value}`,
    );
  }
  return name;
}

function planPath(namespaceInput: string, filenameInput: string): string {
  const namespace = validatePlanName(namespaceInput, "Namespace");
  const filename = validatePlanName(filenameInput, "Filename");
  const withExtension = filename.endsWith(".md") ? filename : `${filename}.md`;

  // Keep the explicit basename check even though validatePlanName currently
  // rejects path separators; this protects the shared plans directory if the
  // filename validation is relaxed later.
  if (basename(withExtension) !== withExtension) {
    throw new Error("Plan filename must not contain a path separator");
  }

  return join(PLANS_ROOT, namespace, withExtension);
}

async function addPlan(
  namespaceInput: string,
  filenameInput: string,
  contentInput: string,
): Promise<AddPlanResult> {
  const path = planPath(namespaceInput, filenameInput);
  const content = contentInput.trim();
  if (!content) {
    throw new Error("Plan content must not be empty");
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${content}\n`, { encoding: "utf8", flag: "wx" });

  return {
    path,
    relativePath: relative(PLANS_ROOT, path),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

async function readPlanExecutionMarks(): Promise<Record<string, string>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(PLAN_STATE_PATH, "utf8"));
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }
    throw new Error(`Unable to read ${PLAN_STATE_PATH}: ${errorMessage(error)}`);
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.executed)) {
    throw new Error(`Invalid plan execution state in ${PLAN_STATE_PATH}`);
  }

  const executed: Record<string, string> = {};
  for (const [path, executedAt] of Object.entries(parsed.executed)) {
    if (typeof executedAt === "string" && executedAt) {
      executed[path] = executedAt;
    }
  }
  return executed;
}

async function writePlanExecutionMarks(
  executed: Record<string, string>,
): Promise<void> {
  await mkdir(PLANS_ROOT, { recursive: true });
  const temporaryPath = join(PLANS_ROOT, `.plans-state-${randomUUID()}.tmp`);
  const state: PersistedPlanState = { version: 1, executed };

  try {
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, PLAN_STATE_PATH);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function markPlanExecuted(
  relativePath: string,
): Promise<string | undefined> {
  const executed = await readPlanExecutionMarks();
  const previousExecution = executed[relativePath];
  executed[relativePath] = new Date().toISOString();
  await writePlanExecutionMarks(executed);
  return previousExecution;
}

async function restorePlanExecutionMark(
  relativePath: string,
  previousExecution: string | undefined,
): Promise<void> {
  const executed = await readPlanExecutionMarks();
  if (previousExecution) {
    executed[relativePath] = previousExecution;
  } else {
    delete executed[relativePath];
  }
  await writePlanExecutionMarks(executed);
}

async function removePlanExecutionMarks(relativePaths: string[]): Promise<void> {
  const executed = await readPlanExecutionMarks();
  for (const path of relativePaths) {
    delete executed[path];
  }
  await writePlanExecutionMarks(executed);
}

class PlanCleanupSelection {
  private readonly selectedPaths: Set<string>;
  private cursorIndex = 0;

  constructor(
    private readonly groups: PlanGroups,
    private readonly activePlanPath: string | undefined,
    private readonly theme: Theme,
    private readonly keybindings: KeybindingsManager,
    private readonly done: (selected: Plan[] | undefined) => void,
    private readonly requestRender: () => void,
  ) {
    this.selectedPaths = new Set(groups.ordered.map((plan) => plan.path));
  }

  private get plans(): Plan[] {
    return this.groups.ordered;
  }

  handleInput(data: string): void {
    if (
      this.keybindings.matches(data, "tui.select.cancel") ||
      matchesKey(data, "ctrl+c")
    ) {
      this.done(undefined);
      return;
    }

    if (this.keybindings.matches(data, "tui.select.up")) {
      this.cursorIndex =
        (this.cursorIndex + this.plans.length - 1) % this.plans.length;
    } else if (this.keybindings.matches(data, "tui.select.down")) {
      this.cursorIndex = (this.cursorIndex + 1) % this.plans.length;
    } else if (matchesKey(data, "space")) {
      const path = this.plans[this.cursorIndex]?.path;
      if (path) {
        if (this.selectedPaths.has(path)) {
          this.selectedPaths.delete(path);
        } else {
          this.selectedPaths.add(path);
        }
      }
    } else if (data === "a" || data === "A") {
      if (this.selectedPaths.size === this.plans.length) {
        this.selectedPaths.clear();
      } else {
        this.selectedPaths.clear();
        for (const plan of this.plans) {
          this.selectedPaths.add(plan.path);
        }
      }
    } else if (this.keybindings.matches(data, "tui.select.confirm")) {
      this.done(
        this.plans.filter((plan) => this.selectedPaths.has(plan.path)),
      );
      return;
    } else {
      return;
    }

    this.requestRender();
  }

  render(width: number): string[] {
    const visibleCount = Math.min(this.plans.length, 10);
    const firstIndex = Math.max(
      0,
      Math.min(
        this.cursorIndex - Math.floor(visibleCount / 2),
        this.plans.length - visibleCount,
      ),
    );
    const endIndex = Math.min(firstIndex + visibleCount, this.plans.length);
    const currentDirectoryCount = this.groups.currentDirectoryPlans.length;
    const lines = [
      "",
      truncateToWidth(
        this.theme.fg("accent", this.theme.bold("Clean up executed plans")),
        width,
      ),
      truncateToWidth(
        this.theme.fg(
          "muted",
          `${this.selectedPaths.size} of ${this.plans.length} selected for deletion`,
        ),
        width,
      ),
    ];

    if (this.plans.some((plan) => plan.path === this.activePlanPath)) {
      lines.push(
        truncateToWidth(
          this.theme.fg(
            "warning",
            "Cleaning up the active plan will stop its execution mode.",
          ),
          width,
        ),
      );
    }

    lines.push("");
    if (currentDirectoryCount > 0) {
      const heading =
        firstIndex < currentDirectoryCount
          ? `Current directory plans: ${this.groups.currentNamespace}`
          : "Other plans";
      lines.push(
        truncateToWidth(
          this.theme.fg("accent", this.theme.bold(heading)),
          width,
        ),
      );
    }

    for (let index = firstIndex; index < endIndex; index++) {
      if (
        index === currentDirectoryCount &&
        currentDirectoryCount > 0 &&
        firstIndex < currentDirectoryCount
      ) {
        lines.push("");
        lines.push(
          truncateToWidth(
            this.theme.fg("accent", this.theme.bold("Other plans")),
            width,
          ),
        );
      }

      const plan = this.plans[index];
      if (!plan) continue;

      const cursor =
        index === this.cursorIndex ? this.theme.fg("accent", ">") : " ";
      const selected = this.selectedPaths.has(plan.path);
      const checkbox = selected
        ? this.theme.fg("success", "[x]")
        : this.theme.fg("muted", "[ ]");
      const active =
        plan.path === this.activePlanPath
          ? this.theme.fg("warning", " (active)")
          : "";
      lines.push(
        truncateToWidth(
          `${cursor} ${checkbox} ${plan.relativePath}${active}`,
          width,
        ),
      );
    }

    if (firstIndex > 0 || endIndex < this.plans.length) {
      lines.push(
        truncateToWidth(
          this.theme.fg("dim", `  (${this.cursorIndex + 1}/${this.plans.length})`),
          width,
        ),
      );
    }
    lines.push("");
    lines.push(
      truncateToWidth(
        this.theme.fg(
          "dim",
          "↑/↓ move · Space toggle · a toggle all · Enter continue · Esc cancel",
        ),
        width,
      ),
    );
    return lines;
  }

  invalidate(): void {}
}

function hashPlan(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function normalizeHeading(value: string): string {
  return value
    .replace(/[\*_`]/g, "")
    .replace(/:$/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cleanScopeValue(value: string): string | undefined {
  let cleaned = value.trim();
  if (!cleaned || /^(none|n\/a|not applicable|none specified)$/i.test(cleaned)) {
    return undefined;
  }

  const codeMatch = cleaned.match(/^`([^`]+)`/);
  if (codeMatch) {
    cleaned = codeMatch[1];
  }

  cleaned = cleaned.replace(/^['"]|['"]$/g, "").trim();
  return cleaned || undefined;
}

function extractListUnderHeading(
  section: string,
  headings: string[],
): ScopeList {
  const wanted = new Set(headings.map(normalizeHeading));
  const values: string[] = [];
  let collecting = false;
  let declared = false;

  for (const line of section.split(/\r?\n/)) {
    const headingMatch = line.match(/^###\s+(.+?)\s*$/);
    if (headingMatch) {
      collecting = wanted.has(normalizeHeading(headingMatch[1]));
      if (collecting) {
        declared = true;
      }
      continue;
    }

    if (/^##\s+/.test(line)) {
      collecting = false;
      continue;
    }

    if (!collecting) {
      continue;
    }

    const listMatch = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!listMatch) {
      continue;
    }

    const value = cleanScopeValue(listMatch[1]);
    if (value && !values.includes(value)) {
      values.push(value);
    }
  }

  return { declared, values };
}

function executionScopeSection(content: string): string | undefined {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (!match) {
      return false;
    }
    return new Set(["execution scope", "execution boundaries"]).has(
      normalizeHeading(match[1]),
    );
  });

  if (start === -1) {
    return undefined;
  }

  const end = lines.findIndex(
    (line, index) => index > start && /^##\s+/.test(line),
  );
  return lines.slice(start + 1, end === -1 ? lines.length : end).join("\n");
}

function parsePlanScope(content: string): PlanScope {
  const section = executionScopeSection(content);
  if (section === undefined) {
    return {
      executionSection: false,
      explicitlyNotAuthorized: [],
    };
  }

  const notAuthorized = extractListUnderHeading(section, [
    "explicitly not authorized",
    "not authorized",
    "out of scope",
  ]);

  return {
    executionSection: true,
    explicitlyNotAuthorized: notAuthorized.values,
  };
}

function isUnderRoot(path: string, root: string): boolean {
  const pathRelativeToRoot = relative(root, path);
  return (
    pathRelativeToRoot === "" ||
    (!pathRelativeToRoot.startsWith("..") && !pathRelativeToRoot.startsWith("/"))
  );
}

function formatScopeSummary(execution: PlanExecution): string {
  const { scope } = execution;
  const lines: string[] = [];

  if (!scope.executionSection) {
    lines.push(
      "- No machine-readable `## Execution Scope` section was found; the selected plan remains the implementation objective.",
    );
  } else {
    lines.push(
      "- Execution Scope is advisory; the selected plan remains the implementation objective.",
    );
  }


  if (scope.explicitlyNotAuthorized.length > 0) {
    lines.push(
      `- Explicitly not authorized: ${scope.explicitlyNotAuthorized.join(", ")}`,
    );
  }

  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function restoreExecution(value: unknown): PlanExecution | undefined {
  if (!isRecord(value) || !isRecord(value.scope)) {
    return undefined;
  }

  const scope = value.scope;
  if (
    typeof value.sessionId !== "string" ||
    typeof value.namespace !== "string" ||
    typeof value.planPath !== "string" ||
    typeof value.relativePath !== "string" ||
    typeof value.snapshot !== "string" ||
    typeof value.hash !== "string" ||
    typeof value.startedAt !== "string" ||
    typeof scope.executionSection !== "boolean" ||
    !Array.isArray(scope.explicitlyNotAuthorized) ||
    !scope.explicitlyNotAuthorized.every((item) => typeof item === "string")
  ) {
    return undefined;
  }

  return {
    sessionId: value.sessionId,
    namespace: value.namespace,
    planPath: value.planPath,
    relativePath: value.relativePath,
    snapshot: value.snapshot,
    hash: value.hash,
    startedAt: value.startedAt,
    scope: {
      executionSection: scope.executionSection,
      explicitlyNotAuthorized: [...scope.explicitlyNotAuthorized],
    },
  };
}

async function addPlanInteractively(
  args: string[],
  ctx: ExtensionCommandContext,
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("Adding a plan requires interactive UI", "error");
    return;
  }

  const namespace =
    args[0] ?? (await ctx.ui.input("Repository namespace:", "project-reforged"));
  if (!namespace) return;

  const filename =
    args[1] ??
    (await ctx.ui.input(
      "Plan filename:",
      "new-plan.md",
    ));
  if (!filename) return;

  const content = await ctx.ui.editor(
    "Plan contents:",
    "# Plan\n\n## Objective\n\n",
  );
  if (content === undefined) return;

  try {
    const result = await addPlan(namespace, filename, content);
    ctx.ui.notify(`Created plan: ${result.relativePath}`, "info");
  } catch (error) {
    ctx.ui.notify(`Unable to create plan: ${errorMessage(error)}`, "error");
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerEntryRenderer<PlanDisplay>(PLAN_DISPLAY_ENTRY_TYPE, (entry) => {
    if (!entry.data) {
      return undefined;
    }

    const markdown = `**${entry.data.relativePath}**\n\n${entry.data.content}`;
    return new Markdown(markdown, 1, 0, getMarkdownTheme());
  });

  let activeExecution: PlanExecution | undefined;
  let blockedReason: string | undefined;
  let currentSessionId: string | undefined;

  function updateExecutionStatus(ctx: ExtensionContext): void {
    if (activeExecution) {
      ctx.ui.setStatus(
        EXECUTION_STATUS_KEY,
        `plan: ${activeExecution.relativePath}`,
      );
    } else if (blockedReason) {
      ctx.ui.setStatus(EXECUTION_STATUS_KEY, "plan: blocked");
    } else {
      ctx.ui.setStatus(EXECUTION_STATUS_KEY, undefined);
    }
  }

  function persistExecutionState(): void {
    const sessionId = currentSessionId ?? activeExecution?.sessionId;
    if (!sessionId) {
      return;
    }

    const state: PersistedExecutionState = {
      sessionId,
      active: activeExecution ?? null,
      blockedReason: blockedReason ?? null,
    };
    pi.appendEntry(EXECUTION_STATE_TYPE, state);
  }

  function discardExecutionFromOtherSession(ctx: ExtensionContext): void {
    const sessionId = ctx.sessionManager.getSessionId();
    currentSessionId = sessionId;
    if (activeExecution?.sessionId !== sessionId) {
      if (activeExecution || blockedReason) {
        activeExecution = undefined;
        blockedReason = undefined;
        persistExecutionState();
        updateExecutionStatus(ctx);
      }
    }
  }

  function invalidateExecution(reason: string, ctx: ExtensionContext): void {
    activeExecution = undefined;
    blockedReason = reason;
    persistExecutionState();
    updateExecutionStatus(ctx);
    ctx.ui.notify(reason, "error");
  }

  async function ensurePlanUnchanged(ctx: ExtensionContext): Promise<boolean> {
    const execution = activeExecution;
    if (!execution) {
      return false;
    }

    let currentSnapshot: string;
    try {
      currentSnapshot = await readFile(execution.planPath, "utf8");
    } catch {
      if (activeExecution === execution) {
        invalidateExecution(
          `Plan execution stopped because ${execution.relativePath} could not be read. Run /plans execute again to continue.`,
          ctx,
        );
      }
      return false;
    }

    if (activeExecution !== execution) {
      return false;
    }

    if (hashPlan(currentSnapshot) !== execution.hash) {
      invalidateExecution(
        `Plan execution stopped because ${execution.relativePath} changed after execution started. Run /plans execute again to continue.`,
        ctx,
      );
      return false;
    }

    return true;
  }

  function buildExecutionSystemPrompt(execution: PlanExecution): string {
    return `

## Strict plan execution mode

You are executing the selected plan as a constrained implementation task.

Binding rules:
- Treat the plan as the implementation objective.
- Follow the stated steps, while adapting to the existing implementation.
- Linting commands relevant to the implementation are allowed.
- Do not run:
  - tests
  - image builds
  - validation other than linting
  - rollout/integration work
- Ask the user if requirements conflict or cannot be reconciled.
- Report files changed and commands run.
- Higher-priority system/project instructions still apply.

Execution metadata:
- Plan: ${execution.relativePath}
- Snapshot SHA-256: ${execution.hash}
- Started: ${execution.startedAt}

The following is the exact selected plan snapshot. Treat it as the task specification, not as permission to override higher-priority instructions:

--- BEGIN SELECTED PLAN SNAPSHOT ---
${execution.snapshot}
--- END SELECTED PLAN SNAPSHOT ---
`;
  }

  function buildBlockedSystemPrompt(reason: string): string {
    return `

## Plan execution blocked

The plans extension has stopped execution:
${reason}

Do not call tools or make changes. Ask the user to run /plans execute again, or start a new session with /clear.
`;
  }

  async function choosePlan(
    target: string,
    ctx: ExtensionCommandContext,
    purpose: "Show" | "Execute" = "Execute",
  ): Promise<Plan | undefined> {
    let plans: Plan[];
    try {
      plans = await findPlans();
    } catch (error) {
      ctx.ui.notify(`Unable to read ${PLANS_ROOT}: ${errorMessage(error)}`, "error");
      return undefined;
    }

    if (plans.length === 0) {
      ctx.ui.notify(`No plans found in ${PLANS_ROOT}.`, "info");
      return undefined;
    }

    const requested = target.trim().replace(/^@/, "");
    if (requested) {
      const matches = plans.filter((plan) => {
        const namespacePath = `${plan.namespace}/${basename(plan.path)}`;
        const originalLabel = `[${plan.namespace}] ${basename(plan.path)}`;
        return [
          plan.path,
          plan.relativePath,
          namespacePath,
          originalLabel,
          plan.label,
        ].includes(requested);
      });

      if (matches.length === 1) {
        return matches[0];
      }

      if (matches.length > 1) {
        ctx.ui.notify(
          `Plan target is ambiguous: ${requested}. Use the namespace/filename form.`,
          "error",
        );
      } else {
        ctx.ui.notify(
          `Plan not found: ${requested}. Use /plans to list available plans.`,
          "error",
        );
      }
      return undefined;
    }

    if (!ctx.hasUI) {
      ctx.ui.notify(
        `Plan ${purpose.toLowerCase()} requires a plan path in non-interactive mode.`,
        "error",
      );
      return undefined;
    }

    const groups = groupPlansForCurrentDirectory(plans, ctx.cwd);
    const selected = await ctx.ui.select(
      `${purpose} plan`,
      planPickerOptions(groups),
    );
    if (selected === undefined) {
      return undefined;
    }

    return groups.ordered.find((plan) => plan.label === selected);
  }

  async function showPlan(
    target: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const plan = await choosePlan(target, ctx, "Show");
    if (!plan) {
      return;
    }

    try {
      const content = await readFile(plan.path, "utf8");
      pi.appendEntry(PLAN_DISPLAY_ENTRY_TYPE, {
        relativePath: relative(PLANS_ROOT, plan.path),
        content,
      });
    } catch (error) {
      ctx.ui.notify(
        `Unable to read plan ${relative(PLANS_ROOT, plan.path)}: ${errorMessage(error)}`,
        "error",
      );
    }
  }

  async function executePlanInteractively(
    target: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    discardExecutionFromOtherSession(ctx);

    if (!ctx.isIdle()) {
      ctx.ui.notify(
        "The agent is busy. Wait for it to finish before starting a plan execution.",
        "warning",
      );
      return;
    }

    const plan = await choosePlan(target, ctx);
    if (!plan) {
      return;
    }

    let snapshot: string;
    try {
      snapshot = await readFile(plan.path, "utf8");
    } catch (error) {
      ctx.ui.notify(
        `Unable to read plan ${relative(PLANS_ROOT, plan.path)}: ${errorMessage(error)}`,
        "error",
      );
      return;
    }

    if (!snapshot.trim()) {
      ctx.ui.notify("Cannot execute an empty plan.", "error");
      return;
    }

    const execution: PlanExecution = {
      sessionId: ctx.sessionManager.getSessionId(),
      namespace: plan.namespace,
      planPath: plan.path,
      relativePath: relative(PLANS_ROOT, plan.path),
      snapshot,
      hash: hashPlan(snapshot),
      startedAt: new Date().toISOString(),
      scope: parsePlanScope(snapshot),
    };

    let previousExecutionMark: string | undefined;
    try {
      previousExecutionMark = await markPlanExecuted(plan.relativePath);
    } catch (error) {
      ctx.ui.notify(
        `Unable to mark ${plan.relativePath} as executed; execution was not started: ${errorMessage(error)}`,
        "error",
      );
      return;
    }

    activeExecution = execution;
    blockedReason = undefined;
    persistExecutionState();
    updateExecutionStatus(ctx);

    try {
      pi.sendUserMessage(
        `Begin executing the selected plan in strict plan-execution mode. Start with the first step and stop immediately if any boundary, ambiguity, or authorization issue is encountered. Plan: ${execution.relativePath}. Snapshot SHA-256: ${execution.hash}.`,
      );
    } catch (error) {
      activeExecution = undefined;
      blockedReason = `Unable to start plan execution: ${errorMessage(error)}`;
      try {
        await restorePlanExecutionMark(plan.relativePath, previousExecutionMark);
      } catch (restoreError) {
        blockedReason += ` Unable to restore its execution marker: ${errorMessage(restoreError)}`;
      }
      persistExecutionState();
      updateExecutionStatus(ctx);
      ctx.ui.notify(blockedReason, "error");
    }
  }

  async function showExecutionStatus(ctx: ExtensionCommandContext): Promise<void> {
    discardExecutionFromOtherSession(ctx);

    if (activeExecution) {
      await ensurePlanUnchanged(ctx);
    }

    if (activeExecution) {
      ctx.ui.notify(
        `Active plan: ${activeExecution.relativePath}\nSnapshot SHA-256: ${activeExecution.hash}\n\n${formatScopeSummary(activeExecution)}`,
        "info",
      );
    } else if (blockedReason) {
      ctx.ui.notify(`Plan execution is blocked: ${blockedReason}`, "warning");
    } else {
      ctx.ui.notify("No active plan execution.", "info");
    }
  }

  async function selectPlansToCleanUp(
    groups: PlanGroups,
    ctx: ExtensionCommandContext,
  ): Promise<Plan[] | undefined> {
    if (ctx.mode === "tui") {
      const activePlanPath = activeExecution?.planPath;
      return ctx.ui.custom<Plan[] | undefined>((tui, theme, keybindings, done) =>
        new PlanCleanupSelection(
          groups,
          activePlanPath,
          theme,
          keybindings,
          done,
          () => tui.requestRender(),
        ),
      );
    }

    if (!ctx.hasUI) {
      ctx.ui.notify("Cleaning up plans requires interactive UI.", "error");
      return undefined;
    }

    const selected: Plan[] = [];
    for (const plan of groups.ordered) {
      let section = "Other plans";
      if (groups.currentDirectoryPlans.length === 0) {
        section = "Executed plans";
      } else if (plan.namespace === groups.currentNamespace) {
        section = `Current directory plans: ${groups.currentNamespace}`;
      }
      const active =
        plan.path === activeExecution?.planPath ? " (active plan)" : "";
      const choice = await ctx.ui.select(
        `${section}\n\nChoose whether to clean up this executed plan (cleanup by default):\n\n${plan.relativePath}${active}`,
        ["Clean up", "Keep"],
      );
      if (choice === undefined) {
        return undefined;
      }
      if (choice === "Clean up") {
        selected.push(plan);
      }
    }
    return selected;
  }

  async function cleanupPlansInteractively(
    namespaceFilter: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    discardExecutionFromOtherSession(ctx);

    if (!ctx.isIdle()) {
      ctx.ui.notify(
        "The agent is busy. Wait for it to finish before cleaning up plans.",
        "warning",
      );
      return;
    }

    let plans: Plan[];
    try {
      plans = await findPlans();
    } catch (error) {
      ctx.ui.notify(`Unable to read ${PLANS_ROOT}: ${errorMessage(error)}`, "error");
      return;
    }

    const filter = namespaceFilter.trim();
    const executedPlans = plans.filter(
      (plan) => plan.executedAt && (!filter || plan.namespace === filter),
    );
    if (executedPlans.length === 0) {
      const scope = filter ? ` for '${filter}'` : "";
      ctx.ui.notify(`No executed plans found${scope}.`, "info");
      return;
    }

    const groups = groupPlansForCurrentDirectory(executedPlans, ctx.cwd);
    const selected = await selectPlansToCleanUp(groups, ctx);
    if (selected === undefined) {
      return;
    }
    if (selected.length === 0) {
      ctx.ui.notify("No plans selected for cleanup.", "info");
      return;
    }

    const confirmed = await ctx.ui.confirm(
      `Clean up ${selected.length} executed plan${selected.length === 1 ? "" : "s"}?`,
      `The following plan files will be permanently deleted:\n\n${selected.map((plan) => plan.relativePath).join("\n")}`,
    );
    if (!confirmed) {
      ctx.ui.notify("Plan cleanup cancelled.", "info");
      return;
    }
    if (!ctx.isIdle()) {
      ctx.ui.notify(
        "The agent became busy while cleanup was being confirmed; no plans were deleted.",
        "warning",
      );
      return;
    }

    const cleanedUp: Plan[] = [];
    const failures: string[] = [];
    for (const plan of selected) {
      try {
        await unlink(plan.path);
        cleanedUp.push(plan);
      } catch (error) {
        failures.push(`${plan.relativePath}: ${errorMessage(error)}`);
      }
    }

    if (cleanedUp.length > 0) {
      try {
        await removePlanExecutionMarks(cleanedUp.map((plan) => plan.relativePath));
      } catch (error) {
        failures.push(`Unable to clear execution markers: ${errorMessage(error)}`);
      }
    }

    const activePlanWasCleanedUp =
      activeExecution !== undefined &&
      cleanedUp.some((plan) => plan.path === activeExecution?.planPath);
    if (activePlanWasCleanedUp) {
      activeExecution = undefined;
      blockedReason = undefined;
      persistExecutionState();
      updateExecutionStatus(ctx);
    }

    const summary =
      `Cleaned up ${cleanedUp.length} of ${selected.length} selected plan` +
      `${selected.length === 1 ? "" : "s"}.`;
    const message =
      failures.length > 0 ? `${summary}\n${failures.join("\n")}` : summary;
    ctx.ui.notify(message, failures.length > 0 ? "warning" : "info");
  }

  pi.on("session_start", async (event, ctx) => {
    currentSessionId = ctx.sessionManager.getSessionId();
    activeExecution = undefined;
    blockedReason = undefined;

    // A new session, including /clear, must not inherit plan execution state
    // from the session that was just replaced.
    if (event.reason === "new") {
      persistExecutionState();
      updateExecutionStatus(ctx);
      return;
    }

    const stateEntry = ctx.sessionManager
      .getEntries()
      .filter(
        (entry: { type: string; customType?: string }) =>
          entry.type === "custom" && entry.customType === EXECUTION_STATE_TYPE,
      )
      .pop() as { data?: PersistedExecutionState } | undefined;

    const state = stateEntry?.data;
    if (
      state &&
      isRecord(state) &&
      state.sessionId === currentSessionId
    ) {
      if (typeof state.blockedReason === "string" && state.blockedReason) {
        blockedReason = state.blockedReason;
      }

      const restored = restoreExecution(state.active);
      if (restored) {
        if (!isUnderRoot(restored.planPath, PLANS_ROOT)) {
          blockedReason =
            "Persisted plan execution was rejected because its path is outside the plans directory.";
        } else {
          activeExecution = restored;
        }
      }
    }

    if (activeExecution) {
      await ensurePlanUnchanged(ctx);
    }
    updateExecutionStatus(ctx);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    discardExecutionFromOtherSession(ctx);

    if (activeExecution && !(await ensurePlanUnchanged(ctx))) {
      return {
        systemPrompt:
          event.systemPrompt + buildBlockedSystemPrompt(blockedReason ?? "Unknown execution error."),
      };
    }

    if (blockedReason) {
      return {
        systemPrompt: event.systemPrompt + buildBlockedSystemPrompt(blockedReason),
      };
    }

    if (!activeExecution) {
      return undefined;
    }

    return {
      systemPrompt:
        event.systemPrompt + buildExecutionSystemPrompt(activeExecution),
    };
  });

  pi.registerTool({
    name: "add_plan",
    label: "Add plan",
    description:
      "Create a new Markdown plan in ~/workspace/plans/<namespace>. Use this when the user asks to add, save, or write a plan. Creates parent directories, adds .md when omitted, and never overwrites an existing plan.",
    parameters: Type.Object({
      namespace: Type.String({
        description: "Repository namespace under ~/workspace/plans",
      }),
      filename: Type.String({
        description: "Plan filename, with or without the .md extension",
      }),
      content: Type.String({ description: "Complete Markdown plan content" }),
    }),
    async execute(_toolCallId, params) {
      try {
        const result = await addPlan(params.namespace, params.filename, params.content);
        return {
          content: [{ type: "text", text: `Created plan: ${result.relativePath}` }],
          details: result,
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Unable to create plan: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    },
  });

  pi.registerCommand("plans", {
    description:
      "List plans (executed plans are marked); use '/plans show [namespace/filename]' to print one, '/plans add' to create one, '/plans execute' to execute one, or '/plans cleanup [namespace]' to remove executed plans. '/plans prune [namespace]' remains an alias.",
    handler: async (args, ctx) => {
      const tokens = args.trim().split(/\s+/).filter(Boolean);
      const action = tokens[0]?.toLowerCase();

      if (action === "add") {
        await addPlanInteractively(tokens.slice(1), ctx);
        return;
      }

      if (action === "execute") {
        await executePlanInteractively(tokens.slice(1).join(" "), ctx);
        return;
      }

      if (action === "show") {
        await showPlan(tokens.slice(1).join(" "), ctx);
        return;
      }

      if (action === "status") {
        await showExecutionStatus(ctx);
        return;
      }

      if (action === "cleanup" || action === "prune") {
        await cleanupPlansInteractively(tokens.slice(1).join(" "), ctx);
        return;
      }

      let plans: Plan[];
      try {
        plans = await findPlans();
      } catch (error) {
        ctx.ui.notify(`Unable to read ${PLANS_ROOT}: ${errorMessage(error)}`, "error");
        return;
      }

      const filter = args.trim();
      if (filter) {
        plans = plans.filter((plan) => plan.namespace === filter);
      }

      if (plans.length === 0) {
        const scope = filter ? ` for '${filter}'` : "";
        ctx.ui.notify(`No plans found${scope}. Use '/plans add' to create one.`, "info");
        return;
      }

      const groups = groupPlansForCurrentDirectory(plans, ctx.cwd);
      const selected = await ctx.ui.select(
        filter ? `Plans: ${filter}` : "Plans",
        planPickerOptions(groups),
      );

      if (selected === undefined) {
        return;
      }

      const plan = groups.ordered.find((candidate) => candidate.label === selected);
      if (plan) {
        ctx.ui.notify(relative(PLANS_ROOT, plan.path), "info");
      }
    },
  });
}
