# Provision a machine

## Prerequisites

The target machine must provide:

- SSH
- Git
- curl
- Podman
- systemd
- passwordless `sudo` for the configured SSH user

The repository must be public. Your required state must exist on `origin/main`.

## Provision the machine

Commit and push the required state. Then use the machine tree name:

```bash
mise run machine:provision valheim-hostname-tld
```

The task connects to the configured host and performs one bootstrap:

1. Installs mise at `/usr/local/bin/mise` if it is missing.
2. Clones the repository to `/var/lib/serverfiles/repo`.
3. Installs the `serverfiles-apply@.service` and timer units.
4. Enables `serverfiles-apply@valheim-hostname-tld.timer`.
5. Starts an immediate apply.

The source units are in [`systemd/`](../../systemd/README.md). They stay
outside `systems/common/` because the target needs them before scheduled state
application can start.

The timer runs every 15 minutes. Its service resets the checkout to
`origin/main` and runs:

```bash
mise run machine:apply --machine valheim-hostname-tld
```

If the machine tree has a `builds` file, the apply task builds changed image
definitions before it restarts services.

After the bootstrap, push changes to `main`. The target pulls and applies them.

Do not copy the reconciliation units into a machine tree. Run
`machine:provision` again when their definitions change.

## Apply state without the timer

On the target machine, run:

```bash
cd /var/lib/serverfiles/repo
sudo /usr/local/bin/mise run machine:apply --machine valheim-hostname-tld
```