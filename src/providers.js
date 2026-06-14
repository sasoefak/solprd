"use strict";

/**
 * Provider registry for Mode B (AI-assisted audit).
 * `api` selects the request adapter: "anthropic" | "gemini" | "openai".
 * Any OpenAI-compatible endpoint (Xiaomi MiMo, OpenRouter, local models, etc.)
 * uses api: "openai" and can override baseURL via config/env.
 */
const PROVIDERS = {
	anthropic: {
		label: "Anthropic Claude",
		api: "anthropic",
		envKey: "ANTHROPIC_API_KEY",
		baseURL: "https://api.anthropic.com/v1/messages",
		models: ["claude-opus-4-1", "claude-sonnet-4-5", "claude-3-7-sonnet-latest"],
		defaultModel: "claude-sonnet-4-5",
	},
	openai: {
		label: "OpenAI GPT",
		api: "openai",
		envKey: "OPENAI_API_KEY",
		baseURL: "https://api.openai.com/v1/chat/completions",
		models: ["gpt-5", "gpt-4.1", "gpt-4o", "o3"],
		defaultModel: "gpt-4.1",
	},
	google: {
		label: "Google Gemini",
		api: "gemini",
		envKey: "GEMINI_API_KEY",
		baseURL: "https://generativelanguage.googleapis.com/v1beta/models",
		models: ["gemini-2.5-pro", "gemini-2.5-flash"],
		defaultModel: "gemini-2.5-pro",
	},
	openrouter: {
		label: "OpenRouter (multi-model gateway)",
		api: "openai",
		envKey: "OPENROUTER_API_KEY",
		baseURL: "https://openrouter.ai/api/v1/chat/completions",
		models: ["anthropic/claude-sonnet-4.5", "openai/gpt-5", "google/gemini-2.5-pro", "x-ai/grok-4", "deepseek/deepseek-chat", "qwen/qwen-2.5-72b-instruct", "meta-llama/llama-3.3-70b-instruct"],
		defaultModel: "anthropic/claude-sonnet-4.5",
	},
	xai: {
		label: "xAI Grok",
		api: "openai",
		envKey: "XAI_API_KEY",
		baseURL: "https://api.x.ai/v1/chat/completions",
		models: ["grok-4", "grok-3"],
		defaultModel: "grok-4",
	},
	deepseek: {
		label: "DeepSeek",
		api: "openai",
		envKey: "DEEPSEEK_API_KEY",
		baseURL: "https://api.deepseek.com/v1/chat/completions",
		models: ["deepseek-chat", "deepseek-reasoner"],
		defaultModel: "deepseek-chat",
	},
	mistral: {
		label: "Mistral",
		api: "openai",
		envKey: "MISTRAL_API_KEY",
		baseURL: "https://api.mistral.ai/v1/chat/completions",
		models: ["mistral-large-latest", "codestral-latest"],
		defaultModel: "mistral-large-latest",
	},
	groq: {
		label: "Groq (fast inference)",
		api: "openai",
		envKey: "GROQ_API_KEY",
		baseURL: "https://api.groq.com/openai/v1/chat/completions",
		models: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"],
		defaultModel: "llama-3.3-70b-versatile",
	},
	together: {
		label: "Together AI",
		api: "openai",
		envKey: "TOGETHER_API_KEY",
		baseURL: "https://api.together.xyz/v1/chat/completions",
		models: ["Qwen/Qwen2.5-72B-Instruct-Turbo", "meta-llama/Llama-3.3-70B-Instruct-Turbo"],
		defaultModel: "Qwen/Qwen2.5-72B-Instruct-Turbo",
	},
	xiaomi: {
		label: "Xiaomi MiMo (OpenAI-compatible)",
		api: "openai",
		envKey: "XIAOMI_API_KEY",
		baseURL: "https://api.mimo.xiaomi.com/v1/chat/completions",
		models: ["mimo-7b-rl", "mimo-vl-7b"],
		defaultModel: "mimo-7b-rl",
		note: "Verify the official MiMo endpoint; override with `solprd config set baseURL <url>`.",
	},
	custom: {
		label: "Custom (any OpenAI-compatible endpoint)",
		api: "openai",
		envKey: "CUSTOM_API_KEY",
		baseURL: "",
		models: [],
		defaultModel: "",
		note: "Set baseURL + model via `solprd config set baseURL <url>` and `--model`.",
	},
};

module.exports = { PROVIDERS };
