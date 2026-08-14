import { createServer } from "node:http";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { deleteCredentialRecord, loadCredentialRecord } from "./credential-store.js";
import { MCP_URL, OAUTH_CALLBACK_URL, OAUTH_SCOPES } from "./constants.js";
import { SecureOAuthProvider } from "./oauth-provider.js";

function startCallbackServer(timeoutMs = 5 * 60 * 1000) {
  const callbackUrl = new URL(OAUTH_CALLBACK_URL);
  let resolveCode;
  let rejectCode;
  const codePromise = new Promise((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname !== "/callback") {
      response.writeHead(404).end("Not found");
      return;
    }
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (code) {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      });
      response.end("<!doctype html><meta charset=utf-8><style>body{font:16px system-ui;margin:10vh auto;max-width:560px;padding:24px}</style><h1>CRM CLI authorization completed</h1><p>You can close this window and return to ChatGPT.</p>");
      resolveCode(code);
      return;
    }
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("CRM CLI authorization failed");
    rejectCode(new Error(error || "authorization callback did not contain a code"));
  });

  const ready = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(callbackUrl.port), callbackUrl.hostname, () => resolve());
  });
  const timer = setTimeout(() => rejectCode(new Error("authorization timed out")), timeoutMs);

  return {
    server,
    ready,
    codePromise: codePromise.finally(() => clearTimeout(timer)),
    get redirectUrl() {
      return callbackUrl.toString();
    },
    close() {
      clearTimeout(timer);
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function connectWithProvider(provider) {
  const client = new Client({ name: "ifczt-crm-cli", version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { authProvider: provider });
  await client.connect(transport);
  return { client, transport };
}

export async function login({ force = false } = {}) {
  if (force) await deleteCredentialRecord();
  const callback = startCallbackServer();
  let firstTransport;
  try {
    await callback.ready;
    const provider = new SecureOAuthProvider({ redirectUrl: callback.redirectUrl, interactive: true });
    try {
      const connected = await connectWithProvider(provider);
      firstTransport = connected.transport;
      const tools = await connected.client.listTools();
      return { authenticated: true, scopes: OAUTH_SCOPES, tools: tools.tools.length, reused: true };
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
    }

    const code = await callback.codePromise;
    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { authProvider: provider });
    await transport.finishAuth(code);
    await transport.close().catch(() => {});

    const connected = await connectWithProvider(provider);
    try {
      const tools = await connected.client.listTools();
      return { authenticated: true, scopes: OAUTH_SCOPES, tools: tools.tools.length, reused: false };
    } finally {
      await connected.transport.close().catch(() => {});
    }
  } finally {
    if (firstTransport) await firstTransport.close().catch(() => {});
    await callback.close().catch(() => {});
  }
}

export async function logout() {
  await deleteCredentialRecord();
  return { authenticated: false, removed: true };
}

export async function authStatus() {
  const record = await loadCredentialRecord();
  const tokens = record.tokens;
  return {
    authenticated: Boolean(tokens?.access_token || tokens?.refresh_token),
    has_access_token: Boolean(tokens?.access_token),
    has_refresh_token: Boolean(tokens?.refresh_token),
    scope: tokens?.scope || null,
    authenticated_at: record.authenticatedAt || null,
  };
}
