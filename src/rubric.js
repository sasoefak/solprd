"use strict";

/**
 * The Solana PRD Rubric.
 * This is the "our own PRD" audit framework. Each section is weighted and
 * carries deterministic checks. Checks return: true (pass) | "warn" | false (fail).
 */

function has(text, patterns) {
	const t = (text || "").toLowerCase();
	return patterns.some((p) => t.includes(String(p).toLowerCase()));
}

function longerThan(text, n) {
	return (text || "").replace(/\s+/g, " ").trim().length > n;
}

function hasNumber(text) {
	return /\b\d+(?:[.,]\d+)?\s*%?/.test(text || "");
}

const SECTIONS = [
	{
		id: "problem_users",
		title: "Problem & Users",
		weight: 8,
		aliases: ["problem", "users", "background", "audience"],
		checks: [
			{ id: "problem_stmt", label: "Clear, substantive problem statement", fix: "Describe the concrete problem in 2-3 sentences.", test: (t) => (longerThan(t, 140) ? true : longerThan(t, 50) ? "warn" : false) },
			{ id: "target_users", label: "Target users / personas defined", fix: "Name the primary users (e.g. traders, validators, dApp devs).", test: (t) => has(t, ["user", "persona", "audience", "trader", "developer", "builder", "validator"]) },
			{ id: "jtbd", label: "User need / job-to-be-done stated", fix: "State the job-to-be-done or core pain point.", test: (t) => has(t, ["job to be done", "jtbd", "need", "pain", "use case", "so that"]) },
		],
	},
	{
		id: "solution_overview",
		title: "Solution Overview & Scope",
		weight: 8,
		aliases: ["solution", "overview", "scope"],
		checks: [
			{ id: "scope", label: "In-scope features/deliverables listed", fix: "List the core features you will build.", test: (t) => has(t, ["scope", "feature", "deliver", "build", "capabilit"]) },
			{ id: "non_goals", label: "Out-of-scope / non-goals declared", fix: "Add an explicit 'Out of scope / Non-goals' list.", test: (t) => (has(t, ["out of scope", "non-goal", "not building", "won't", "will not", "out-of-scope"]) ? true : "warn") },
		],
	},
	{
		id: "onchain_architecture",
		title: "On-chain Architecture",
		weight: 12,
		aliases: ["on-chain", "onchain", "architecture", "program", "contract"],
		checks: [
			{ id: "programs", label: "Programs / instructions described", fix: "Describe the program(s), framework (Anchor/native), and instructions.", test: (t) => has(t, ["program", "smart contract", "anchor", "instruction", "native"]) },
			{ id: "accounts", label: "Account model / PDAs / state layout", fix: "Define PDAs, seeds, and account/state layout.", test: (t) => has(t, ["pda", "account", "state", "seed", "data layout"]) },
			{ id: "rent", label: "Rent / account sizing addressed", fix: "Note account size, rent-exemption, and lamports budget.", test: (t) => (has(t, ["rent", "account size", "lamports", "rent-exempt", "space"]) ? true : "warn") },
		],
	},
	{
		id: "compute_performance",
		title: "Compute & Performance",
		weight: 8,
		aliases: ["compute", "performance", "throughput", "transaction"],
		checks: [
			{ id: "compute_budget", label: "Compute budget / units considered", fix: "State expected compute units and ComputeBudget usage.", test: (t) => (has(t, ["compute budget", "compute unit", "computebudget", " cu ", " cus"]) ? true : "warn") },
			{ id: "fees", label: "Priority fees / fee strategy", fix: "Describe priority fee / prioritization strategy.", test: (t) => has(t, ["priority fee", "prioritization", "fee"]) },
			{ id: "reliability", label: "Tx reliability (retries, blockhash, commitment)", fix: "Cover retries, blockhash expiry, and commitment levels.", test: (t) => (has(t, ["retry", "retries", "blockhash", "confirmation", "commitment", "confirmed", "finalized"]) ? true : "warn") },
		],
	},
	{
		id: "rpc_infra",
		title: "RPC & Infrastructure",
		weight: 8,
		aliases: ["rpc", "infra", "infrastructure", "node"],
		checks: [
			{ id: "provider", label: "RPC provider strategy", fix: "Name your RPC provider(s) (Helius, Triton, QuickNode, etc.).", test: (t) => has(t, ["rpc", "helius", "triton", "quicknode", "alchemy", "syndica", "endpoint"]) },
			{ id: "limits", label: "Rate limits / fallback / backoff", fix: "Document rate-limit handling, fallback RPC, and backoff.", test: (t) => (has(t, ["rate limit", "throttle", "fallback", "backoff", "failover"]) ? true : "warn") },
			{ id: "indexing", label: "Indexing / data access plan", fix: "Describe indexing (Geyser, webhooks, DAS, getProgramAccounts).", test: (t) => (has(t, ["index", "geyser", "webhook", "das", "getprogramaccounts", "subscription"]) ? true : "warn") },
		],
	},
	{
		id: "wallet_ux",
		title: "Wallet & UX",
		weight: 10,
		aliases: ["wallet", "ux", "user experience", "frontend", "client"],
		checks: [
			{ id: "adapter", label: "Wallet connection / adapter", fix: "Specify wallet adapter and supported wallets (Phantom, Solflare...).", test: (t) => has(t, ["wallet adapter", "wallet-adapter", "phantom", "solflare", "backpack", "connect wallet", "wallet"]) },
			{ id: "signing", label: "Signing flows", fix: "Describe transaction signing and approval flows.", test: (t) => has(t, ["sign", "signature", "approve", "signtransaction", "signmessage"]) },
			{ id: "safety_ux", label: "Simulation & error states", fix: "Add tx simulation and user-facing error/timeout handling.", test: (t) => (has(t, ["simulate", "simulation", "error", "reject", "timeout", "toast"]) ? true : "warn") },
		],
	},
	{
		id: "tokenomics",
		title: "Tokenomics / SPL",
		weight: 8,
		optional: true,
		aliases: ["token", "tokenomics", "spl", "mint"],
		checks: [
			{ id: "spl", label: "Token standard defined", fix: "Specify SPL Token or Token-2022 and program usage.", test: (t) => has(t, ["spl", "token-2022", "token2022", "mint", "token program"]) },
			{ id: "supply", label: "Supply / decimals / distribution", fix: "Define supply, decimals, and distribution/allocation.", test: (t) => has(t, ["supply", "decimals", "distribution", "allocation", "vesting"]) },
			{ id: "authority", label: "Mint / freeze authority policy", fix: "State mint/freeze authority and any revocation plan.", test: (t) => (has(t, ["mint authority", "freeze authority", "revoke", "authority"]) ? true : "warn") },
		],
	},
	{
		id: "security_trust",
		title: "Security & Trust",
		weight: 12,
		aliases: ["security", "trust", "threat", "safety"],
		checks: [
			{ id: "authority", label: "Upgrade authority / admin model", fix: "Define upgrade authority, admin keys, multisig/governance.", test: (t) => has(t, ["upgrade authority", "admin", "multisig", "governance", "immutable"]) },
			{ id: "audit", label: "Audit / review plan", fix: "State audit, internal review, or bug bounty plans.", test: (t) => (has(t, ["audit", "review", "formal verification", "bug bounty"]) ? true : "warn") },
			{ id: "keys", label: "Key management", fix: "Describe key management (KMS, hardware wallet, custody).", test: (t) => (has(t, ["key management", "private key", "seed phrase", "kms", "hardware wallet", "custody"]) ? true : "warn") },
			{ id: "abuse", label: "Abuse / threat vectors", fix: "List threat vectors (phishing, sybil, MEV, exploits).", test: (t) => (has(t, ["scam", "phishing", "abuse", "sybil", "exploit", "attack", "mev", "drainer"]) ? true : "warn") },
		],
	},
	{
		id: "success_metrics",
		title: "Success Metrics",
		weight: 8,
		aliases: ["success", "metric", "kpi", "goals"],
		checks: [
			{ id: "measurable", label: "Metrics are measurable (numbers/targets)", fix: "Add concrete numeric targets (e.g. 1k DAU, <2s confirm).", test: (t) => (hasNumber(t) ? true : "warn") },
			{ id: "defined", label: "KPIs explicitly named", fix: "Name the KPIs you will track (DAU, TVL, retention...).", test: (t) => has(t, ["metric", "kpi", "measure", "track", "dau", "mau", "tvl", "retention", "conversion"]) },
		],
	},
	{
		id: "risks_mitigations",
		title: "Risks & Mitigations",
		weight: 6,
		aliases: ["risk", "mitigation", "assumption"],
		checks: [
			{ id: "risks", label: "Risks / assumptions identified", fix: "List key risks, assumptions, and dependencies.", test: (t) => has(t, ["risk", "threat", "assumption", "dependency", "uncertain"]) },
			{ id: "mitigations", label: "Mitigations / contingencies", fix: "Pair each risk with a mitigation or contingency.", test: (t) => (has(t, ["mitigat", "contingency", "fallback", "plan b", "reduce"]) ? true : "warn") },
		],
	},
	{
		id: "milestones_rollout",
		title: "Milestones & Rollout",
		weight: 8,
		aliases: ["milestone", "rollout", "roadmap", "timeline", "launch", "phase"],
		checks: [
			{ id: "env", label: "Devnet -> mainnet rollout plan", fix: "Describe localnet/devnet/testnet -> mainnet promotion.", test: (t) => has(t, ["devnet", "testnet", "mainnet", "localnet"]) },
			{ id: "plan", label: "Milestones / timeline / phases", fix: "Break delivery into milestones or phases with timing.", test: (t) => (has(t, ["milestone", "phase", "week", "timeline", "sprint", "q1", "q2", "q3", "q4"]) ? true : "warn") },
		],
	},
	{
		id: "open_questions",
		title: "Open Questions",
		weight: 4,
		aliases: ["open question", "open issues", "tbd", "unknowns", "questions"],
		checks: [
			{ id: "present", label: "Open questions captured", fix: "Track unresolved questions and decisions to be made.", test: (t) => (longerThan(t, 20) ? true : "warn") },
		],
	},
];

function totalWeight() {
	return SECTIONS.reduce((s, x) => s + x.weight, 0);
}

module.exports = { SECTIONS, has, longerThan, hasNumber, totalWeight };
