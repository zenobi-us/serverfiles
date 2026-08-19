# Desired-state model

This repository uses a small desired-state workflow without a controller on
the Fedora CoreOS machine.

```text
systemd timer
    |
    v
git fetch + reset to origin/main
    |
    v
machine:apply
    |
    v
build changed local images
    |
    v
common files + machine files
    |
    v
Podman Quadlet + systemd
```

## Overlays

`systems/common/` contains files for all machines. A machine tree contains
files for one host.

The renderer copies common files first. It then copies machine files over
them. A machine file replaces a common file with the same relative path.

This model keeps shared state visible. It also permits a machine to override
one shared file without a template system.

## Remote reconciliation

The provision task installs the pull mechanism once. It does not send each
rendered release from the local workstation.

The units in `systemd/` are bootstrap infrastructure. They cannot live in
`systems/common/` because `machine:apply` deploys the common tree. The timer
must exist before it can start `machine:apply`.

```text
machine:provision
    |
    v
install reconciliation units
    |
    v
timer can run machine:apply
```

This separation avoids a cycle where apply must install the timer, but the
timer is required to run apply.

The timer runs every 15 minutes. The service fetches `origin/main` and resets
the checkout to that state. It then runs `machine:apply` for the timer instance.

The apply task renders the selected machine tree. The reconcile script records
the Quadlet files and services that it manages. During the next apply, it
removes managed files and services that are no longer required.

Before reconciliation, the apply task builds each image named in the machine's
`builds` file. It hashes the definition directory and skips an unchanged image.
Images remain local to the target. The workflow does not publish them.

The script does not remove unrelated files from `/etc/containers/systemd/`.
This boundary permits other tools to manage their own Quadlets.

Shared application state still belongs in `systems/common/`. The bootstrap
units are the exception because they own the mechanism that applies that state.

## Git as the deployment boundary

The target reads `origin/main`, not a developer's working tree. This rule makes
the remote state reproducible from Git. It also prevents accidental deployment
of uncommitted work.

## Secret boundary

The repository is public. Secret values do not belong in machine trees. Use
fnox to resolve secrets outside Git-managed plain text.