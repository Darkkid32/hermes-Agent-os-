# Hermes Agent OS Runtime - Complete Installation, VPS Hosting, And Configuration Guide

Package with this guide included:

`Hermes-Agent-OS-polished-dashboard-local-install-tutorial-2026-07-06.zip`

Live reference build:

`https://scheduling-great-sends-sixth.trycloudflare.com`

This guide is written for someone receiving the zip file for the first time. It covers:

1. What is inside the package.
2. How to install it locally for a first smoke test.
3. How to host the full system on a VPS.
4. How to secure it with Nginx and HTTPS.
5. How to power it with OpenRouter, MiniMax, Ollama, and other API keys.
6. How to configure every dashboard card.
7. How to run the real Firecrawl Open Agent Builder.
8. How to test, troubleshoot, back up, and export safely.

## 1. What You Are Installing

Hermes Agent OS Runtime is a local-first/self-hostable Agent OS dashboard.

It includes:

- Hermes Agent Hub dashboard UI.
- Express backend API.
- Real `@elizaos/core` runtime dependency.
- Vendored upstream `firecrawl/open-agent-builder` source.
- Hermes purple theme override for the builder.
- Blank upstream-style starter workflow.
- Module registry for agents, providers, self modules, builder, logs, and runtime status.
- Local state store under `~/.hermes-agent-os` locally or `/var/lib/hermes-agent-os` on VPS.
- Clean export command with audit.

It does not include:

- Your API keys.
- Your private workflows.
- Your local runtime data.
- Your logs.
- Your Hermes profiles.
- Your machine paths.
- Fake connected status for missing tools.

## 2. Package Contents

The zip contains:

```text
README.md
SETUP-GUIDE.md
package.json
package-lock.json
.env.example
server/
src/build output files
test/
scripts/
sample-data/
vendor/open-agent-builder/
```

Important files:

- `package.json`: install, build, start, test, builder, and export scripts.
- `.env.example`: all environment variables users can configure.
- `server/index.js`: backend API and app server.
- `server/runtime/`: module registry, logs, workflows, local state, exporters.
- `vendor/open-agent-builder/`: original builder source with Hermes theme override.
- `SETUP-GUIDE.md`: this guide.

## 3. System Requirements

Local:

- Node.js 20 or newer.
- npm.
- Terminal.
- Optional Ollama for local models.

VPS:

- Ubuntu 22.04 or 24.04 recommended.
- 2 GB RAM minimum for dashboard/API only.
- 4 GB+ RAM recommended.
- GPU VPS only if you want useful local Ollama model performance on the server.
- Domain name if hosting publicly.
- SSH access.

Ports:

- Public: `80`, `443`.
- Internal only: `4173` for Hermes, `3100` for builder, `11434` for Ollama.

## 4. First Local Smoke Test

Do this once before giving the package to a server admin. It proves the zip works.

```bash
cd ~/Desktop
unzip Hermes-Agent-OS-polished-dashboard-local-install-tutorial-2026-07-06.zip -d Hermes-Agent-OS
cd Hermes-Agent-OS
npm install
cp .env.example .env
npm run build
npm start
```

Open:

```text
http://localhost:4173
```

Health check:

```bash
curl http://localhost:4173/api/health
```

Expected:

```json
{
  "ok": true
}
```

Stop local server with `Ctrl+C`.

## 5. VPS Hosting First

This is the production path. Do this before teaching normal users to connect API keys.

### 5.1 Point DNS

Create a DNS `A` record:

```text
agent.yourdomain.com -> YOUR_VPS_IP
```

Wait until DNS resolves:

```bash
dig agent.yourdomain.com
```

### 5.2 Upload Zip To VPS

From your local machine:

```bash
scp ~/Desktop/Hermes-Agent-OS-polished-dashboard-local-install-tutorial-2026-07-06.zip root@YOUR_VPS_IP:/root/
```

SSH:

```bash
ssh root@YOUR_VPS_IP
```

### 5.3 Create App User

```bash
adduser hermes
usermod -aG sudo hermes
```

### 5.4 Install Server Packages

