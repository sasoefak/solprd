"use strict";

const fs = require("fs");
const path = require("path");
const { audit } = require("./audit");
const { getTemplate, PRESETS } = require("./template");
const { PROVIDERS } = require("./providers");
const cfgLib = require("./config");
const { renderTerminal, renderMarkdown, renderProjectTerminal, renderProjectMarkdown, C } = require("./report");
const ai = require("./ai");
const project = require("./project");

const VERSION = require("../package.json").version;

function parseArgs(argv) {
	const out = { _: [], flags: {} };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) {
			const key = a.slice(2);
			const next = argv[i + 1];
			// Boolean flags never consume a following positional argument.
			const booleanFlags = ["ai", "json", "no-report", "force", "help", "version", "quiet"];
			if (booleanFlags.includes(key) || next === undefined || next.startsWith("--")) {
				out.flags[key] = true;
			} else {
				out.flags[key] = next;
				i++;
			}
		} else {
			out._.push(a);
		}
	}
	return out;
}

function readPrd(file, cfg) {
	const target = file || (cfg && cfg.prdFile) || "PRD.md";
	const p = path.resolve(process.cwd(), target);
	if (!fs.existsSync(p)) {
		const e = new Error(`No PRD found at '${target}'.\n  ${C.dim}→ Scaffold one:${C.reset} ${C.cyan}solprd init${C.reset}   ${C.dim}(or: solprd quickstart)${C.reset}`);
		e.friendly = true;
		throw e;
	}
	return { path: p, text: fs.readFileSync(p, "utf8"), name: target };
}

function helpText() {
	return `${C.bold}${C.cyan}SolPRD${C.reset} v${VERSION} — Solana PRD development & audit\n\n${C.bold}Usage:${C.reset} solprd <command> [options]\n\n${C.bold}Getting started:${C.reset}\n  quickstart                              Guided 5-step path for first-time users\n  doctor                                  Check setup readiness (Node, PRD, provider, key)\n\n${C.bold}Commands:${C.reset}\n  init [--preset <name>] [--out <file>]   Scaffold a Solana PRD (presets: ${Object.keys(PRESETS).join(", ")})\n  audit [file] [--ai] [--json] [--out <file>] [--min <n>] [--no-report]\n                                          Audit a PRD. Mode A (rules) by default; --ai adds Mode B.\n  improve [file] [--out <file>]           Use AI to rewrite the PRD into a build-ready draft.\n  project [dir] [--ai] [--json] [--min <n>] [--no-report]\n                                          Mode C: scan a project dir, audit it & suggest improvements.\n  config <show|set|providers> [k] [v]     Manage provider, model, baseURL, key, minScore.\n  providers                               List supported AI providers & models.\n  help | version\n\n${C.bold}AI options (Mode B):${C.reset}\n  --provider <id>   one of: ${Object.keys(PROVIDERS).join(", ")}\n  --model <id>      override the model\n\n${C.bold}Examples:${C.reset}\n  solprd quickstart\n  solprd init --preset wallet\n  solprd audit\n  solprd audit PRD.md --ai --provider openai --model gpt-4.1\n  ANTHROPIC_API_KEY=... solprd improve\n`;
}

function cmdQuickstart() {
	console.log(`${C.bold}${C.cyan}SolPRD quickstart${C.reset}\n\n${C.bold}1.${C.reset} Scaffold a PRD:          ${C.cyan}solprd init --preset wallet${C.reset}\n${C.bold}2.${C.reset} Fill in PRD.md, then:    ${C.cyan}solprd audit${C.reset}\n${C.bold}3.${C.reset} Fix the top priorities, re-run ${C.cyan}solprd audit${C.reset}\n${C.bold}4.${C.reset} (optional) AI review:    ${C.cyan}export OPENAI_API_KEY=... && solprd audit --ai${C.reset}\n${C.bold}5.${C.reset} (optional) AI rewrite:   ${C.cyan}solprd improve${C.reset}\n\n${C.dim}Tip: run ${C.reset}${C.cyan}solprd doctor${C.reset}${C.dim} anytime to verify your setup.${C.reset}`);
	return 0;
}

