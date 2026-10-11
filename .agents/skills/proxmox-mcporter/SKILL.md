---
name: proxmox-mcporter
description: Use when accessing or managing Proxmox through the Proxmox mcporter service.
---

# Proxmox through mcporter

Use the Proxmox mcporter service for Proxmox operations.

## Host selection

Set the target host on every mcporter command with the `PROXMOX_HOST` environment variable. Use `pve3.lan` unless the user specifies another host.

For example, list nodes with:

```sh
PROXMOX_HOST=pve3.lan mcporter call proxmox.list_nodes
```

Keep the environment-variable prefix on every command. Do not run `mcporter` without the host prefix, including for discovery or follow-up calls.

## Discovering operations

When you need to inspect available Proxmox operations, list only the Proxmox service:

```sh
PROXMOX_HOST=pve3.lan mcporter proxmox list
```

Do not list all mcporter services. Use the operation names returned for the Proxmox service and keep the host prefix on each call.

## Related skills

Before using mcporter, follow the repository's mcporter skills for its setup, command syntax, and safe operation. Consult those skills for general mcporter guidance; use this skill for the Proxmox service and host-selection rules.
