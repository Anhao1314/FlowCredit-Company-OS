// One deliberately small fan-out/fan-in shape. This is a proposal boundary,
// not a Swarm entity or a general DAG language. Runtime mints the Task IDs.
import { isCapability } from "../workforce/capabilities.mjs";
import { BOUNDS } from "./records.mjs";
import { boundedTrimmedText, hasExactlyKeys } from "./validation.mjs";

export const BOUNDED_SWARM_PARALLELISM = 3;
export const BOUNDED_SWARM_TASKS = 4;

const fields = ["taskKind", "title", "intent", "requiredCapabilities", "reviewCapabilities", "dependsOn"];
const invalid = (reason) => ({ ok: false, code: "INVALID_PROPOSAL", message: reason });

export function validateBoundedSwarmProposal(proposal) {
  if (!hasExactlyKeys(proposal, ["planKind", "tasks"]) || proposal.planKind !== "BOUNDED_FAN_IN" ||
      !Array.isArray(proposal.tasks) || proposal.tasks.length !== BOUNDED_SWARM_TASKS)
    return invalid("bounded fan-in requires exactly three source Tasks and one synthesis Task");
  const roles = new Set();
  for (let index = 0; index < BOUNDED_SWARM_TASKS; index += 1) {
    const task = proposal.tasks[index];
    if (!hasExactlyKeys(task, fields) || task.taskKind !== "EXECUTION" ||
        !boundedTrimmedText(task.title, BOUNDS.taskTitleMax) || !boundedTrimmedText(task.intent, BOUNDS.taskIntentMax) ||
        !Array.isArray(task.requiredCapabilities) || task.requiredCapabilities.length !== 1 ||
        !isCapability(task.requiredCapabilities[0]) || roles.has(task.requiredCapabilities[0]) ||
        !Array.isArray(task.reviewCapabilities) ||
        task.reviewCapabilities.some((capability) => !isCapability(capability)) ||
        !Array.isArray(task.dependsOn)) return invalid("invalid bounded Task or capability");
    roles.add(task.requiredCapabilities[0]);
    if (index < BOUNDED_SWARM_PARALLELISM) {
      if (task.dependsOn.length !== 0 || task.reviewCapabilities.length !== 0)
        return invalid("source Tasks must be independent and have no individual review");
    } else if (task.dependsOn.length !== BOUNDED_SWARM_PARALLELISM ||
        task.dependsOn.some((dependency, position) => dependency !== position) ||
        task.reviewCapabilities.length !== 1)
      return invalid("synthesis must depend on all three sources and require independent review");
  }
  return { ok: true, proposal };
}
