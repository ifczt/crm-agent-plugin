import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { MCP_URL, OAUTH_CALLBACK_URL } from "./constants.js";
import { SecureOAuthProvider } from "./oauth-provider.js";

export function parseToolResult(result) {
  if (result.structuredContent && Object.keys(result.structuredContent).length) {
    return result.structuredContent;
  }
  const textItems = (result.content || []).filter((item) => item.type === "text");
  if (textItems.length === 1) {
    try {
      return JSON.parse(textItems[0].text);
    } catch {
      return textItems[0].text;
    }
  }
  return result.content || [];
}

function authRequired(error, provider) {
  if (!(error instanceof UnauthorizedError)) return error;
  const next = new Error("CRM authorization is required; run crm-cli auth login");
  next.code = "AUTH_REQUIRED";
  next.authorizationUrl = provider.authorizationUrl;
  return next;
}

export async function connectMcp({ provider } = {}) {
  const oauthProvider = provider || new SecureOAuthProvider({
    redirectUrl: OAUTH_CALLBACK_URL,
    interactive: false,
  });
  const client = new Client({ name: "ifczt-crm-cli", version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { authProvider: oauthProvider });
  try {
    await client.connect(transport);
  } catch (error) {
    throw authRequired(error, oauthProvider);
  }
  return { client, transport, provider: oauthProvider };
}

export async function withMcp(operation) {
  const connection = await connectMcp();
  try {
    return await operation(connection.client);
  } finally {
    await connection.transport.close().catch(() => {});
  }
}

export async function listTools() {
  return withMcp((client) => client.listTools());
}

export async function callTool(name, args) {
  return withMcp(async (client) => parseToolResult(await client.callTool({ name, arguments: args })));
}
