---
name: solprd
description: God-tier PRD development and audit skill for Solana / Web3 developers. Use when the user wants to write, scaffold, score, or audit a Product Requirements Document (PRD) for a Solana project, or to get AI-assisted review of a spec. Provides a deterministic Solana PRD rubric (Mode A, offline) and a bring-your-own-key AI review (Mode B, high-end models). Trigger on: "PRD", "product requirements", "spec audit", "review my Solana doc", "score my PRD", "build spec for a Solana program/dApp/token".
---

# SolPRD — Solana PRD Dev & Audit Skill

A dual-mode skill for producing and auditing build-ready PRDs for Solana projects.

- **Mode A — Self Audit (rule-based, offline, no API key):** scores a PRD 0–100 against the built-in Solana PRD rubric and lists concrete fixes.
- **Mode B — AI-Assisted Audit (bring-your-own-key):** sends the PRD + rubric findings to a high-end model the user configures.
- **Mode C — Project Improvement:** point SolPRD at a project directory (the user's `cd` location); it scans the repo, runs rule-based project checks (structure, program, tests, wallet/client, secrets, CI), and optionally asks AI for a prioritized improvement plan grounded in the actual files.

## When to use

Use this skill whenever a task involves a Solana/Web3 PRD: drafting one, improving one, gating one in CI, or reviewing a spec for technical and security completeness.

## How to run (CLI)

The skill ships a Node CLI (Node >= 18, zero runtime dependencies).

\`\`\`bash
# Scaffold a PRD (presets: default, defi, nft, wallet, token_launch)
node bin/solprd.js init --preset wallet

# Mode A: deterministic audit (writes PRD-AUDIT.md, prints a scorecard)
node bin/solprd.js audit PRD.md

# JSON output for CI gates (exits non-zero below --min / configured minScore)
node bin/solprd.js audit PRD.md --json --min 80

# Mode B: AI review (key via env var)
ANTHROPIC_API_KEY=sk-... node bin/solprd.js audit PRD.md --ai --provider anthropic

# AI rewrite into a build-ready PRD
OPENAI_API_KEY=sk-... node bin/solprd.js improve PRD.md --provider openai --model gpt-4.1

# Mode C: scan & improve an existing project (give it the project dir)
node bin/solprd.js project /path/to/project
ANTHROPIC_API_KEY=sk-... node bin/solprd.js project . --ai

# Configure defaults & list providers
node bin/solprd.js config set provider openrouter
node bin/solprd.js providers
\`\`\`

When installed globally or via npx, replace \`node bin/solprd.js\` with \`solprd\`.

## Agent usage protocol

When an AI agent (Notion, Claude, Cursor, etc.) invokes this skill:

1. Locate or scaffold the PRD (\`init\`).
2. If solana.new skills are installed, run the enrichment workflow below before the final audit.
3. Run \`audit --json\` and parse the result (overall score, grade, per-section checks, gaps).
4. Report the score, the missing/weak sections, and the prioritized fix list.
5. If the user provided an API key + provider, run \`audit --ai\` or \`improve\` for qualitative review.
6. Never print or persist the API key. Keys come from environment variables.

## solana.new enrichment workflow

Use companion skills when they are available, but do not make them a hard dependency. Preserve evidence, unknowns, and dissenting findings instead of inventing certainty to make the PRD look complete.

### Core enrichment

1. Run \`validate-idea\` to test demand, blockchain necessity, integration-vs-build, and go/no-go confidence.
   - Add evidence to Problem & Users, Success Metrics, Risks & Mitigations, and Open Questions.
   - A no-go or pivot result must remain visible in the PRD; do not silently rewrite it as approval.
2. Run \`competitive-landscape\` to identify direct competitors, substitutes, dead projects, crowdedness, and differentiation.
   - Add the findings to Problem & Users, Solution & Scope, Risks & Mitigations, and the product's explicit differentiation.
3. Run \`review-and-iterate\` when a codebase, prototype, or program already exists.
   - Reconcile the proposed architecture with the implementation.
   - Add security findings, missing tests, compute concerns, and mainnet blockers to Security & Trust, Compute & Performance, Milestones & Rollout, and Risks & Mitigations.

### Domain routing

Select only the skills that match the product:

| PRD domain | Companion skill | PRD sections to deepen |
|---|---|---|
| DeFi, swaps, lending, vaults, liquidity | \`build-defi-protocol\` | On-chain Architecture, Tokenomics/SPL, Security & Trust |
| Indexers, analytics, monitoring, webhooks | \`build-data-pipeline\` | RPC & Infrastructure, Compute & Performance, Success Metrics |
| Mobile dApps and wallet flows | \`build-mobile\` | Wallet & UX, RPC & Infrastructure, Milestones & Rollout |
| SPL tokens, launches, bonding curves | \`launch-token\` | Tokenomics/SPL, Security & Trust, Milestones & Rollout |
| Protocol and market data decisions | \`defillama-research\` | Problem & Users, Success Metrics, Risks & Mitigations |
| Hackathon precedent and winner patterns | \`colosseum-copilot\` | Competitive context, differentiation, milestones |
| Production security posture | \`cso\` | Security & Trust, key management, supply chain, incident response |
| Build-ready implementation planning | \`scaffold-project\` | Solution & Scope, architecture, milestones, acceptance criteria |

### Merge rules

- Cite concrete evidence or label the statement as an assumption.
- Keep unresolved conflicts in Open Questions with an owner and decision deadline.
- Prefer integrating a healthy existing Solana protocol when it satisfies the requirement; document why custom on-chain code is still needed when it does not.
- Convert recommendations into testable requirements and acceptance criteria.
- Re-run \`solprd audit --json\` after enrichment and iterate until the requested threshold is met or all remaining gaps are explicitly accepted.

## The Solana PRD rubric (Mode A)

Weighted sections (total 100): Problem & Users (8), Solution & Scope (8), On-chain Architecture (12), Compute & Performance (8), RPC & Infrastructure (8), Wallet & UX (10), Tokenomics/SPL (8, optional), Security & Trust (12), Success Metrics (8), Risks & Mitigations (6), Milestones & Rollout (8), Open Questions (4). Each check returns pass / warn / fail with a concrete fix.

## Providers (Mode B)

anthropic, openai, google (Gemini), openrouter, xai (Grok), deepseek, mistral, groq, together, xiaomi (MiMo), and `custom` for any OpenAI-compatible endpoint. Keys are read from per-provider env vars (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`).

## Security

- API keys are read from environment variables; storing them in config is discouraged and warned against.
- Keys are sent only to the selected provider endpoint; nothing else leaves the machine.
- Rule-based mode is fully offline and safe for CI.

## Files

- \`bin/solprd.js\` — CLI entrypoint
- \`src/rubric.js\` — the Solana PRD rubric
- \`src/audit.js\` — Mode A engine
- \`src/ai.js\`, \`src/providers.js\` — Mode B adapters & registry
- \`src/template.js\` — PRD templates & presets
- \`src/report.js\` — terminal / Markdown / JSON reports
- \`src/config.js\` — config & key resolution