```bash
apt update
apt install -y curl ca-certificates unzip nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

### 5.5 Unzip App

```bash
mkdir -p /opt/hermes-agent-os
unzip /root/Hermes-Agent-OS-polished-dashboard-local-install-tutorial-2026-07-06.zip -d /opt/hermes-agent-os
chown -R hermes:hermes /opt/hermes-agent-os
```

Find the app root:

```bash
find /opt/hermes-agent-os -maxdepth 3 -name package.json
```

If `package.json` is directly in `/opt/hermes-agent-os`, use that as the working directory.

If it is nested, move files up or use the nested directory in the systemd service.

### 5.6 Install App Dependencies

```bash
cd /opt/hermes-agent-os
npm install
npm run build
npm test
```

## 6. VPS Environment File

Create a protected server env file:

```bash
mkdir -p /etc/hermes-agent-os
nano /etc/hermes-agent-os/hermes.env
```

Start with safe values:

```bash
NODE_ENV=production
PORT=4173
HERMES_AGENT_OS_HOME=/var/lib/hermes-agent-os
HERMES_AGENT_OS_ENABLE_EXEC=0
HERMES_AGENT_OS_ENABLE_INSTALL=0
HERMES_AGENT_OS_ADMIN_TOKEN=replace-with-long-random-admin-token
HERMES_AGENT_HUB_PUBLIC_URL=https://agent.yourdomain.com
HERMES_AGENT_HUB_GITHUB_REPO=
HERMES_HOME=/var/lib/hermes
HERMES_BUILDER_PORT=3100

# Local/open provider routing
OPENROUTER_API_KEY=
OLLAMA_HOST=http://127.0.0.1:11434
MINIMAX_API_KEY=

# Hosted LLM providers
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
ARCADE_API_KEY=

# Builder execution and auth
FIRECRAWL_API_KEY=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER_DOMAIN=

# Optional local CLI paths
CLAUDE_CODE_PATH=
CLAUDE_CLI_PATH=
CODEX_CLI_PATH=
GEMINI_CLI_PATH=
OPENCODE_CLI_PATH=
OPENCLAUDE_CLI_PATH=
OPENCLAUDE_API_KEY=
OPENCLAW_CLI_PATH=
OPENCLAW_HOME=
```

Secure it:

```bash
mkdir -p /var/lib/hermes-agent-os
mkdir -p /var/lib/hermes
chown -R hermes:hermes /var/lib/hermes-agent-os /var/lib/hermes
chown root:hermes /etc/hermes-agent-os/hermes.env
chmod 640 /etc/hermes-agent-os/hermes.env
```

## 7. Systemd Service For Hermes

Create service:

```bash
nano /etc/systemd/system/hermes-agent-os.service
```

Paste:

```ini
[Unit]
Description=Hermes Agent OS Runtime
After=network.target

[Service]
Type=simple
User=hermes
Group=hermes
WorkingDirectory=/opt/hermes-agent-os
EnvironmentFile=/etc/hermes-agent-os/hermes.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Start:

```bash
systemctl daemon-reload
systemctl enable hermes-agent-os
systemctl start hermes-agent-os
systemctl status hermes-agent-os
```

Check local backend:

```bash
curl http://127.0.0.1:4173/api/health
curl http://127.0.0.1:4173/api/modules
```

Logs:

```bash
journalctl -u hermes-agent-os -f
```

## 8. Nginx Reverse Proxy

Create config:

```bash
nano /etc/nginx/sites-available/hermes-agent-os
```

Paste:

```nginx
server {
    listen 80;
    server_name agent.yourdomain.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable:

```bash
ln -sf /etc/nginx/sites-available/hermes-agent-os /etc/nginx/sites-enabled/hermes-agent-os
nginx -t
systemctl reload nginx
```

Open:

```text
http://agent.yourdomain.com
```

## 9. HTTPS With Certbot

Install:

```bash
apt install -y snapd
snap install core
snap refresh core
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot
```

Issue certificate:

```bash
certbot --nginx -d agent.yourdomain.com
```

Test renewal:

```bash
certbot renew --dry-run
```

Open:

```text
https://agent.yourdomain.com
```

## 10. VPS Firewall

Allow SSH, HTTP, HTTPS:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

Do not publicly expose:

```text
4173
3100
11434
```

## 11. Power The System With OpenRouter

OpenRouter is the easiest hosted router for many models.

Create an OpenRouter API key, then edit:

```bash
nano /etc/hermes-agent-os/hermes.env
```

Set:

```bash
OPENROUTER_API_KEY=your-openrouter-api-key
```

Restart:

```bash
systemctl restart hermes-agent-os
```

Dashboard:

```text
https://agent.yourdomain.com
Model Providers -> OpenRouter
```

Save:

```bash
OPENROUTER_API_KEY=your-openrouter-api-key
```

Then configure routing:

```text
Agents -> Free Claude Code
```

Fields:

```bash
OPENROUTER_API_KEY=your-openrouter-api-key
OLLAMA_HOST=http://127.0.0.1:11434
MINIMAX_API_KEY=optional-minimax-key
```

Important:

`Free Claude Code` means user-owned/local/open provider routing. It does not provide free Anthropic access.

API test:

```bash
curl -X POST https://agent.yourdomain.com/api/modules/provider-openrouter/test \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 12. Power The System With MiniMax

