import { Command, Option } from "commander";

import { authStatus, login, logout } from "./auth.js";
import { MCP_URL, PUBLIC_BASE_URL } from "./constants.js";
import { callTool, listTools } from "./mcp-client.js";
import { setup } from "./setup.js";
import { currentVersion, updateNotice } from "./update-check.js";

function parseJson(value, label = "JSON") {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed;
  } catch (error) {
    if (error.message.endsWith("must be a JSON object")) throw error;
    const next = new Error(`invalid ${label}: ${error.message}`);
    next.code = "INVALID_JSON";
    throw next;
  }
}

async function emit(program, payload) {
  const output = payload && typeof payload === "object" && !Array.isArray(payload)
    ? { ok: true, ...payload }
    : { ok: true, data: payload };
  const notice = await updateNotice();
  if (notice) output._notice = { update: notice };
  const format = program.opts().format;
  process.stdout.write(`${JSON.stringify(output, null, format === "pretty" ? 2 : 0)}\n`);
}

async function invoke(program, name, args = {}) {
  await emit(program, { tool: name, data: await callTool(name, args) });
}

async function doctor() {
  const checks = {};
  try {
    const response = await fetch(`${PUBLIC_BASE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    checks.service = { ok: response.ok, status: response.status, data: response.ok ? await response.json() : null };
  } catch (error) {
    checks.service = { ok: false, error: error.message };
  }
  try {
    checks.auth = { ok: true, ...(await authStatus()) };
  } catch (error) {
    checks.auth = { ok: false, error: error.message };
  }
  if (checks.auth.authenticated) {
    try {
      const result = await listTools();
      checks.tools = { ok: true, count: result.tools.length };
    } catch (error) {
      checks.tools = { ok: false, error: error.message, code: error.code || null };
    }
  } else {
    checks.tools = { ok: false, skipped: true, reason: "authorization required" };
  }
  return { healthy: checks.service.ok && checks.auth.ok && (!checks.auth.authenticated || checks.tools.ok), checks };
}

export async function buildProgram() {
  const version = await currentVersion();
  const program = new Command();
  program
    .name("crm-cli")
    .description("Use the ifczt CRM securely from ChatGPT desktop and Codex")
    .version(version)
    .addOption(new Option("--format <format>", "output format").choices(["json", "pretty"]).default("json"));

  program.command("setup")
    .description("Install the global ChatGPT desktop skill and persistent CRM routing rule")
    .option("--skip-schedule", "do not register the daily update task")
    .action(async (options) => emit(program, { setup: await setup({ skipSchedule: options.skipSchedule }) }));

  const auth = program.command("auth").description("Manage employee authorization");
  auth.command("login")
    .description("Authorize through the company WeCom bot")
    .option("--force", "discard existing credentials and authorize again")
    .action(async (options) => emit(program, { auth: await login({ force: options.force }) }));
  auth.command("status")
    .description("Show redacted authorization status")
    .action(async () => emit(program, { auth: await authStatus() }));
  auth.command("logout")
    .description("Remove locally stored CRM credentials")
    .action(async () => emit(program, { auth: await logout() }));

  program.command("doctor")
    .description("Check service connectivity, credentials and CRM tools")
    .action(async () => emit(program, await doctor()));

  program.command("tools")
    .description("List authenticated CRM tools")
    .action(async () => {
      const result = await listTools();
      await emit(program, { tools: result.tools.map(({ name, description, annotations }) => ({ name, description, annotations })) });
    });

  program.command("schema")
    .description("Show the input schema for one CRM tool")
    .argument("<tool>")
    .action(async (tool) => {
      const result = await listTools();
      const found = result.tools.find((item) => item.name === tool);
      if (!found) {
        const error = new Error(`unknown CRM tool: ${tool}`);
        error.code = "UNKNOWN_TOOL";
        throw error;
      }
      await emit(program, { tool: found.name, description: found.description, input_schema: found.inputSchema, annotations: found.annotations });
    });

  program.command("call")
    .description("Call a CRM tool using structured JSON arguments")
    .argument("<tool>")
    .option("--data <json>", "tool arguments as a JSON object", "{}")
    .option("--dry-run", "force a mutation preview without executing it")
    .option("--confirm-token <token>", "single-use confirmation token from a preview")
    .option("--idempotency-key <key>", "stable idempotency key for confirmed execution")
    .action(async (tool, options) => {
      const args = parseJson(options.data, "--data");
      if (options.dryRun) {
        delete args.confirmation_token;
        delete args.idempotency_key;
      } else {
        if (options.confirmToken) args.confirmation_token = options.confirmToken;
        if (options.idempotencyKey) args.idempotency_key = options.idempotencyKey;
      }
      await invoke(program, tool, args);
    });

  program.command("me")
    .description("Show the authenticated CRM employee and effective permissions")
    .action(async () => invoke(program, "get_current_user"));

  program.command("workbench")
    .description("Show today's and overdue customer follow-ups")
    .option("--owner <employee-id>", "owner employee id", Number)
    .action(async (options) => invoke(program, "get_workbench", { owner_employee_id: options.owner }));

  const customer = program.command("customer").description("Search and inspect CRM customers");
  customer.command("search")
    .argument("[keyword]")
    .option("--current <page>", "page number", Number, 1)
    .option("--size <size>", "page size", Number, 20)
    .option("--public", "search the public pool")
    .action(async (keyword, options) => invoke(program, "search_customers", {
      keyword, current: options.current, size: options.size, public_pool: Boolean(options.public),
    }));
  customer.command("get").argument("<customer-id>", "customer id", Number)
    .action(async (customerId) => invoke(program, "get_customer", { customer_id: customerId }));
  customer.command("follow-ups").argument("<customer-id>", "customer id", Number)
    .action(async (customerId) => invoke(program, "list_customer_follow_ups", { customer_id: customerId }));

  const reminder = program.command("reminder").description("Inspect CRM and personal reminders");
  reminder.command("business")
    .option("--current <page>", "page number", Number, 1)
    .option("--size <size>", "page size", Number, 20)
    .option("--status <status>")
    .option("--type <type>")
    .action(async (options) => invoke(program, "list_business_reminders", options));
  reminder.command("personal")
    .action(async () => invoke(program, "list_personal_reminders"));

  program.showHelpAfterError();
  return program;
}

export async function run(argv) {
  const program = await buildProgram();
  await program.parseAsync(argv);
}

export { doctor, parseJson };
