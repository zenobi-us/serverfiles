# serverfiles

This repository defines Podman Quadlet services for Fedora CoreOS machines.

The repository combines files from `systems/common/` with files from one
machine tree. Each machine pulls and applies its state on a systemd timer.

## Start here

Follow the [getting-started tutorial](docs/tutorials/getting-started.md) to
configure the local tools and create a machine tree.

## Common commands

```bash
mise bootstrap
mise run check
mise run machine:new valheim.hostname.tld
mise run machine:provision valheim-hostname-tld
mise run machine:apply --machine valheim-hostname-tld
mise run container:run --system minecraft-lan --definition prominence
```

Provisioning installs mise and a systemd timer on the target. Every 15 minutes,
the timer resets its checkout to `origin/main` and applies its machine tree.

## Documentation

The documentation follows the Diátaxis structure.

| Type | Use it when you need to | Documents |
| --- | --- | --- |
| Tutorial | Learn the workflow | [Get started](docs/tutorials/getting-started.md) |
| How-to guide | Complete a specific task | [Add a machine](docs/how-to/add-a-machine.md), [Provision a machine](docs/how-to/provision-a-machine.md), [Manage a local image](docs/how-to/manage-local-images.md) |
| Explanation | Understand the design | [Desired-state model](docs/explanation/desired-state-model.md) |
| Reference | Look up exact details | [Repository reference](docs/reference/repository.md) |

This repository is public. Do not store secrets in it. Manage secret values
with fnox. Keep mutable service data in `/var/lib/` on each machine.

Machine trees can contain local image definitions under `definitions/`. The
target builds changed definitions before it applies Quadlet state.

`container:run` builds a definition and starts it locally with the environment,
ports, and volumes from its matching Quadlet.

## Publishing a project on dev.lan

`systems/dev-lan` runs Caddy Docker Proxy on the `shared` Podman network. Add
each project as a Quadlet in that machine tree and attach it to `shared.network`.
Add labels like these to its `[Container]` section:

```ini
Network=shared.network
Label=caddy=project.dev.lan
Label=caddy.reverse_proxy={{upstreams 8080}}
Label=caddy.tls=internal
```

Point wildcard DNS for `*.dev.lan` at the machine's LAN address. Caddy uses its
internal CA for these routes, so clients must trust that CA. Only deploy trusted
projects on this machine: Caddy can access the rootful Podman API socket.
