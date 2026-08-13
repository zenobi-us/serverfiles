# serverfiles

This repository stores Podman Quadlet services for Fedora CoreOS hosts.

## Local setup

```bash
mise trust
mise bootstrap
```

## Repository layout

- `systems/common/` contains files for all machines.
- `systems/<machine>/` contains files for one machine.
- Machine files replace common files with the same relative path.
- `quadlets/` maps to `/etc/containers/systemd/`.
- `config/` maps to `/etc/serverfiles/config/`.
- `units` lists the generated systemd services that must run.

Keep mutable service data in `/var/lib/`. Do not store secrets in this repository.

## Add a machine

```bash
mise run machine:new valheim
```

The default host name is `valheim.lan`. Edit `systems/valheim/machine.toml` if necessary.

## Provision a machine

Commit and push the required state. Then run:

```bash
mise run machine:provision minecraft
```

Provisioning uses `origin/main`. It does not deploy the local working tree.

The remote user needs passwordless `sudo`. The target needs SSH, tar, Podman, and systemd.