MiniMax is configured by API key.

Edit:

```bash
nano /etc/hermes-agent-os/hermes.env
```

Set:

```bash
MINIMAX_API_KEY=your-minimax-api-key
```

Restart:

```bash
systemctl restart hermes-agent-os
```

Dashboard:

```text
Model Providers -> MiniMax
Agents -> Free Claude Code
```

API configure:

```bash
curl -X POST https://agent.yourdomain.com/api/connections/provider-minimax/configure \
  -H "Content-Type: application/json" \
  -d '{"fields":{"MINIMAX_API_KEY":"your-minimax-api-key"}}'
```

## 13. Power The System With Ollama

Use Ollama when you want local models.

VPS warning:

- Small CPU VPS can run tiny models slowly.
- Good local model performance usually needs enough RAM and/or GPU.
- Never expose Ollama publicly.

Install:

```bash
curl -fsSL https://ollama.com/install.sh | sh
systemctl enable ollama
systemctl start ollama
```

Pull models:

```bash
ollama pull llama3.1
ollama pull qwen2.5-coder
```

Check:

```bash
curl http://127.0.0.1:11434/api/tags
```

Set:

```bash
OLLAMA_HOST=http://127.0.0.1:11434
```

Restart Hermes:

```bash
systemctl restart hermes-agent-os
```

Dashboard:

```text
Model Providers -> Ollama
Agents -> Free Claude Code
```

## 14. Configure Other Provider Keys

Add only the keys you actually use.

Anthropic:

```bash
ANTHROPIC_API_KEY=your-anthropic-key
```

OpenAI:

```bash
OPENAI_API_KEY=your-openai-key
```

Gemini:

```bash
GEMINI_API_KEY=your-gemini-key
```

Firecrawl:

```bash
FIRECRAWL_API_KEY=your-firecrawl-key
```

Groq:

```bash
GROQ_API_KEY=your-groq-key
```

Arcade:

```bash
ARCADE_API_KEY=your-arcade-key
```

Restart:

```bash
systemctl restart hermes-agent-os
```

## 15. Complete Dashboard Configuration Table

| Dashboard card | Type | Configure fields | Install command / note | What it is for |
|---|---|---|---|---|
| Mission Control | Workspace | none | included | Overview of runtime, modules, providers, builder, gateway. |
| Agent Builder | Workspace | Convex, Clerk, Firecrawl, LLM keys | `npm run builder:install`, `npm run builder:start` | Real Firecrawl Open Agent Builder in Hermes theme. |
| Claude Code | Agent CLI | `CLAUDE_CODE_PATH`, `ANTHROPIC_API_KEY` | `npm install -g @anthropic-ai/claude-code` | Claude Code CLI workflows. |
| OpenClaw | Agent CLI/manual | `OPENCLAW_CLI_PATH`, `OPENCLAW_HOME` | manual trusted install | Browser/tool automation if user has OpenClaw. |
| OpenClaude | Agent CLI/manual | `OPENCLAUDE_CLI_PATH`, `OPENCLAUDE_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_HOST` | manual compatible CLI | Claude-style local/open routing. |
| Hermes | Agent runtime | `HERMES_HOME` | point to existing Hermes profile dir | Existing Hermes local profiles, memory, gateway. |
| Gemini | Agent CLI/provider | `GEMINI_CLI_PATH`, `GEMINI_API_KEY` | `npm install -g @google/gemini-cli` | Gemini CLI/API workflows. |
| Codex | Agent CLI/provider | `CODEX_CLI_PATH`, `OPENAI_API_KEY` | `npm install -g @openai/codex` | Codex CLI/OpenAI workflows. |
| OpenCode | Agent CLI | `OPENCODE_CLI_PATH` | `npm install -g opencode-ai` | OpenCode local CLI workflows. |
| Free Claude Code | Routing profile | `OPENROUTER_API_KEY`, `OLLAMA_HOST`, `MINIMAX_API_KEY` | no install | User-owned/local Claude-style routing. |
| Goals | Self module | none | included | Local goal records. |
| SEO | Self module | none | included | Local SEO brief/audit records. |
| Video | Self module | none | included | Local video workflow records. |
| Notebook | Self module | none | included | Local private notes. |
| Kanban | Self module | none | included | Local work cards/queues. |
| Usage Credits | Self module | none | included | Manual usage and estimated spend tracking. |
| Anthropic | Provider | `ANTHROPIC_API_KEY` | no install | Claude API access. |
| OpenAI | Provider | `OPENAI_API_KEY` | no install | OpenAI/Codex model routing. |
| Gemini API | Provider | `GEMINI_API_KEY` | no install | Gemini model routing. |
| OpenRouter | Provider | `OPENROUTER_API_KEY` | no install | Hosted model router. |
| Ollama | Provider | `OLLAMA_HOST` | install Ollama separately | Local model routing. |
| MiniMax | Provider | `MINIMAX_API_KEY` | no install | MiniMax API routing. |
| Firecrawl | Provider | `FIRECRAWL_API_KEY` | no install | Web/data actions in builder. |
| Convex | Provider | `NEXT_PUBLIC_CONVEX_URL` | external Convex app | Builder workflow storage. |
| Clerk | Provider | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN` | external Clerk app | Builder auth. |

## 16. Real Agent Builder Setup

The builder is vendored from `firecrawl/open-agent-builder`.

Hermes changes:

- Purple theme override.
- Proxy under Hermes dashboard.
- No fake lead workflow.
- Blank starter workflow only.

Install:

```bash
cd /opt/hermes-agent-os
npm run builder:install
```

Required values:

```bash
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER_DOMAIN=
```

Execution values:

```bash
FIRECRAWL_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
ARCADE_API_KEY=
```

Create builder service:

```bash
nano /etc/systemd/system/hermes-agent-builder.service
```

Paste:

```ini
[Unit]
Description=Hermes Open Agent Builder
After=network.target hermes-agent-os.service