function cmdDoctor() {
	const cfg = cfgLib.load();
	const ok = (b) => (b ? `${C.green}✔${C.reset}` : `${C.red}✘${C.reset}`);
	const warn = `${C.yellow}▲${C.reset}`;
	const lines = ["", `${C.bold}${C.cyan}  SolPRD doctor${C.reset}`, ""];

	const major = Number(process.versions.node.split(".")[0]);
	lines.push(`  ${ok(major >= 18)} Node.js ${process.versions.node}${major >= 18 ? "" : ` ${C.red}(need >= 18)${C.reset}`}`);

	const prdTarget = cfg.prdFile || "PRD.md";
	const prdExists = fs.existsSync(path.resolve(process.cwd(), prdTarget));
	lines.push(`  ${prdExists ? ok(true) : warn} PRD file: ${prdTarget}${prdExists ? "" : ` ${C.dim}(run 'solprd init')${C.reset}`}`);

	const provider = cfg.provider;
	const p = PROVIDERS[provider];
	lines.push(`  ${ok(!!p)} Provider: ${provider}${p ? ` ${C.dim}(${p.label})${C.reset}` : ` ${C.red}(unknown)${C.reset}`}`);

	const model = cfgLib.resolveModel(provider, cfg);
	lines.push(`  ${model ? ok(true) : warn} Model: ${model || `${C.dim}(none — set with --model or config)${C.reset}`}`);

	const key = cfgLib.resolveKey(provider, cfg);
	const envName = p ? p.envKey : "<PROVIDER>_API_KEY";
	lines.push(`  ${key ? ok(true) : warn} API key (${provider}): ${key ? `${C.green}detected${C.reset}` : `${C.dim}not set — export ${envName}=... for Mode B${C.reset}`}`);

	const baseURL = cfgLib.resolveBaseURL(provider, cfg);
	lines.push(`  ${baseURL ? ok(true) : warn} Endpoint: ${baseURL || `${C.dim}(none — set baseURL for custom/self-hosted)${C.reset}`}`);

	lines.push("");
	const aiReady = !!(p && model && key && baseURL);
	lines.push(`  ${ok(true)} ${C.bold}Mode A${C.reset} (rule-based audit): ${C.green}ready${C.reset} ${C.dim}(works offline, no key)${C.reset}`);
	lines.push(`  ${aiReady ? ok(true) : warn} ${C.bold}Mode B${C.reset} (AI review/improve): ${aiReady ? `${C.green}ready${C.reset}` : `${C.yellow}needs a key/model${C.reset} ${C.dim}for '${provider}'${C.reset}`}`);
	lines.push("");
	console.log(lines.join("\n"));
	return 0;
}

function cmdProviders() {
	const lines = [`${C.bold}Supported providers:${C.reset}`];
	for (const [k, p] of Object.entries(PROVIDERS)) {
		lines.push(`  ${C.cyan}${k}${C.reset} — ${p.label}`);
		lines.push(`      env: ${p.envKey}  | default: ${p.defaultModel || "(set --model)"}`);
		if (p.models && p.models.length) lines.push(`      models: ${p.models.join(", ")}`);
		if (p.note) lines.push(`      ${C.dim}note: ${p.note}${C.reset}`);
	}
	console.log(lines.join("\n"));
	return 0;
}

function cmdConfig(args) {
	const sub = args._[1];
	const cfg = cfgLib.load();
	if (!sub || sub === "show") {
		const redacted = Object.assign({}, cfg);
		if (redacted.keys) redacted.keys = Object.fromEntries(Object.keys(redacted.keys).map((k) => [k, "***"]));
		console.log(JSON.stringify(redacted, null, 2));
		console.log(`\n${C.dim}Config file: ${cfgLib.CONFIG_FILE}${C.reset}`);
		return 0;
	}
	if (sub === "providers") return cmdProviders();
	if (sub === "set") {
		const key = args._[2];
		const val = args._[3];
		if (!key || val === undefined) throw new Error("Usage: solprd config set <provider|model|baseURL|minScore|prdFile|key> <value>");
		if (key === "key") {
			console.warn(`${C.yellow}⚠ Storing API keys in solprd.config.json is discouraged. Prefer the ${PROVIDERS[cfg.provider] ? PROVIDERS[cfg.provider].envKey : "<PROVIDER>_API_KEY"} env var.${C.reset}`);
			cfg.keys = cfg.keys || {};
			cfg.keys[cfg.provider] = val;
		} else if (key === "provider") {
			if (!PROVIDERS[val]) throw new Error(`Unknown provider '${val}'. See: solprd providers`);
			cfg.provider = val;
			cfg.model = null;
		} else if (key === "minScore") {
			cfg.minScore = Number(val);
		} else {
			cfg[key] = val;
		}
		const file = cfgLib.save(cfg);
		console.log(`${C.green}✔ Saved ${key} → ${file}${C.reset}`);
		if (key === "key") console.log(`${C.dim}Tip: add solprd.config.json to .gitignore so the key is not committed.${C.reset}`);
		return 0;
	}
	throw new Error("Unknown config subcommand. Use: show | set | providers");
}

