"use strict";

// Mode C — Project Improvement.
// Point SolPRD at a project directory (the user's `cd` location); it scans the
// repo, builds a stack profile, runs rule-based project checks, and gathers
// compact code snippets for an optional AI improvement plan.

const fs = require("fs");
const path = require("path");

const IGNORE_DIRS = new Set([
	"node_modules", ".git", "target", "dist", "build", ".next", ".anchor",
	"test-ledger", "coverage", ".turbo", ".vercel", "out", ".cache",
]);
const MAX_DEPTH = 6;
const MAX_SNIPPET_BYTES = 4000;

function walk(dir, base, acc, depth) {
	if (depth > MAX_DEPTH) return;
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch (e) {
		return;
	}
	for (const ent of entries) {
		const full = path.join(dir, ent.name);
		if (ent.isDirectory()) {
			if (IGNORE_DIRS.has(ent.name)) continue;
			if (ent.name.startsWith(".") && ent.name !== ".github") continue;
			acc.dirs.push(path.relative(base, full));
			walk(full, base, acc, depth + 1);
		} else if (ent.isFile()) {
			acc.files.push(path.relative(base, full));
		}
	}
}

function readSafe(file) {
	try {
		return fs.readFileSync(file, "utf8");
	} catch (e) {
		return "";
	}
}

function clip(text, bytes) {
	if (!text) return "";
	if (text.length <= bytes) return text;
	return text.slice(0, bytes) + "\n... (truncated)";
}

function exists(base, rel) {
	return fs.existsSync(path.join(base, rel));
}

