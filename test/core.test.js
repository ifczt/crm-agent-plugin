import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { doctorHealthy, parseJson } from "../src/cli.js";
import { parseToolResult } from "../src/mcp-client.js";
import { replaceManagedRule } from "../src/setup.js";
import { compareVersions } from "../src/update-check.js";

test("version comparison handles semantic version components", () => {
  assert.equal(compareVersions("1.2.0", "1.1.9"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
});

test("managed global rule is appended and replaced without duplication", () => {
  const first = replaceManagedRule("# Existing\n\nKeep this.\n");
  const second = replaceManagedRule(first);
  assert.match(first, /Keep this\./);
  assert.equal((first.match(/ifczt-crm:start/g) || []).length, 1);
  assert.equal(second, first);
});

test("managed global rule rejects an incomplete marker block", () => {
  assert.throws(() => replaceManagedRule("<!-- ifczt-crm:start -->"), /incomplete/);
});

test("JSON arguments must be objects", () => {
  assert.deepEqual(parseJson('{"customer_id":7}'), { customer_id: 7 });
  assert.throws(() => parseJson("[]"), /must be a JSON object/);
  assert.throws(() => parseJson("{"), /invalid JSON/);
});

test("MCP text results are decoded as structured JSON", () => {
  assert.deepEqual(
    parseToolResult({ content: [{ type: "text", text: '{"status":"preview"}' }] }),
    { status: "preview" },
  );
  assert.equal(parseToolResult({ content: [{ type: "text", text: "plain" }] }), "plain");
});

test("doctor requires an authenticated tool connection", () => {
  assert.equal(doctorHealthy({
    service: { ok: true },
    auth: { ok: true, authenticated: false },
    tools: { ok: false, skipped: true },
  }), false);
  assert.equal(doctorHealthy({
    service: { ok: true },
    auth: { ok: true, authenticated: true },
    tools: { ok: true },
  }), true);
});

test("Windows credential helper round trips and deletes an isolated record", { skip: process.platform !== "win32" }, () => {
  const script = fileURLToPath(new URL("../scripts/credential-store.ps1", import.meta.url));
  const target = `ifczt-crm-cli-test:${crypto.randomUUID()}`;
  const value = JSON.stringify({ access_token: "test-only", scope: "crm.read" });
  const run = (action, input = "") => spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.resolve(script), action, target],
    { input, encoding: "utf8", windowsHide: true },
  );
  try {
    const set = run("set", value);
    assert.equal(set.status, 0, set.stderr);
    const get = run("get");
    assert.equal(get.status, 0, get.stderr);
    assert.equal(get.stdout, value);
  } finally {
    const remove = run("delete");
    assert.equal(remove.status, 0, remove.stderr);
  }
  assert.equal(run("get").stdout, "");
});
