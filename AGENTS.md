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
