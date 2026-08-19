# AGENTS.md

## Repository rules

- Keep the repository public.
- Do not commit secrets.
- Manage secret values with fnox.
- Store only fnox references or encrypted fnox configuration in Git.
- Keep mutable service data in `/var/lib/` on each machine.
- Run `mise run check` before a commit.
