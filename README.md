# ifczt CRM CLI for ChatGPT Desktop

This public repository installs the company CRM command-line client and a persistent user-level skill for the local Codex experience in the ChatGPT desktop app. It does not contain CRM source code, credentials, tokens, customer data, or WeCom secrets.

## ChatGPT Desktop Agent Install

When a user asks you to install this repository from ChatGPT desktop, perform these steps on their local Windows machine:

1. Confirm the repository URL is exactly `https://github.com/ifczt/crm-agent-plugin`.
2. Check that Node.js 20 or later, npm, Git, and PowerShell are available.
3. Run `npm install --global git+https://github.com/ifczt/crm-agent-plugin.git#main`.
4. Run `crm-cli setup --format json`.
5. Start `crm-cli auth login --format json` in the background. Show the authorization URL to the user and wait while they send the browser's one-time code to the company WeCom bot.
6. Run `crm-cli doctor --format json`. Report success only when the service, authorization, and tool checks pass.
7. Tell the user to restart ChatGPT desktop so the new global skill and `AGENTS.md` rule are loaded.

Never request a CRM password, CRM JWT, OAuth token, refresh token, GitHub token, WeCom secret, or static bearer token. Never disable TLS verification or install a similarly named repository.

The exact employee prompt is:

```text
帮我安装并配置 ifczt CRM CLI，并将 CRM 使用规则注册为全局 Skill：https://github.com/ifczt/crm-agent-plugin
```

## What setup installs

- `crm-cli`, installed globally from this GitHub repository.
- `ifczt-crm`, copied to the user-level `~/.agents/skills` directory.
- A small managed routing block in `~/.codex/AGENTS.md`; existing user instructions are preserved.
- A Windows scheduled task named `ifczt CRM CLI Update`, running daily at 03:30.
- OAuth credentials stored in Windows Credential Manager after WeCom authorization.

This flow is for a local Codex task in the ChatGPT desktop app. A hosted ChatGPT Chat without local command execution cannot install or run a desktop CLI.

## Manual installation

```powershell
npm install --global git+https://github.com/ifczt/crm-agent-plugin.git#main
crm-cli setup --format pretty
crm-cli auth login --format pretty
crm-cli doctor --format pretty
```

During authorization, send the one-time code shown in the browser to the existing company WeCom smart bot. Only enabled CRM employees with a unique WeCom binding can authorize.

## CLI usage

```powershell
crm-cli --help
crm-cli tools --format pretty
crm-cli schema search_customers --format pretty
crm-cli customer search "客户名称" --format pretty
crm-cli workbench --format pretty
```

For mutations, first request a preview:

```powershell
crm-cli call add_customer_follow_up --data '{"customer_id":123,"payload":{"content":"已电话回访"}}' --dry-run --format pretty
```

After the user explicitly confirms, repeat the same business arguments with the returned confirmation token and a stable idempotency key.

## Security and updates

The CLI is a client of `https://agent.ifczt.com/mcp`. The server remains responsible for OAuth, employee status, CRM button permissions, `SELF`/`DEPARTMENT`/`ALL` data scope, mutation confirmation, idempotency, and audit logging.

The daily updater installs the latest `main` package and refreshes the global skill. Failed updates retain the previously installed npm package and write a log to `%LOCALAPPDATA%\ifczt-crm-cli\update.log`. CLI output can also include `_notice.update` when a newer version is available.

## Development

```powershell
npm install
npm test
powershell -NoProfile -File .\scripts\install.ps1 -SkipScheduledUpdate
```
