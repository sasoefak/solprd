"use strict";

/**
 * Minimal, dependency-free Markdown sectionizer.
 * Splits a Markdown document into sections keyed by their heading.
 */
function parseSections(markdown) {
	const lines = (markdown || "").split(/\r?\n/);
	const sections = [];
	let current = { title: "__preamble__", level: 0, lines: [] };

	for (const line of lines) {
		const m = /^(#{1,6})\s+(.*)$/.exec(line);
		if (m) {
			if (current.lines.length || current.title !== "__preamble__") {
				sections.push(current);
			}
			current = { title: m[2].trim(), level: m[1].length, lines: [] };
		} else {
			current.lines.push(line);
		}
	}
	sections.push(current);

	return sections.map((s) => ({
		title: s.title,
		level: s.level,
		text: s.lines.join("\n").trim(),
	}));
}

module.exports = { parseSections };
