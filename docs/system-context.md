---
description: Persistent project context for the distributed AI dev-orchestration system
alwaysApply: true
---

# forge-ai-workers — System Context

## System Architecture

```
You (Mac)
  │
  ├── bash ~/ask.sh "..."  OR  Dashboard /chat tab
  │         │
  │    OpenClaw (GPT-5.1-codex · Pi :18789)
  │    + Brave Search (web research, already configured)
  │         │
  │    Orchestrator API (Pi :8000)
  │         │
  │    ┌────┴────┐
  │  Dell      Lenovo          ← Dev workers (write code via Claude Code CLI)
  │    └────┬────┘
  │         │  security_pending
  │    Big Server              ← Security Worker (audits code via Claude Code CLI, 512MB cap)
  │         │  review
  │    LXD VM (qa-worker)      ← QA Worker (npm build + auto-merge via GitHub API, 8GB)
  │         │  completed
  │    Vercel (auto-deploy)
  │
  └── Dashboard (Mac · localhost:3000)
      Next.js 16 + TypeScript + Tailwind v4
      Repo: falmiron-strsdev/homebot-dashboard
```

### Machines

| Machine | Role | Hostname | LAN IP | Tailscale IP |
|---|---|---|---|---|
| Raspberry Pi 4B | Orchestrator + OpenClaw | agents-controller | 192.168.1.222 | 100.71.135.57 |
| Dell OptiPlex 7060 | Dev worker | dell-bot | 192.168.1.117 | 100.115.174.33 |
| Lenovo ThinkCentre M715q | Dev worker | homebot | 192.168.1.223 | 100.100.81.11 |
| Big Server (i7-9700, 46GB RAM) | Security worker + LXD host + media | big-server | 192.168.1.186 | logged out |
| QA Worker (LXD VM on Big Server) | QA build validator | qa-worker | 10.124.239.37 (LXD) | 100.67.33.62 |
| OptiPlex SFF (spare) | Unassigned | optiplex-small | 192.168.1.129 | — |

### Source Repos (forge-ai-workers org — private)

| Repo | Contents |
|---|---|
| `forge-ai-workers/orchestrator` | FastAPI orchestrator, repair.py, gh_poller.py, schema |
| `forge-ai-workers/worker` | Dev worker agent |
| `forge-ai-workers/qa-worker` | QA build validator + Claude analyzer |
| `forge-ai-workers/security-worker` | Security auditor + triage engine |

## Machine Access

- Connection details in `localservers.txt` in workspace root. Always read that file instead of asking.
- Never duplicate credentials into code, docs, commits, or generated files.
- Pi LAN IP `192.168.1.222` is the preferred path (Tailscale preferred for cross-network).
- Big Server Tailscale is **logged out** — use LAN IP `192.168.1.186` to reach it.

---

## Full End-to-End Pipeline

```
1. User sends request via ask.sh or Dashboard /chat
2. OpenClaw routes: status → orch.py | build → github_repo.py create-and-queue
3. github_repo.py creates GitHub repo + registers webhook + queues job
4. Dev worker (Dell or Lenovo) claims job within ~30s:
   - Clone repo → checkout work branch → run Claude Code CLI → commit → push
   - Transitions job: running → security_pending
5. Security Worker (Big Server) claims security_pending job:
   - Triage: trivial change (CSS/images/docs)? → auto-pass
   - Code change? → Claude Code CLI audits for vulnerabilities
   - HIGH/CRITICAL → job failed (security report as repair_strategy)
   - MEDIUM/LOW or clean → passes to review
6. QA Worker (LXD VM) claims review job:
   - npm install && npm run build
   - BUILD PASSES → merge PR via GitHub API → job completed → Vercel deploys
   - BUILD FAILS → Claude Code CLI analyzes error → repair brief → job failed
7. If failed: repair.py fires → queues repair job (up to 2 attempts) → escalates if cap hit
8. GitHub PR Poller (orchestrator background thread) polls GitHub API every 30s:
   - Finds review-state jobs whose PR was merged by human → marks completed + triggers Vercel
   - Replaces webhook (Pi is on private network, GitHub can't reach it)
```

**Typical happy-path timing: ~90 seconds from queue to completed + Vercel deploying**

---

## Component 1: Orchestrator (Pi)

- **Stack**: Python + FastAPI + SQLite (WAL) + uvicorn
- **Path**: `/home/falmiron/orchestrator`
- **Source**: `forge-ai-workers/orchestrator`
- **URL**: `http://192.168.1.222:8000` (LAN) or `http://100.71.135.57:8000` (Tailscale)
- **Auth**: Bearer token `API_KEY` in `.env` on all non-health endpoints
- **Start**: `nohup /home/falmiron/orchestrator/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/orch.log 2>&1 &`
- **NOT on systemd** — manual restart required after Pi reboot

