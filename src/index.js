"use strict";

// Programmatic API — import these in your own scripts or an agent.
module.exports = {
	audit: require("./audit").audit,
	rubric: require("./rubric"),
	providers: require("./providers").PROVIDERS,
	config: require("./config"),
	ai: require("./ai"),
	report: require("./report"),
	template: require("./template"),
	project: require("./project"),
};
