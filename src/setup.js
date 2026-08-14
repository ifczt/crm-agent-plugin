import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { MANAGED_RULE, MANAGED_RULE_END, MANAGED_RULE_START } from "./constants.js";

const execFileAsync = promisify(execFile);
const packageRoot = fileURLToPath(new URL("../", import.meta.url));

function replaceManagedRule(content) {
  const start = content.indexOf(MANAGED_RULE_START);
  const end = content.indexOf(MANAGED_RULE_END);
  if ((start >= 0) !== (end >= 0) || (start >= 0 && end < start)) {
    const error = new Error("global AGENTS.md contains an incomplete ifczt CRM managed block");
    error.code = "AGENTS_MANAGED_BLOCK_INVALID";
    throw error;
  }
  if (start >= 0) {
    return `${content.slice(0, start)}${MANAGED_RULE}${content.slice(end + MANAGED_RULE_END.length)}`;
  }
  const prefix = content.trimEnd();
  return `${prefix}${prefix ? "\n\n" : ""}${MANAGED_RULE}\n`;
}

async function installSkill() {
  const source = path.join(packageRoot, "skills", "ifczt-crm");
  const destination = path.join(os.homedir(), ".agents", "skills", "ifczt-crm");
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rm(destination, { recursive: true, force: true });
  await fs.cp(source, destination, { recursive: true, force: true });
  return destination;
}

async function installGlobalRule() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const agentsPath = path.join(codexHome, "AGENTS.md");
  await fs.mkdir(codexHome, { recursive: true });
  let current = "";
  try {
    current = await fs.readFile(agentsPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const updated = replaceManagedRule(current);
  if (updated !== current) await fs.writeFile(agentsPath, updated, "utf8");
  return agentsPath;
}

async function registerUpdateTask() {
  if (process.platform !== "win32") return { installed: false, reason: "unsupported platform" };
  const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const updateDirectory = path.join(localRoot, "ifczt-crm-cli");
  const targetScript = path.join(updateDirectory, "update.ps1");
  await fs.mkdir(updateDirectory, { recursive: true });
  await fs.copyFile(path.join(packageRoot, "scripts", "update.ps1"), targetScript);
  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${targetScript.replaceAll("'", "''")}"'; ` +
      "$trigger = New-ScheduledTaskTrigger -Daily -At '03:30'; " +
      "Register-ScheduledTask -TaskName 'ifczt CRM CLI Update' -Action $action -Trigger $trigger -Description 'Update ifczt CRM CLI and global skill' -Force | Out-Null",
    ],
    { windowsHide: true },
  );
  return { installed: true, script: targetScript, task: "ifczt CRM CLI Update" };
}

export async function setup({ skipSchedule = false } = {}) {
  const skill = await installSkill();
  const agents = await installGlobalRule();
  let update = { installed: false, reason: "skipped" };
  if (!skipSchedule) {
    try {
      update = await registerUpdateTask();
    } catch (error) {
      update = { installed: false, reason: error.message };
    }
  }
  return { skill, global_agents: agents, update, restart_required: true };
}

export { replaceManagedRule };