// Detect hardcoded secrets / RPC keys in source. Light heuristic, no false-positive obsession.
function scanSecrets(base, files) {
	const hits = [];
	const patterns = [
		{ id: "rpc_key", re: /https?:\/\/[^\s"']*(?:api[-_]?key|api-key=|\/v2\/|helius|quiknode|alchemy)[^\s"']*[?&=][A-Za-z0-9_-]{12,}/i, label: "Hardcoded RPC URL with embedded key" },
		{ id: "privkey_array", re: /\[\s*(?:\d{1,3}\s*,\s*){31,}\d{1,3}\s*\]/, label: "Possible inlined secret key byte array" },
		{ id: "base58_secret", re: /(?:secret|private)[_-]?key\s*[:=]\s*["'][1-9A-HJ-NP-Za-km-z]{80,}["']/i, label: "Possible hardcoded base58 secret key" },
		{ id: "generic_key", re: /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/i, label: "Hardcoded API key/secret/token literal" },
	];
	const scanExt = new Set([".ts", ".tsx", ".js", ".jsx", ".rs", ".json", ".env"]);
	for (const rel of files) {
		const ext = path.extname(rel).toLowerCase();
		if (rel.includes(".env.example")) continue;
		if (!scanExt.has(ext) && !rel.endsWith(".env")) continue;
		if (rel.endsWith("package-lock.json") || rel.endsWith("yarn.lock")) continue;
		const content = readSafe(path.join(base, rel));
		if (!content || content.length > 400000) continue;
		for (const p of patterns) {
			if (p.re.test(content)) {
				hits.push({ file: rel, label: p.label });
				break;
			}
		}
	}
	return hits;
}

function scanProject(dir) {
	const base = path.resolve(process.cwd(), dir);
	if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
		const e = new Error(`Project directory not found: ${dir}`);
		e.friendly = true;
		throw e;
	}
	const acc = { files: [], dirs: [] };
	walk(base, base, acc, 0);

	const files = acc.files;
	const lower = files.map((f) => f.toLowerCase());
	const hasFile = (name) => lower.includes(name.toLowerCase());
	const anyMatch = (re) => files.some((f) => re.test(f));

	// package.json
	let pkg = null;
	if (hasFile("package.json")) {
		try {
			pkg = JSON.parse(readSafe(path.join(base, "package.json")));
		} catch (e) {
			pkg = {};
		}
	}
	const deps = pkg ? Object.assign({}, pkg.dependencies, pkg.devDependencies) : {};
	const depNames = Object.keys(deps);
	const hasDep = (sub) => depNames.some((d) => d.includes(sub));

	// .gitignore handling
	const gitignore = hasFile(".gitignore") ? readSafe(path.join(base, ".gitignore")) : "";
	const envIgnored = /(^|\n)\s*\.env(\b|\*|\n|$)/.test(gitignore) || /\*\.env/.test(gitignore);
	const envTracked = files.some((f) => /(^|\/)\.env$/.test(f) || /(^|\/)\.env\.(local|production|development)$/.test(f));

	const frameworks = [];
	if (hasDep("next")) frameworks.push("Next.js");
	if (hasDep("react") && !hasDep("next")) frameworks.push("React");
	if (hasDep("@solana/web3.js")) frameworks.push("@solana/web3.js");
	if (hasDep("@coral-xyz/anchor") || hasDep("@project-serum/anchor")) frameworks.push("Anchor (TS client)");
	if (hasDep("@solana/wallet-adapter")) frameworks.push("Wallet Adapter");
	if (hasDep("typescript")) frameworks.push("TypeScript");

	const hasAnchorToml = hasFile("anchor.toml");
	const hasCargoToml = anyMatch(/(^|\/)cargo\.toml$/i);
	const hasProgramsRs = anyMatch(/programs\/.+\.rs$/i);
	const declaresId = (() => {
		const rsFiles = files.filter((f) => f.toLowerCase().endsWith(".rs")).slice(0, 12);
		return rsFiles.some((f) => /declare_id!/.test(readSafe(path.join(base, f))));
	})();
	const isAnchor = hasAnchorToml;
	const isNativeProgram = !hasAnchorToml && (hasProgramsRs || declaresId || hasCargoToml);
	const isOnchain = isAnchor || isNativeProgram || hasProgramsRs || declaresId;
	const isFrontend = frameworks.includes("Next.js") || frameworks.includes("React");

	// tests
	const hasTsTests = anyMatch(/(\.test\.[tj]sx?$|(^|\/)tests?\/)/i);
	const hasRustTests = files.filter((f) => f.toLowerCase().endsWith(".rs")).slice(0, 12)
		.some((f) => /#\[cfg\(test\)\]|#\[tokio::test\]|#\[test\]/.test(readSafe(path.join(base, f))));
	const hasTests = hasTsTests || hasRustTests;

	const hasCI = files.some((f) => /\.github\/workflows\/.+\.ya?ml$/i.test(f));
	const hasReadme = hasFile("readme.md") || hasFile("readme.mdx") || anyMatch(/(^|\/)readme\./i);
	const hasEnvExample = files.some((f) => /\.env\.example$|\.env\.sample$/i.test(f));
	const scripts = pkg && pkg.scripts ? Object.keys(pkg.scripts) : [];
	const secrets = scanSecrets(base, files);

	const profile = {
		dir: base,
		name: (pkg && pkg.name) || path.basename(base),
		fileCount: files.length,
		frameworks,
		depCount: depNames.length,
		stack: {
			hasPackageJson: !!pkg,
			hasAnchorToml,
			hasCargoToml,
			isAnchor,
			isNativeProgram,
			isOnchain,
			isFrontend,
			hasWalletAdapter: hasDep("@solana/wallet-adapter"),
			hasWeb3: hasDep("@solana/web3.js"),
			hasTests,
			hasCI,
			hasReadme,
			hasEnvExample,
			gitignore: !!gitignore,
			envIgnored,
			envTracked,
			scripts,
		},
		secrets,
	};

	// Compact snippets for the AI prompt.
	const snippetFiles = [];
	const pick = (rel) => {
		if (exists(base, rel)) snippetFiles.push(rel);
	};
	pick("package.json");
	pick("Anchor.toml");
	pick("README.md");
	const libRs = files.find((f) => /programs\/.+\/src\/lib\.rs$/i.test(f)) || files.find((f) => f.toLowerCase().endsWith("lib.rs"));
	if (libRs) snippetFiles.push(libRs);
	const entryTs = files.find((f) => /(^|\/)(idl|client|index|main|app)\.tsx?$/i.test(f));
	if (entryTs) snippetFiles.push(entryTs);

	const snippets = snippetFiles.map((rel) => ({ file: rel, content: clip(readSafe(path.join(base, rel)), MAX_SNIPPET_BYTES) }));

	return { profile, snippets, files };
}

function mkCheck(id, label, status, fix) {
	return { id, label, status, fix: status === "pass" ? null : fix };
}

// Rule-based Mode C audit. Sections are weighted; sum of weights = 100.
function auditProject(dir) {
	const { profile, snippets, files } = scanProject(dir);
	const s = profile.stack;
	const sections = [];

	sections.push({
		title: "Project Structure",
		weight: 15,
		checks: [
			mkCheck("manifest", "Build manifest present (package.json / Cargo.toml / Anchor.toml)",
				s.hasPackageJson || s.hasCargoToml || s.hasAnchorToml ? "pass" : "fail",
				"Add a package.json (TS) or Cargo.toml/Anchor.toml (program) so the project builds reproducibly."),
			mkCheck("readme", "README / docs present", s.hasReadme ? "pass" : "warn",
				"Add a README with setup, build, and deploy steps."),
		],
	});

	sections.push({
		title: "Solana Program",
		weight: 20,
		checks: [
			mkCheck("program", "On-chain program detected (Anchor / native)",
				s.isOnchain ? "pass" : "warn",
				"No program found — if this is a frontend-only repo that's fine; otherwise add your Anchor/native program."),
			mkCheck("framework", "Program framework identified",
				s.isAnchor ? "pass" : s.isNativeProgram ? "warn" : "warn",
				"Prefer Anchor for safety (account validation, IDL) unless you have a reason to go native."),
		],
	});

	sections.push({
		title: "Testing",
		weight: 15,
		checks: [
			mkCheck("tests", "Automated tests present", s.hasTests ? "pass" : "fail",
				"Add tests: Anchor/bankrun for programs, or vitest/jest for the client."),
		],
	});

	sections.push({
		title: "Client & Wallet",
		weight: 15,
		checks: [
			mkCheck("web3", "Solana client library wired (@solana/web3.js / Anchor)",
				s.hasWeb3 || profile.frameworks.includes("Anchor (TS client)") || s.isOnchain ? "pass" : "warn",
				"Add @solana/web3.js (and Anchor client) to talk to the chain."),
			mkCheck("wallet", "Wallet adapter present (frontend)",
				s.hasWalletAdapter ? "pass" : s.isFrontend ? "warn" : "pass",
				"Add @solana/wallet-adapter so users can connect Phantom/Solflare safely."),
		],
	});

	sections.push({
		title: "Security & Secrets",
		weight: 25,
		checks: [
			mkCheck("no_secrets", "No hardcoded secrets / keys in source",
				profile.secrets.length === 0 ? "pass" : "fail",
				`Move secrets to env vars. Found in: ${profile.secrets.map((h) => h.file).join(", ")}`),
			mkCheck("env_ignored", ".env is git-ignored (and not committed)",
				s.envTracked ? "fail" : s.gitignore && s.envIgnored ? "pass" : "warn",
				s.envTracked ? "A .env file appears committed — remove it from git history and rotate any keys." : "Add .env to .gitignore."),
			mkCheck("env_example", ".env.example documents required vars",
				s.hasEnvExample ? "pass" : "warn",
				"Add a .env.example listing required vars (RPC_URL, KEYPAIR_PATH, etc.) without real values."),
		],
	});

	sections.push({
		title: "Automation & Tooling",
		weight: 10,
		checks: [
			mkCheck("ci", "CI workflow present", s.hasCI ? "pass" : "warn",
				"Add a GitHub Actions workflow that builds + tests on every PR."),
			mkCheck("scripts", "Build/test scripts defined",
				s.scripts && (s.scripts.includes("build") || s.scripts.includes("test")) ? "pass" : s.hasPackageJson ? "warn" : "pass",
				"Define npm scripts (build, test, lint) for a consistent dev workflow."),
		],
	});

	const score = (st) => (st === "pass" ? 1 : st === "warn" ? 0.5 : 0);
	let weighted = 0;
	let totalWeight = 0;
	const gaps = [];
	for (const sec of sections) {
		const avg = sec.checks.reduce((a, c) => a + score(c.status), 0) / sec.checks.length;
		sec.score = Math.round(avg * sec.weight * 10) / 10;
		weighted += avg * sec.weight;
		totalWeight += sec.weight;
		for (const c of sec.checks) {
			if (c.status === "fail") gaps.push(`[${sec.title}] ${c.fix}`);
		}
	}
	for (const sec of sections) {
		for (const c of sec.checks) {
			if (c.status === "warn") gaps.push(`[${sec.title}] ${c.fix}`);
		}
	}

	const overall = Math.round((weighted / totalWeight) * 100);
	const grade = overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 70 ? "C" : overall >= 60 ? "D" : "F";

	return {
		type: "project",
		dir: profile.dir,
		name: profile.name,
		fileCount: profile.fileCount,
		frameworks: profile.frameworks,
		overall,
		grade,
		sections,
		gaps,
		secrets: profile.secrets,
		snippets,
		profile,
		generatedAt: new Date().toISOString(),
	};
}

module.exports = { scanProject, auditProject };
