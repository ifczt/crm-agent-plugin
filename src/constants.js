export const MCP_URL = process.env.CRM_CLI_SERVER_URL || "https://agent.ifczt.com/mcp";
export const PUBLIC_BASE_URL = new URL(MCP_URL).origin;
export const OAUTH_SCOPES = ["crm.read", "crm.write", "reminders.manage"];
export const OAUTH_CALLBACK_URL = "http://127.0.0.1:19732/callback";
export const CREDENTIAL_TARGET = `ifczt-crm-cli:${MCP_URL}`;
export const UPDATE_SOURCE = "https://github.com/ifczt/crm-agent-plugin/archive/refs/heads/main.tar.gz";
export const MANAGED_RULE_START = "<!-- ifczt-crm:start -->";
export const MANAGED_RULE_END = "<!-- ifczt-crm:end -->";
export const MANAGED_RULE = `${MANAGED_RULE_START}
For CRM, customer, follow-up, workbench, lead survey, order, contract, payment,
public-pool, or business-reminder tasks, use the installed ifczt-crm skill and
crm-cli. Do not call undocumented CRM endpoints or bypass CLI confirmation,
employee permissions, data scope, audit, or WeCom authentication.
${MANAGED_RULE_END}`;
