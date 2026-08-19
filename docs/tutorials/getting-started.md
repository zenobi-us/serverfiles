# Get started

This tutorial configures the local tools and creates a machine definition.

## Prerequisites

Install these programs:

- Git
- mise
- SSH
- tar

## 1. Configure the local tools

From the repository root, trust the mise configuration:

```bash
mise trust
```

Then install the tools and run the repository check:

```bash
mise bootstrap
```

Mise reads `.mise/config.toml`. The bootstrap task runs `mise run check`.

## 2. Create a machine tree

Run the task with a fully qualified host name:

```bash
mise run machine:new valheim.hostname.tld
```

The task creates this tree:

```text
systems/valheim-hostname-tld/
├── config/
├── machine.toml
├── quadlets/
└── units
```

The generated `machine.toml` contains:

```toml
host = "valheim.hostname.tld"
user = "core"
```

## 3. Add a Quadlet

Add a Quadlet file to the new `quadlets/` directory. Then add its generated
systemd service name to `units`.

For example:

```text
valheim.service
```

## 4. Check the repository

```bash
mise run check
```

The check validates the shell scripts and renders each machine overlay.

You now have a machine tree. Read
[Provision a machine](../how-to/provision-a-machine.md) to install remote
reconciliation.