"use strict";

const { PROVIDERS } = require("./providers");

/**
 * Provider-agnostic chat call. Uses global fetch (Node >= 18).
 * Mode B sends the PRD + rubric findings to the user's chosen model.
 */
async function callModel({ provider, model, apiKey, baseURL, system, user, maxTokens = 4096 }) {
	const p = PROVIDERS[provider];
	if (!p) throw new Error(`Unknown provider: ${provider}`);
	if (!apiKey) throw new Error(`Missing API key. Set ${p.envKey} or run: solprd config set key <key>`);
	const url = baseURL || p.baseURL;
	if (!url) throw new Error(`No endpoint configured for provider '${provider}'. Set one with: solprd config set baseURL <url>`);
	if (typeof fetch !== "function") throw new Error("global fetch unavailable; use Node >= 18.");

	if (p.api === "anthropic") {
		const res = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
			body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
		});
		const j = await res.json();
		if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${JSON.stringify(j)}`);
		return (j.content || []).map((c) => c.text || "").join("");
	}

	if (p.api === "gemini") {
		const endpoint = `${url}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
		const res = await fetch(endpoint, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }] }),
		});
		const j = await res.json();
		if (!res.ok) throw new Error(`Gemini error ${res.status}: ${JSON.stringify(j)}`);
		const cand = (j.candidates || [])[0];
		return ((cand && cand.content && cand.content.parts) || []).map((x) => x.text || "").join("");
	}

	// OpenAI-compatible (openai, openrouter, xai, deepseek, mistral, groq, together, xiaomi, custom)
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
	});
	const j = await res.json();
	if (!res.ok) throw new Error(`Provider error ${res.status}: ${JSON.stringify(j)}`);
	const choice = (j.choices || [])[0];
	return (choice && choice.message && choice.message.content) || "";
}

const SYSTEM_PROMPT = `You are a principal product manager and senior Solana protocol engineer reviewing a Product Requirements Document (PRD) for a Solana / Web3 project. You are rigorous, security-first, and concise. You judge clarity, technical feasibility on Solana, and completeness. Reference Solana-specific concerns: programs/PDAs, account & rent model, compute budget & priority fees, RPC/indexing strategy, wallet UX, SPL/Token-2022 tokenomics, upgrade authority, key management, and abuse/MEV vectors.`;

function buildReviewPrompt(prdText, ruleResult) {
	const gaps = (ruleResult.gaps || []).map((g) => `- ${g}`).join("\n") || "- (none detected by rule-based pass)";
	return `The rule-based audit scored this PRD ${ruleResult.overall}/100 (grade ${ruleResult.grade}).\n\nKnown gaps from the deterministic pass:\n${gaps}\n\n=== PRD START ===\n${prdText}\n=== PRD END ===\n\nProduce a structured review with these sections:\n1. Executive verdict (2-3 sentences + a 0-100 quality score).\n2. Top 5 highest-impact improvements (ranked, each with why + concrete fix).\n3. Solana-specific technical risks the author may have missed.\n4. Security & trust assessment.\n5. Section-by-section notes.\nBe specific and actionable. Use Markdown.`;
}

function buildImprovePrompt(prdText, ruleResult) {
	return `Rewrite and upgrade the following Solana PRD into a complete, build-ready document. Fix every gap, add missing Solana-specific sections (on-chain architecture, compute/perf, RPC/infra, wallet UX, security, metrics, milestones), keep the author's intent, and use crisp Markdown with clear headings. Do not invent fake metrics — mark assumptions as TODO.\n\nRule-based gaps to resolve:\n${(ruleResult.gaps || []).map((g) => `- ${g}`).join("\n")}\n\n=== CURRENT PRD ===\n${prdText}\n=== END ===\n\nReturn ONLY the improved PRD in Markdown.`;
}

const PROJECT_SYSTEM_PROMPT = `You are a principal Solana engineer and tech lead doing a hands-on review of a real codebase. You are security-first, pragmatic, and concise. Recommend concrete, high-leverage improvements grounded ONLY in the files provided. Cover: architecture & program design (Anchor/native, PDAs, account validation), compute/perf, RPC & infra, wallet/client UX, testing, CI, and especially secret management and on-chain security. Never invent files you were not shown.`;

function buildProjectPrompt(profile, snippets, ruleResult) {
	const snip = (snippets || []).map((s) => `\n--- ${s.file} ---\n${s.content}`).join("\n");
	const gaps = (ruleResult.gaps || []).map((g) => `- ${g}`).join("\n") || "- (none from rule-based pass)";
	return `Rule-based project audit scored ${ruleResult.overall}/100 (grade ${ruleResult.grade}).\n\nProject: ${profile.name}\nStack: ${(profile.frameworks || []).join(", ") || "unknown"}\nDetected: ${JSON.stringify(profile.stack)}\nHardcoded-secret hits: ${JSON.stringify(profile.secrets || [])}\n\nKnown gaps:\n${gaps}\n\nKey files:\n${snip}\n\nProduce a prioritized improvement plan in Markdown with:\n1. Executive verdict (2-3 sentences + a 0-100 health score).\n2. Top 5-8 highest-impact improvements (ranked; each: problem -> concrete fix -> example command or snippet).\n3. Security & secret-management actions (flag anything urgent).\n4. Solana-specific hardening (accounts/PDAs, compute, RPC, retries).\n5. Suggested next 3 commits.\nBe specific to the files shown. Use Markdown.`;
}

module.exports = { callModel, SYSTEM_PROMPT, buildReviewPrompt, buildImprovePrompt, PROJECT_SYSTEM_PROMPT, buildProjectPrompt };
