# AGENTS.md

## Repository rules

- Keep the repository public.
- Do not commit secrets.
- Manage secret values with fnox.
- Store only fnox references or encrypted fnox configuration in Git.
- Keep mutable service data in `/var/lib/` on each machine.
- Run `mise run check` before a commit.

## Tools

Use mise when running mcporter.

when connecting to coreos servers, use ssh.

- Prefer the Proxmox mcporter for Proxmox operations. If it does not expose a required operation, use the Proxmox API or host CLI (`qm`, `pvesh`) as needed.

## Agent skills

### Issue tracker

Tickets and initiatives use the local Markdown stores. See `docs/agents/issue-tracker.md` relative to the active Matt Pocock alignment root.

### Triage labels

Use the default triage label strings. See `docs/agents/triage-labels.md` relative to the active Matt Pocock alignment root.

### Domain docs

Single-context project. See `docs/agents/domain.md` relative to the active Matt Pocock alignment root.