function cmdInit(args) {
	const preset = args.flags.preset || "default";
	if (!PRESETS[preset]) throw new Error(`Unknown preset '${preset}'. Available: ${Object.keys(PRESETS).join(", ")}`);
	const out = args.flags.out || "PRD.md";
	const p = path.resolve(process.cwd(), out);
	if (fs.existsSync(p) && !args.flags.force) throw new Error(`${out} already exists. Use --force to overwrite.`);
	fs.writeFileSync(p, getTemplate(preset));
	console.log(`${C.green}✔ Created ${out}${C.reset} ${C.dim}(preset: ${preset})${C.reset}`);
	console.log(`\n${C.bold}  Next steps${C.reset}`);
	console.log(`    1. Fill in ${out} (replace every <placeholder>).`);
	console.log(`    2. Run ${C.cyan}solprd audit${C.reset} to score it.`);
	return 0;
}

function printNextSteps(result, cfg, args) {
	const min = args.flags.min !== undefined ? Number(args.flags.min) : cfg.minScore;
	const lines = [`${C.bold}  Next steps${C.reset}`];
	if (typeof min === "number" && !Number.isNaN(min) && result.overall < min) {
		lines.push(`    • Below threshold (${min}). Address the ${C.bold}Top priorities${C.reset} above, then re-run ${C.cyan}solprd audit${C.reset}.`);
	} else {
		lines.push(`    • ${C.green}Above threshold${C.reset}. Resolve any ${C.yellow}▲${C.reset} warnings to push the score higher.`);
	}
	if (!result.aiReview) {
		const provider = args.flags.provider || cfg.provider;
		const hasKey = cfgLib.resolveKey(provider, cfg);
		if (hasKey) lines.push(`    • Deeper review: ${C.cyan}solprd audit --ai${C.reset}  |  auto-draft fixes: ${C.cyan}solprd improve${C.reset}`);
		else lines.push(`    • For AI review, run ${C.cyan}solprd doctor${C.reset} to set up a key, then ${C.cyan}solprd audit --ai${C.reset}.`);
	}
	console.log("\n" + lines.join("\n") + "\n");
}

async function cmdAudit(args) {
	const cfg = cfgLib.load();
	const prd = readPrd(args._[1], cfg);
	const result = audit(prd.text);

	if (args.flags.ai) {
		const provider = args.flags.provider || cfg.provider;
		const model = args.flags.model || cfgLib.resolveModel(provider, cfg);
		const apiKey = cfgLib.resolveKey(provider, cfg);
		const baseURL = cfgLib.resolveBaseURL(provider, cfg);
		try {
			if (!args.flags.quiet) console.error(`${C.dim}Running AI review via ${provider} (${model})...${C.reset}`);
			result.aiReview = await ai.callModel({ provider, model, apiKey, baseURL, system: ai.SYSTEM_PROMPT, user: ai.buildReviewPrompt(prd.text, result) });
			result.aiProvider = provider;
			result.aiModel = model;
		} catch (e) {
			console.error(`${C.yellow}⚠ AI review skipped: ${e.message}${C.reset}`);
			console.error(`${C.dim}Showing rule-based results only. Run 'solprd doctor' to check your AI setup.${C.reset}`);
		}
	}

	if (args.flags.json) {
		const json = JSON.stringify(result, null, 2);
		if (args.flags.out) fs.writeFileSync(path.resolve(process.cwd(), args.flags.out), json);
		else console.log(json);
	} else {
		console.log(renderTerminal(result));
		if (!args.flags["no-report"]) {
			const outFile = args.flags.out || "PRD-AUDIT.md";
			fs.writeFileSync(path.resolve(process.cwd(), outFile), renderMarkdown(result));
			console.log(`${C.dim}Full report written to ${outFile}${C.reset}`);
		}
		printNextSteps(result, cfg, args);
	}

	const min = args.flags.min !== undefined ? Number(args.flags.min) : cfg.minScore;
	if (typeof min === "number" && !Number.isNaN(min) && result.overall < min) {
		if (!args.flags.json) console.error(`${C.red}✘ Score ${result.overall} is below threshold ${min}.${C.reset}`);
		return 1;
	}
	return 0;
}

async function cmdImprove(args) {
	const cfg = cfgLib.load();
	const prd = readPrd(args._[1], cfg);
	const result = audit(prd.text);
	const provider = args.flags.provider || cfg.provider;
	const model = args.flags.model || cfgLib.resolveModel(provider, cfg);
	const apiKey = cfgLib.resolveKey(provider, cfg);
	const baseURL = cfgLib.resolveBaseURL(provider, cfg);
	if (!apiKey) throw Object.assign(new Error(`No API key for '${provider}'. Run ${C.cyan}solprd doctor${C.reset} to set one up.`), { friendly: true });
	if (!args.flags.quiet) console.error(`${C.dim}Generating improved PRD via ${provider} (${model})...${C.reset}`);
	const improved = await ai.callModel({ provider, model, apiKey, baseURL, system: ai.SYSTEM_PROMPT, user: ai.buildImprovePrompt(prd.text, result), maxTokens: 8192 });
	const out = args.flags.out || "PRD-IMPROVED.md";
	fs.writeFileSync(path.resolve(process.cwd(), out), improved);
	console.log(`${C.green}✔ Wrote ${out}${C.reset}`);
	console.log(`${C.dim}Review it, then run 'solprd audit ${out}' to confirm the new score.${C.reset}`);
	return 0;
}

