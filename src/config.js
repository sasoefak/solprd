"use strict";

const fs = require("fs");
const path = require("path");
const { PROVIDERS } = require("./providers");

const CONFIG_FILE = path.resolve(process.cwd(), "solprd.config.json");

const DEFAULT_CONFIG = {
	provider: "anthropic",
	model: null, // null => provider default
	baseURL: null, // override endpoint (custom / self-hosted)
	minScore: 70, // CI gate threshold
	prdFile: "PRD.md",
};

function load() {
	try {
		const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
		return Object.assign({}, DEFAULT_CONFIG, raw);
	} catch (e) {
		return Object.assign({}, DEFAULT_CONFIG);
	}
}

function save(cfg) {
	const clean = Object.assign({}, cfg);
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(clean, null, 2) + "\n");
	return CONFIG_FILE;
}

/**
 * Resolve the API key. Priority: environment variable > config.keys (discouraged).
 * Storing keys in config is allowed but warned against; env vars are preferred.
 */
function resolveKey(providerKey, cfg) {
	const p = PROVIDERS[providerKey];
	if (!p) return null;
	if (process.env[p.envKey]) return process.env[p.envKey];
	if (cfg && cfg.keys && cfg.keys[providerKey]) return cfg.keys[providerKey];
	return null;
}

function resolveModel(providerKey, cfg) {
	if (cfg && cfg.model) return cfg.model;
	const p = PROVIDERS[providerKey];
	return p ? p.defaultModel : null;
}

function resolveBaseURL(providerKey, cfg) {
	if (cfg && cfg.baseURL) return cfg.baseURL;
	const p = PROVIDERS[providerKey];
	return p ? p.baseURL : null;
}

module.exports = { CONFIG_FILE, DEFAULT_CONFIG, load, save, resolveKey, resolveModel, resolveBaseURL };
