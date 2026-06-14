#!/usr/bin/env node
"use strict";

/**
 * solprd CLI entrypoint.
 * Thin wrapper that delegates to src/cli.js.
 */
require("../src/cli.js")
	.run(process.argv.slice(2))
	.then((code) => {
		if (typeof code === "number") process.exit(code);
	})
	.catch((err) => {
		console.error("\x1b[31msolprd error:\x1b[0m", err && err.message ? err.message : err);
		process.exit(1);
	});
