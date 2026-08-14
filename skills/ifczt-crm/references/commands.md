# CRM CLI command reference

Use `crm-cli tools --format json` for the live catalog and `crm-cli schema <tool> --format json` for the live input schema. Prefer the live schema when this reference and the server differ.

## Authentication and diagnostics

```powershell
crm-cli setup --format json
crm-cli auth login --format json
crm-cli auth status --format json
crm-cli auth logout --format json
crm-cli doctor --format json
```

## Read tools

| Tool | Purpose |
| --- | --- |
| `get_current_user` | Employee, roles, data scope and buttons |
| `get_agent_content` | Versioned prompts and tool policy |
| `search_customers` | Accessible customers or public pool |
| `get_customer` | One accessible customer |
| `list_customer_follow_ups` | Customer follow-up history |
| `get_workbench` | Today's and overdue follow-ups |
| `list_lead_surveys` | Incoming survey leads |
| `list_orders` | Accessible orders |
| `list_contracts` | Accessible contracts |
| `list_payments` | Accessible payment records |
| `list_business_reminders` | Follow-up, contract and payment reminders |
| `list_personal_reminders` | Authenticated employee's personal reminders |

Convenience commands:

```powershell
crm-cli me --format json
crm-cli workbench --format json
crm-cli customer search "Acme" --format json
crm-cli customer get 123 --format json
crm-cli customer follow-ups 123 --format json
crm-cli reminder business --format json
crm-cli reminder personal --format json
```

## Mutation tools

Customer tools: `create_customer`, `update_customer`, `delete_customer`, `add_customer_follow_up`, `move_customer_to_public`, `claim_public_customer`.

Trade tools: `create_order`, `update_order`, `delete_order`, `create_contract`, `update_contract`, `delete_contract`, `create_payment`, `update_payment`, `delete_payment`.

Personal reminder tools: `create_personal_reminder`, `update_personal_reminder`, `pause_personal_reminder`, `resume_personal_reminder`, `delete_personal_reminder`.

Preview and execute with identical business arguments:

```powershell
crm-cli call add_customer_follow_up --data '{"customer_id":123,"payload":{"content":"Called customer"}}' --dry-run --format json

crm-cli call add_customer_follow_up --data '{"customer_id":123,"payload":{"content":"Called customer"}}' --confirm-token '<preview token>' --idempotency-key '<uuid>' --format json
```

Never use a confirmation token with a different tool or changed arguments.
