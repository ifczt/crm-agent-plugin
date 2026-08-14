import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { CREDENTIAL_TARGET } from "./constants.js";

const scriptPath = fileURLToPath(new URL("../scripts/credential-store.ps1", import.meta.url));

function runPowerShell(action, input = "") {
  if (process.platform !== "win32") {
    const error = new Error("crm-cli credential storage currently requires Windows");
    error.code = "UNSUPPORTED_PLATFORM";
    throw error;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, action, CREDENTIAL_TARGET],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      const error = new Error(stderr.trim() || `credential helper exited with ${code}`);
      error.code = "CREDENTIAL_STORE_ERROR";
      reject(error);
    });
    child.stdin.end(input, "utf8");
  });
}

export async function loadCredentialRecord() {
  const raw = await runPowerShell("get");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("stored CRM credential data is invalid; run crm-cli auth logout");
    error.code = "CREDENTIAL_DATA_INVALID";
    throw error;
  }
}

export async function saveCredentialRecord(record) {
  await runPowerShell("set", JSON.stringify(record));
}

export async function deleteCredentialRecord() {
  await runPowerShell("delete");
}
