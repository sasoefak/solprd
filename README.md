# SolPRD

**God-tier PRD development & audit tooling for Solana developers.** Install it as an agent skill in your project, or run the CLI. Three audit engines:

1. **Mode A — Self Audit (rule-based, offline):** scores your PRD 0–100 against a Solana-native rubric. No API key. CI-friendly.
2. **Mode B — AI-Assisted Audit (bring-your-own-key):** deep qualitative review and rewrite using a high-end model you choose.
3. **Mode C — Project Improvement:** point it at a project directory and it scans the codebase, audits structure/security/tests, and (optionally) returns an AI improvement plan.

## Install

```bash
# from this folder
npm install -g .
# or run directly
node bin/solprd.js help
# or, once published
npx solprd help
```

Requires Node.js >= 18. Zero runtime dependencies.

## Quick start

```bash
solprd init --preset wallet     # scaffold PRD.md (presets: default, defi, nft, wallet, token_launch)
solprd audit                    # Mode A scorecard + PRD-AUDIT.md
solprd audit --json --min 80    # CI gate: exits non-zero below 80
solprd audit --ai               # Mode B AI review (needs API key)
solprd improve                  # AI rewrite -> PRD-IMPROVED.md
solprd project /path/to/proj    # Mode C: scan a project dir + improvement plan
solprd project . --ai           # Mode C with AI plan -> PROJECT-IMPROVEMENTS.md
solprd providers                # list supported models
```

## solana.new companion skills

When SolPRD is used as an agent skill, it can orchestrate installed solana.new skills before the final audit:

- `validate-idea` adds demand evidence, blockchain necessity, risks, and a go/no-go verdict.
- `competitive-landscape` adds competitors, substitutes, failed precedents, and differentiation.
- `build-defi-protocol`, `build-data-pipeline`, `build-mobile`, and `launch-token` deepen domain-specific technical requirements.
- `defillama-research` and `colosseum-copilot` add market and ecosystem evidence.
- `review-and-iterate` and `cso` turn implementation and security findings into PRD requirements and launch blockers.
- `scaffold-project` converts the enriched PRD into build-ready architecture and milestones.

These integrations are optional agent workflows. The CLI keeps zero runtime dependencies and its offline audit behavior is unchanged.

## Configure AI (Mode B)

Keys are read from environment variables (recommended):

```bash
export ANTHROPIC_API_KEY=sk-...
solprd config set provider anthropic
solprd audit --ai
```

Supported providers: `anthropic`, `openai`, `google`, `openrouter`, `xai`, `deepseek`, `mistral`, `groq`, `together`, `xiaomi`, and `custom` (any OpenAI-compatible endpoint). For `custom`/self-hosted/Xiaomi MiMo, set the endpoint:

```bash
solprd config set provider custom
solprd config set baseURL https://your-endpoint/v1/chat/completions
export CUSTOM_API_KEY=...
solprd audit --ai --model your-model
```

## The Solana PRD rubric

Weighted, Solana-specific sections (total 100): Problem & Users, Solution & Scope, On-chain Architecture (PDAs/accounts/rent), Compute & Performance (CU/priority fees/retries), RPC & Infrastructure (providers/limits/indexing), Wallet & UX, Tokenomics/SPL (optional), Security & Trust (upgrade authority/keys/abuse vectors), Success Metrics, Risks & Mitigations, Milestones & Rollout, Open Questions.

## Security

API keys live in env vars and are sent only to the chosen provider. Rule-based mode is fully offline.

## Programmatic API

```js
const { audit } = require("solprd");
const result = audit(fs.readFileSync("PRD.md", "utf8"));
console.log(result.overall, result.grade, result.gaps);
```

## License

MIT