### Job State Machine

```
queued → assigned → running → security_pending → security_running
                  ↘ failed                     ↘ failed (security report)
                                                      ↓
                                                   review → qa_running → completed (auto-merged)
                                                          ↘ failed (build report + Claude analysis)
                                                               ↓
                                              [repair job queued, up to 2 attempts]
                                              [escalated=1 if cap reached or non-retryable]
queued/assigned → cancelled
```

### DB Tables

| Table | Purpose |
|---|---|
| `workers` | Registered workers + heartbeat/computed_status |
| `jobs` | Every job — full state machine, qa_passed, qa_analysis, security fields |
| `job_events` | Audit trail — every status change, push, commit, security report, repair |
| `runs` | Individual execution attempts — failed_step, repair_strategy, failure_type |
| `vercel_projects` | GitHub repo → Vercel project mapping |
| `deployments` | Vercel deployment per job — status, URL, commit SHA |
| `settings` | Key/value config |

### Job Schema — Self-healing + QA + Security fields

```sql
jobs:
  attempt_count     INTEGER DEFAULT 0
  max_fix_attempts  INTEGER DEFAULT 2
  parent_job_id     TEXT REFERENCES jobs
  escalated         INTEGER DEFAULT 0
  escalation_reason TEXT
  qa_passed         INTEGER   -- NULL=not QA'd, 1=passed, 0=failed
  qa_analysis       TEXT      -- Claude's structured analysis if QA failed

runs:
  failed_step       TEXT   -- clone_failed|build_failed|security_failed|etc.
  failure_type      TEXT   -- classified by repair.py
  retryable         INTEGER DEFAULT 0
  repair_strategy   TEXT   -- QA/security Claude analysis or repair.py template
```

### API Routes

```
GET/POST   /workers                    list / register
POST       /workers/{id}/heartbeat     worker keepalive
DELETE     /workers/{id}/purge         hard-delete

GET/POST   /jobs                       list / create
PATCH      /jobs/{id}/status           force status transition
POST       /jobs/claim                 dev worker job claim (queued → assigned)
POST       /jobs/claim-qa              QA worker job claim (review → qa_running)
POST       /jobs/claim-security        security worker job claim (security_pending → security_running)
POST       /jobs/purge-bulk            bulk hard-delete by status list
GET        /jobs/{id}/lineage          full repair chain

POST       /jobs/{id}/events           append event
POST       /runs                       create run record
PATCH      /runs/{id}                  update run

POST       /chat                       proxy to OpenClaw CLI
POST       /webhook/github             GitHub PR merge webhook (limited use — see gh_poller)
POST       /vercel/trigger/{job_id}    trigger Vercel deploy
GET        /vercel/deployments         list deployments
```

### Self-Healing Repair Loop (`app/repair.py`)

Fires on every `PATCH /jobs/{id}/status → failed`. QA-aware:

