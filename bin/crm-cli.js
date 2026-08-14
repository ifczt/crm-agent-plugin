#!/usr/bin/env node

import { run } from "../src/cli.js";

run(process.argv).catch((error) => {
  const payload = {
    ok: false,
    error: {
      code: error.code || "CRM_CLI_ERROR",
      message: error.message || String(error),
    },
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = Number.isInteger(error.exitCode) ? error.exitCode : 1;
});