[Service]
Type=simple
User=hermes
Group=hermes
WorkingDirectory=/opt/hermes-agent-os
EnvironmentFile=/etc/hermes-agent-os/hermes.env
ExecStart=/usr/bin/npm run builder:start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Start:

```bash
systemctl daemon-reload
systemctl enable hermes-agent-builder
systemctl start hermes-agent-builder
systemctl status hermes-agent-builder
```

Check:

```bash
curl http://127.0.0.1:4173/api/builder/status
```

Open:

```text
https://agent.yourdomain.com/agent-builder
```

## 17. CLI Agent Installation

Install only what you use.

Claude Code:

```bash
npm install -g @anthropic-ai/claude-code
which claude
claude --version
```

Codex:

```bash
npm install -g @openai/codex
which codex
codex --version
```

Gemini CLI:

```bash
npm install -g @google/gemini-cli
which gemini
gemini --version
```

OpenCode:

```bash
npm install -g opencode-ai
which opencode
opencode --version
```

After install:

```bash
systemctl restart hermes-agent-os
```

## 18. Execution And Install Safety

Default safe values:

```bash
HERMES_AGENT_OS_ENABLE_EXEC=0
HERMES_AGENT_OS_ENABLE_INSTALL=0
```

What this means:

- Dashboard can show install commands.
- Dashboard can save config.
- Dashboard can test state.
- Run endpoint stays dry-run for CLI execution.

Enable only on trusted machines:

```bash
HERMES_AGENT_OS_ENABLE_EXEC=1
HERMES_AGENT_OS_ENABLE_INSTALL=1
```

Restart:

```bash
systemctl restart hermes-agent-os
```

## 19. How To Use Each Self Module

Self modules work immediately. No API keys required.

Goals:

- Open `Self -> Goals`.
- Add title, status, notes.
- Use it for local goal tracking.

SEO:

- Open `Self -> SEO`.
- Add title, URL, keyword, status, notes.
- Use it for site audits or content briefs.

Video:

- Open `Self -> Video`.
- Add title, source path, workflow, status, notes.
- Use it for video workflow tracking.

Notebook:

- Open `Self -> Notebook`.
- Add title and body.
- Use it for local notes and run journals.

Kanban:

- Open `Self -> Kanban`.
- Add title, column, notes.
- Use columns like `todo`, `doing`, `done`.

Usage Credits:

- Open `Self -> Usage Credits`.
- Add provider, units, estimated cost.
- Use it to track API spend manually.

## 20. API Test Commands

Health:

```bash
curl https://agent.yourdomain.com/api/health
```

Modules:

```bash
curl https://agent.yourdomain.com/api/modules
```

Full OS audit with fix recommendations:

```bash
curl https://agent.yourdomain.com/api/os/audit
```

Connections:

```bash
curl https://agent.yourdomain.com/api/connections
```

OpenRouter test:

```bash
curl -X POST https://agent.yourdomain.com/api/modules/provider-openrouter/test \
  -H "Content-Type: application/json" \
  -d '{}'
```

MiniMax test:

```bash
curl -X POST https://agent.yourdomain.com/api/modules/provider-minimax/test \
  -H "Content-Type: application/json" \
  -d '{}'
```