- If run has `## QA Build Failure Analysis` in `repair_strategy` → **preserves it** (never overwrites)
- Parses `failure_type` + `confidence` from QA analysis for smarter decisions
- `env_missing` from QA → escalates immediately (can't fix env from repo)
- `confidence: low` after 1+ attempt → escalates instead of wasting cap
- Repair prompt leads with full Claude analysis when QA-sourced

### GitHub PR Poller (`app/gh_poller.py`)

Runs as background thread at startup. Polls GitHub API every 30s:
- Queries all `review`-state jobs
- Calls `GET /repos/{owner}/{repo}/pulls?head={branch}&state=closed`
- Found merged → marks `completed` + triggers Vercel
- **Replaces the webhook** for private/local deployments (Pi not publicly accessible)

---

## Component 2: Dev Worker Agent (Dell + Lenovo)

- **Path**: `/home/falmiron/worker`
- **Source**: `forge-ai-workers/worker`
- **Service**: `worker-agent.service` (systemd, enabled, auto-restart)
- **Claude Code**: Dell `2.1.71` · Lenovo `2.1.70`

### Pipeline

1. Poll `POST /jobs/claim` every 30s
2. Clone repo → checkout work branch
3. Run Claude Code CLI with job summary + acceptance criteria
4. `_ensure_gitignore()` — patches safety exclusions before `git add -A`
5. Commit + push branch
6. Transition: `running → security_pending` ← **goes to security worker first**

### Worker .env (key fields)

```
ORCH_URL=http://100.71.135.57:8000
CAPABILITIES=python,nodejs,git,claude-code[,openclaw on Dell]
GIT_SSH_KEY=/home/falmiron/.ssh/id_ed25519_worker
CLAUDE_CODE_CMD=/home/falmiron/.local/bin/claude
CLAUDE_TIMEOUT_SECS=1800
```

---

## Component 2b: Security Worker (Big Server — direct systemd service)

- **Path**: `/home/falmiron/security-worker`
- **Source**: `forge-ai-workers/security-worker`
- **Service**: `security-worker.service` (systemd, enabled, `MemoryMax=512M`)
- **Claude Code**: v2.1.33 (on Big Server)
- **No VM** — runs directly on host, 512MB memory cap enforced by systemd

### Pipeline

1. Poll `POST /jobs/claim-security` every 20s
2. Clone repo + checkout work branch
3. **Triage** (no Claude needed):
   - All changes in `.css`/`.scss`/images/docs → auto-pass
   - No high-risk patterns in diff → fast pass
4. **Deep audit** via Claude Code CLI (when code files changed):
   - Reads diff + changed file contents
   - Returns structured JSON: `verdict`, `overall_severity`, `issues[]`, `repair_strategy`
5. **PASS** (`clean`/`low`/`medium`): transition `security_running → review`
6. **FAIL** (`high`/`critical`): security report stored as `repair_strategy` → `failed`

### .env (key fields)

```
ORCH_URL=http://192.168.1.222:8000   ← LAN IP (Tailscale logged out on Big Server)
CAPABILITIES=security,git,claude-code
GIT_SSH_KEY=/home/falmiron/.ssh/id_ed25519_worker
CLAUDE_CODE_CMD=/home/falmiron/.local/bin/claude
CLAUDE_TIMEOUT_SECS=180
```

---

## Component 2c: QA Worker (LXD VM on Big Server)

- **Path**: `/home/ubuntu/qa-worker`
- **Source**: `forge-ai-workers/qa-worker`
- **Service**: `qa-worker.service` (systemd, enabled, auto-restart inside VM)
- **VM**: LXD `qa-worker` on Big Server — 8GB RAM, 4 vCPUs, Ubuntu 24.04
- **Tailscale IP**: `100.67.33.62`
- **Claude Code**: v2.1.72 (newest in fleet)
- **LXD NAT**: `iptables -t nat -A POSTROUTING -s 10.18.65.0/24 -o eno1 -j MASQUERADE` + FORWARD rules (persisted in `/etc/rc.local`)

### Pipeline

1. Poll `POST /jobs/claim-qa` every 20s (claims `review` jobs)
2. Clone repo + checkout work branch
   - Branch not on remote (no changes made) → mark `completed` directly
3. `npm install --legacy-peer-deps`
4. `npm run build` (NODE_OPTIONS=--max-old-space-size=4096)
5. **PASS**: find PR via GitHub API → squash merge → `PATCH job → completed` → trigger Vercel
6. **FAIL**: call Claude Code CLI → structured JSON analysis → repair brief → `PATCH job → failed`

**No webhook dependency** — QA worker marks job `completed` directly + calls `/vercel/trigger/{id}`.

### QA Claude Analysis Format

```
## QA Build Failure Analysis
Root Cause: <one sentence>
Failure Type: dependency_missing|type_error|syntax_error|build_config|env_missing|...
Confidence: high|medium|low
Affected Files: [list]
Suggested Fix: <2-4 sentences>
Repair Instructions: <step-by-step>
Build Error (last 1500 chars): <raw output>
```

### .env (key fields)

```
ORCH_URL=http://192.168.1.222:8000
CAPABILITIES=qa,build,nodejs,git
GIT_SSH_KEY=/home/ubuntu/.ssh/id_ed25519_worker
CLAUDE_CODE_CMD=/usr/bin/claude
GITHUB_TOKEN=<in localservers.txt>
GITHUB_OWNER=falmiron-strsdev
```

---

## Component 3: OpenClaw Smart Layer (Pi)

- **Model**: `openai/gpt-5.1-codex` (391k context)
- **Gateway**: `openclaw-gateway.service` (system-level systemd, port 18789)
- **Invocation**: `bash ~/ask.sh "..."` → `openclaw agent --agent main --session-id X --message "..." --json`
- **Also**: Dashboard `/chat` page → `POST /chat` on orchestrator → CLI
- **Web search**: Brave Search (native, already configured)

### OpenClaw tools

| Tool | Function |
|---|---|
| `orch.py workers` | Live fleet status |
| `orch.py jobs [status]` | Queue status |
| `orch.py job <id>` | Full job detail |
| `orch.py create` | Queue a new coding job |
| `github_repo.py create-and-queue` | Create repo + queue initial job |
| `web_search` (native) | Brave Search |

---

## Component 4: GitHub Integration

- **System org**: `forge-ai-workers` (private) — source of truth for all worker + orchestrator code
- **Deploy account**: `falmiron-strsdev` — all SSH git ops, all repos, Vercel connected
- **SSH key**: `~/.ssh/id_ed25519_worker` on Dell, Lenovo, QA VM, Security Worker, Big Server
- **All git ops**: SSH remotes only (`git@github.com:…`), `IdentitiesOnly=yes`
- **GitHub token**: in `localservers.txt` — used by QA worker (auto-merge) and gh_poller

### Repo creation flow

`github_repo.py create-and-queue`:
1. Creates repo with `--add-readme` (ensures main branch exists)
2. Registers webhook via `gh api repos/{repo}/hooks`
3. Queues initial job

**Note**: Webhook fires to `http://100.71.135.57:8000/webhook/github` — Pi not publicly accessible, so webhook only works if Pi is reachable. The `gh_poller` in the orchestrator handles completion for repos where webhook doesn't reach.

---

## Component 5: Vercel Integration

- **Account**: `fabian-almiron` on vercel.com
- **GitHub App**: installed on `falmiron-strsdev` (all repos)
- **Token**: in Pi `.env` as `VERCEL_TOKEN`
- **Trigger**: called by QA worker after successful merge, or by `gh_poller` after detecting merged PR

---

## Component 6: Dashboard

- **Local path**: `/Users/fabianalmiron/Documents/Home Bot/homebot-dashboard`
- **Repo**: `falmiron-strsdev/homebot-dashboard` (public)
- **Stack**: Next.js 16, TypeScript, Tailwind v4, App Router, react-icons
- **Dev**: `npm run dev` → http://localhost:3000
- **Config**: `.env.local` with `ORCH_URL` + `ORCH_API_KEY` (never committed)

### Job status colors in dashboard

| Status | Color |
|---|---|
| `queued` | slate |
| `assigned` | indigo |
| `running` | blue (pulsing) |
| `security_pending` / `security_running` | orange (pulsing when running) |
| `review` | purple |
| `qa_running` | cyan (pulsing) |
| `completed` | emerald |
| `failed` | red |

### Dashboard banners

- Orange pulsing: security audit in progress
- Cyan pulsing: QA build in progress
- Green: QA passed (PR auto-merged)
- Red panel: QA/security failed — shows full Claude analysis

---

## Git Auth

- All git ops: SSH, `IdentitiesOnly=yes`, never HTTPS
- Dell git identity: `dell-bot / dell-bot@agents.local`
- Lenovo git identity: `homebot / homebot@agents.local`
- QA worker git identity: `ubuntu` (uses `id_ed25519_worker`)
- Security worker git identity: `falmiron` (uses `id_ed25519_worker`)

---

## Hardening Applied

- Metadata artifacts (`.job_spec.json`, `.claude_prompt.md`) go to `LOG_DIR`, never in repos
- `.gitignore` safety patch enforced before every commit on all dev workers
- Fake git/curl in `/home/falmiron/openclaw-bin/` blocks gateway agent from running git
- GitHub PR poller replaces webhook (Pi not publicly accessible)
- QA worker → `completed` directly (no webhook round-trip, eliminates infinite loop risk)
- Security worker memory cap: 512MB enforced via systemd `MemoryMax`
- All `.env` files excluded from `forge-ai-workers` repos — `.env.example` with placeholders provided

---

## Known Limitations / Open Items

- **AI injection hardening (partial)**: OpenClaw has injection-resistant prompts for email + web search, but no AI system is 100% injection-proof. Future improvements: multi-layer validation, output filtering before action execution, sandboxed research mode that physically cannot call action tools, and anomaly detection on job creation patterns.
- **Orchestrator not on systemd**: Pi reboot requires manual `nohup uvicorn ...` restart
- **Big Server Tailscale logged out**: security worker uses LAN IP `192.168.1.186` — Tailscale reconnect needed for remote access
- **Vercel deploys work branch**: deploys the feature branch, not `main` post-merge
- **Token/cost tracking**: schema columns ready on `runs`, workers not yet parsing Claude output
- **Orchestrator log rotation**: not configured
- **OptiPlex SFF (192.168.1.129)**: disk thrashing issue (HDD), not yet set up as worker
- **Repair worker reassignment**: `preferred_worker_id` metadata only, not enforced at claim

---

## Operational Preferences

- Preserve orchestrator/worker architecture in all changes
- No Docker, Redis, RabbitMQ, Kubernetes, or unnecessary cloud infra
- Simple, explicit, inspectable solutions
- Reliability and debuggability over cleverness
- Before large changes: briefly summarize current state and planned change
- Never reintroduce metadata-file leaks into repos
- Always preserve pinned SSH key + IdentitiesOnly behavior
- When restarting orchestrator: kill old uvicorn, wait 2s, start fresh with nohup
- Big Server Tailscale is logged out — use LAN IP `192.168.1.186` for SSH; security worker ORCH_URL uses Pi LAN IP `192.168.1.222`
- LXD NAT rules on Big Server reset on reboot — rc.local persists them but verify if VM loses internet