function printProjectNextSteps(result, cfg, args) {
	const lines = [`${C.bold}  Next steps${C.reset}`];
	if (result.secrets && result.secrets.length) lines.push(`    • ${C.red}Rotate & remove the hardcoded secrets first${C.reset} (see Security & Secrets).`);
	lines.push(`    • Tackle the ${C.bold}Top priorities${C.reset} above, then re-run ${C.cyan}solprd project${C.reset}.`);
	if (!result.aiPlan) {
		const provider = args.flags.provider || cfg.provider;
		const hasKey = cfgLib.resolveKey(provider, cfg);
		if (hasKey) lines.push(`    • Get a deep AI improvement plan: ${C.cyan}solprd project --ai${C.reset}`);
		else lines.push(`    • For an AI plan, run ${C.cyan}solprd doctor${C.reset} to set up a key, then ${C.cyan}solprd project --ai${C.reset}.`);
	}
	console.log("\n" + lines.join("\n") + "\n");
}

async function cmdProject(args) {
	const cfg = cfgLib.load();
	const dir = args._[1] || ".";
	const result = project.auditProject(dir);

	if (args.flags.ai) {
		const provider = args.flags.provider || cfg.provider;
		const model = args.flags.model || cfgLib.resolveModel(provider, cfg);
		const apiKey = cfgLib.resolveKey(provider, cfg);
		const baseURL = cfgLib.resolveBaseURL(provider, cfg);
		try {
			if (!args.flags.quiet) console.error(`${C.dim}Generating AI improvement plan via ${provider} (${model})...${C.reset}`);
			result.aiPlan = await ai.callModel({ provider, model, apiKey, baseURL, system: ai.PROJECT_SYSTEM_PROMPT, user: ai.buildProjectPrompt(result.profile, result.snippets, result), maxTokens: 6000 });
			result.aiProvider = provider;
			result.aiModel = model;
		} catch (e) {
			console.error(`${C.yellow}⚠ AI plan skipped: ${e.message}${C.reset}`);
			console.error(`${C.dim}Showing rule-based results only. Run 'solprd doctor' to check your AI setup.${C.reset}`);
		}
	}

	if (args.flags.json) {
		const clean = Object.assign({}, result);
		delete clean.snippets;
		delete clean.profile;
		const json = JSON.stringify(clean, null, 2);
		if (args.flags.out) fs.writeFileSync(path.resolve(process.cwd(), args.flags.out), json);
		else console.log(json);
	} else {
		console.log(renderProjectTerminal(result));
		if (!args.flags["no-report"]) {
			const outFile = args.flags.out || (result.aiPlan ? "PROJECT-IMPROVEMENTS.md" : "PROJECT-AUDIT.md");
			fs.writeFileSync(path.resolve(process.cwd(), outFile), renderProjectMarkdown(result));
			console.log(`${C.dim}Full report written to ${outFile}${C.reset}`);
		}
		printProjectNextSteps(result, cfg, args);
	}

	const min = args.flags.min !== undefined ? Number(args.flags.min) : cfg.minScore;
	if (typeof min === "number" && !Number.isNaN(min) && result.overall < min) {
		if (!args.flags.json) console.error(`${C.red}✘ Project health ${result.overall} is below threshold ${min}.${C.reset}`);
		return 1;
	}
	return 0;
}

async function run(argv) {
	const args = parseArgs(argv);
	const cmd = args._[0];

	if (!cmd || cmd === "help" || args.flags.help) {
		console.log(helpText());
		return 0;
	}
	if (cmd === "version" || args.flags.version) {
		console.log(`solprd v${VERSION}`);
		return 0;
	}
	if (cmd === "quickstart") return cmdQuickstart();
	if (cmd === "doctor") return cmdDoctor();
	if (cmd === "providers") return cmdProviders();
	if (cmd === "config") return cmdConfig(args);
	if (cmd === "init") return cmdInit(args);
	if (cmd === "audit") return await cmdAudit(args);
	if (cmd === "improve") return await cmdImprove(args);
	if (cmd === "project") return await cmdProject(args);

	console.error(`Unknown command: ${cmd}\n`);
	console.log(helpText());
	return 1;
}

module.exports = { run, parseArgs };
