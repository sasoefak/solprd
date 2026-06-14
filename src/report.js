"use strict";

const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
	mag: "\x1b[35m",
};

function icon(status) {
	if (status === "pass") return `${C.green}✔${C.reset}`;
	if (status === "warn") return `${C.yellow}▲${C.reset}`;
	return `${C.red}✘${C.reset}`;
}

function bar(score) {
	const filled = Math.round(score / 5);
	return "█".repeat(filled) + "░".repeat(20 - filled);
}

function gradeColor(grade) {
	if (grade === "A" || grade === "B") return C.green;
	if (grade === "C") return C.yellow;
	return C.red;
}

function renderTerminal(result) {
	const lines = [];
	lines.push("");
	lines.push(`${C.bold}${C.cyan}  SolPRD — Solana PRD Audit${C.reset}`);
	lines.push(`  ${C.dim}${result.generatedAt}${C.reset}`);
	lines.push("");
	const gc = gradeColor(result.grade);
	lines.push(`  Score: ${C.bold}${gc}${result.overall}/100  (${result.grade})${C.reset}  ${C.dim}${bar(result.overall)}${C.reset}`);
	lines.push("");
	for (const s of result.sections) {
		const tag = s.present ? "" : s.optional ? ` ${C.dim}(optional, absent)${C.reset}` : ` ${C.red}(MISSING)${C.reset}`;
		lines.push(`  ${C.bold}${s.title}${C.reset} ${C.dim}[w${s.weight} → ${s.score}]${C.reset}${tag}`);
		for (const c of s.checks || []) {
			lines.push(`    ${icon(c.status)} ${c.label}`);
			if (c.status !== "pass" && c.fix) lines.push(`        ${C.dim}↳ ${c.fix}${C.reset}`);
		}
		lines.push("");
	}
	const top = (result.gaps || []).slice(0, 5);
	if (top.length) {
		lines.push(`${C.bold}  Top priorities${C.reset} ${C.dim}(highest-impact fixes first)${C.reset}`);
		top.forEach((g, i) => lines.push(`    ${C.yellow}${i + 1}.${C.reset} ${g}`));
		lines.push("");
	}
	if (result.aiReview) {
		lines.push(`${C.bold}${C.mag}  AI Review${C.reset}`);
		lines.push(result.aiReview);
		lines.push("");
	}
	return lines.join("\n");
}

function renderMarkdown(result) {
	const out = [];
	out.push(`# PRD Audit Report — SolPRD`);
	out.push("");
	out.push(`**Score:** ${result.overall}/100 (Grade ${result.grade})  `);
	out.push(`**Generated:** ${result.generatedAt}`);
	out.push("");
	out.push(`| Section | Weight | Score | Status |`);
	out.push(`| --- | --- | --- | --- |`);
	for (const s of result.sections) {
		const st = s.present ? "present" : s.optional ? "optional, absent" : "MISSING";
		out.push(`| ${s.title} | ${s.weight} | ${s.score} | ${st} |`);
	}
	out.push("");
	out.push(`## Findings`);
	for (const s of result.sections) {
		out.push(`### ${s.title}`);
		if (!s.present && !s.optional) out.push(`- ❌ Section missing.`);
		for (const c of s.checks || []) {
			const mark = c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : "❌";
			out.push(`- ${mark} ${c.label}${c.status !== "pass" && c.fix ? ` — _${c.fix}_` : ""}`);
		}
		out.push("");
	}
	if (result.gaps && result.gaps.length) {
		out.push(`## Prioritized fixes`);
		for (const g of result.gaps) out.push(`- [ ] ${g}`);
		out.push("");
	}
	if (result.aiReview) {
		out.push(`## AI Review`);
		out.push(result.aiReview);
		out.push("");
	}
	return out.join("\n");
}

function renderProjectTerminal(result) {
	const lines = [];
	lines.push("");
	lines.push(`${C.bold}${C.cyan}  SolPRD — Project Audit (Mode C)${C.reset}`);
	lines.push(`  ${C.dim}${result.dir}${C.reset}`);
	lines.push(`  ${C.dim}${result.fileCount} files · ${(result.frameworks || []).join(", ") || "stack unknown"}${C.reset}`);
	lines.push("");
	const gc = gradeColor(result.grade);
	lines.push(`  Health: ${C.bold}${gc}${result.overall}/100  (${result.grade})${C.reset}  ${C.dim}${bar(result.overall)}${C.reset}`);
	lines.push("");
	for (const s of result.sections) {
		lines.push(`  ${C.bold}${s.title}${C.reset} ${C.dim}[w${s.weight} → ${s.score}]${C.reset}`);
		for (const c of s.checks || []) {
			lines.push(`    ${icon(c.status)} ${c.label}`);
			if (c.status !== "pass" && c.fix) lines.push(`        ${C.dim}↳ ${c.fix}${C.reset}`);
		}
		lines.push("");
	}
	const top = (result.gaps || []).slice(0, 5);
	if (top.length) {
		lines.push(`${C.bold}  Top priorities${C.reset} ${C.dim}(highest-impact fixes first)${C.reset}`);
		top.forEach((g, i) => lines.push(`    ${C.yellow}${i + 1}.${C.reset} ${g}`));
		lines.push("");
	}
	if (result.aiPlan) {
		lines.push(`${C.bold}${C.mag}  AI Improvement Plan${C.reset}`);
		lines.push(result.aiPlan);
		lines.push("");
	}
	return lines.join("\n");
}

function renderProjectMarkdown(result) {
	const out = [];
	out.push(`# Project Audit — SolPRD (Mode C)`);
	out.push("");
	out.push(`**Project:** ${result.name}  `);
	out.push(`**Path:** ${result.dir}  `);
	out.push(`**Stack:** ${(result.frameworks || []).join(", ") || "unknown"}  `);
	out.push(`**Score:** ${result.overall}/100 (Grade ${result.grade})  `);
	out.push(`**Generated:** ${result.generatedAt}`);
	out.push("");
	out.push(`| Section | Weight | Score |`);
	out.push(`| --- | --- | --- |`);
	for (const s of result.sections) out.push(`| ${s.title} | ${s.weight} | ${s.score} |`);
	out.push("");
	out.push(`## Findings`);
	for (const s of result.sections) {
		out.push(`### ${s.title}`);
		for (const c of s.checks || []) {
			const mark = c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : "❌";
			out.push(`- ${mark} ${c.label}${c.status !== "pass" && c.fix ? ` — _${c.fix}_` : ""}`);
		}
		out.push("");
	}
	if (result.gaps && result.gaps.length) {
		out.push(`## Prioritized fixes`);
		for (const g of result.gaps) out.push(`- [ ] ${g}`);
		out.push("");
	}
	if (result.aiPlan) {
		out.push(`## AI Improvement Plan`);
		out.push(result.aiPlan);
		out.push("");
	}
	return out.join("\n");
}

module.exports = { renderTerminal, renderMarkdown, renderProjectTerminal, renderProjectMarkdown, C };
