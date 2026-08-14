import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { UPDATE_SOURCE } from "./constants.js";

const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
const manifestUrl = "https://raw.githubusercontent.com/ifczt/crm-agent-plugin/main/package.json";

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

export async function currentVersion() {
  return JSON.parse(await fs.readFile(packagePath, "utf8")).version;
}

export async function updateNotice() {
  try {
    const current = await currentVersion();
    const response = await fetch(manifestUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return undefined;
    const latest = (await response.json()).version;
    if (!latest || compareVersions(latest, current) <= 0) return undefined;
    return {
      current_version: current,
      latest_version: latest,
      message: `crm-cli ${latest} is available`,
      command: `npm install --global ${UPDATE_SOURCE}; crm-cli setup`,
    };
  } catch {
    return undefined;
  }
}

export { compareVersions };