Ollama test:

```bash
curl -X POST https://agent.yourdomain.com/api/modules/provider-ollama/test \
  -H "Content-Type: application/json" \
  -d '{}'
```

Logs:

```bash
curl https://agent.yourdomain.com/api/modules/goals/logs
```

Create a goal:

```bash
curl -X POST https://agent.yourdomain.com/api/self/goals/items \
  -H "Content-Type: application/json" \
  -d '{"title":"First VPS setup","status":"done","notes":"Hermes Agent OS deployed"}'
```

## 21. Local Runtime Data And Backups

Local machine:

```text
~/.hermes-agent-os
```

VPS:

```text
/var/lib/hermes-agent-os
```

Backup VPS:

```bash
tar -czf hermes-agent-os-backup.tar.gz /var/lib/hermes-agent-os /etc/hermes-agent-os/hermes.env
```

Restore:

```bash
tar -xzf hermes-agent-os-backup.tar.gz -C /
chown -R hermes:hermes /var/lib/hermes-agent-os
systemctl restart hermes-agent-os
```

## 22. Clean Export

Set an admin token:

```bash
HERMES_AGENT_OS_ADMIN_TOKEN=replace-with-token
```

Run:

```bash
npm run prepare-export
```

The export audit blocks:

- API keys.
- token-like secrets.
- local home paths.
- private Hermes profile paths.
- local runtime data.
- logs and run history.
- private workflow data.

## 23. Update Procedure On VPS

Stop:

```bash
systemctl stop hermes-agent-os
systemctl stop hermes-agent-builder
```

Replace files or unzip new package into `/opt/hermes-agent-os`.

Then:

```bash
cd /opt/hermes-agent-os
npm install
npm run build
npm test
systemctl start hermes-agent-os
systemctl start hermes-agent-builder
```

Check:

```bash
curl http://127.0.0.1:4173/api/health
```

## 24. Troubleshooting

Hermes service logs:

```bash
journalctl -u hermes-agent-os -f
```

Builder logs:

```bash
journalctl -u hermes-agent-builder -f
```

Nginx logs:

```bash
tail -f /var/log/nginx/error.log
```

Port conflict:

```bash
lsof -ti:4173
```

Ollama not working:

```bash
systemctl status ollama
curl http://127.0.0.1:11434/api/tags
```

Builder not rendering:

- Check Convex.
- Check Clerk.
- Run `npm run builder:install`.
- Start `hermes-agent-builder`.
- Check `/api/builder/status`.

OpenRouter not configured:

- Set `OPENROUTER_API_KEY`.
- Restart Hermes.
- Test provider card.

MiniMax not configured:

- Set `MINIMAX_API_KEY`.
- Restart Hermes.
- Test provider card.

CLI missing:

- Install CLI.
- Or configure CLI path.
- Restart Hermes.

## 25. Production Checklist

Before giving the dashboard to users:

- Zip extracted on VPS.
- `npm install` complete.
- `npm run build` passes.
- `npm test` passes.
- `/api/health` returns ok.
- systemd service enabled.
- Nginx reverse proxy enabled.
- HTTPS certificate installed.
- Firewall allows only SSH, HTTP, HTTPS.
- `4173`, `3100`, `11434` are not public.
- OpenRouter key configured if using hosted router.
- MiniMax key configured if using MiniMax.
- Ollama installed only if needed.
- Builder has Convex and Clerk if using real builder.
- Firecrawl key added if running web/data workflow nodes.
- `HERMES_AGENT_OS_ENABLE_EXEC=0` until trusted.
- `HERMES_AGENT_OS_ENABLE_INSTALL=0` until trusted.
- No `.env` is included in shared packages.
- Clean export audit passes before distributing.

## 26. Security Rules

- Do not commit `.env`.
- Do not share `/etc/hermes-agent-os/hermes.env`.
- Do not share `/var/lib/hermes-agent-os`.
- Do not share `~/.hermes-agent-os`.
- Do not expose Ollama to the internet.
- Do not expose builder port directly.
- Use HTTPS for public dashboards.
- Rotate API keys before sharing screenshots or logs.
- Keep execution disabled unless the machine is trusted.

## 27. Official References

- NodeSource Node.js distributions: `https://github.com/nodesource/distributions`
- Ollama Linux install: `https://docs.ollama.com/linux`
- OpenRouter quickstart: `https://openrouter.ai/docs/quickstart`
- OpenRouter API authentication: `https://openrouter.ai/docs/api/reference/authentication`
- Certbot Nginx instructions: `https://certbot.eff.org/instructions`
