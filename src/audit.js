"use strict";

const { SECTIONS } = require("./rubric");
const { parseSections } = require("./parser");

// Whole-word-ish alias match (no regex escaping needed: aliases are safe strings).
function aliasMatches(title, alias) {
	const t = title.toLowerCase();
	const a = alias.toLowerCase();
	const idx = t.indexOf(a);
	if (idx === -1) return false;
	const isWord = (ch) => ch >= "a" && ch <= "z" || ch >= "0" && ch <= "9";
	const before = idx === 0 ? " " : t[idx - 1];
	const after = idx + a.length >= t.length ? " " : t[idx + a.length];
	return !isWord(before) && !isWord(after);
}

function matchSection(rubricSec, parsed) {
	for (const p of parsed) {
		// Skip the preamble and the document title (H1); section headings are H2+.
		if (p.title === "__preamble__" || p.level < 2) continue;
		if (rubricSec.aliases.some((a) => aliasMatches(p.title, a))) return p;
	}
	return null;
}

/**
 * Mode A: deterministic, offline, rule-based audit against the Solana PRD rubric.
 */
function audit(markdown) {
	const parsed = parseSections(markdown);
	const fullText = markdown || "";
	const sectionResults = [];
	let earned = 0;
	let denom = 0;

	for (const sec of SECTIONS) {
		const matched = matchSection(sec, parsed);
		const present = !!matched && matched.text.length > 0;

		if (!present) {
			if (sec.optional) {
				sectionResults.push({ id: sec.id, title: sec.title, weight: sec.weight, present: false, optional: true, score: 0, checks: [], note: "Optional section absent — excluded from score." });
				continue;
			}
			denom += sec.weight;
			sectionResults.push({ id: sec.id, title: sec.title, weight: sec.weight, present: false, optional: false, score: 0, note: "Required section missing.", checks: sec.checks.map((c) => ({ id: c.id, label: c.label, status: "fail", fix: c.fix })) });
			continue;
		}

		const text = matched.text;
		let pts = 0;
		const checks = sec.checks.map((c) => {
			let res;
			try {
				res = c.test(text, fullText);
			} catch (e) {
				res = false;
			}
			const status = res === true ? "pass" : res === "warn" ? "warn" : "fail";
			pts += status === "pass" ? 1 : status === "warn" ? 0.5 : 0;
			return { id: c.id, label: c.label, status, fix: status === "pass" ? null : c.fix };
		});
		const frac = sec.checks.length ? pts / sec.checks.length : 1;
		const score = sec.weight * frac;
		earned += score;
		denom += sec.weight;
		sectionResults.push({ id: sec.id, title: sec.title, weight: sec.weight, present: true, optional: !!sec.optional, score: Math.round(score * 10) / 10, checks });
	}

	const overall = denom ? Math.round((earned / denom) * 100) : 0;
	const grade = overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 70 ? "C" : overall >= 60 ? "D" : "F";

	const gaps = [];
	for (const s of sectionResults) {
		if (!s.present && !s.optional) gaps.push(`Add the "${s.title}" section.`);
		for (const c of s.checks || []) {
			if (c.status !== "pass" && c.fix) gaps.push(`[${s.title}] ${c.fix}`);
		}
	}

	return { overall, grade, sections: sectionResults, gaps, generatedAt: new Date().toISOString() };
}

module.exports = { audit };
