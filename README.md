# ifczt CRM Agent Plugin

Public distribution package for the ifczt CRM Agent. It contains plugin metadata, the `crm-sales-assistant` skill, public assets, and the remote MCP connection only. CRM source code, credentials, tokens, and customer data are intentionally excluded.

```powershell
codex plugin marketplace add ifczt/crm-agent-plugin
```

The MCP server is `https://agent.ifczt.com/mcp`. Authentication is completed by sending the browser's one-time code to the existing company WeCom smart bot.

`.app.json` remains empty until an administrator registers the production MCP connection in ChatGPT developer mode and commits the resulting `plugin_asdk_app...` mapping.
