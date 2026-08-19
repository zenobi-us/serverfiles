# Bootstrap systemd units

This directory contains the systemd units that start the reconciliation loop.
They are bootstrap infrastructure, not machine service state.

## Why these units are not in `systems/common/`

`systems/common/` contains desired state that `machine:apply` deploys. The
reconciliation units must exist before `machine:apply` can run on a schedule.
Putting them in `systems/common/` creates this circular dependency:

```text
apply required to install timer
        |
        v
timer required to run apply
```

The `machine:provision` task breaks this cycle. It installs these units once.
The installed timer then pulls and applies Git state.

## Units

`serverfiles-apply@.timer` starts two minutes after boot. It then runs every
15 minutes, with a random delay of up to 30 seconds.

`serverfiles-apply@.service` uses the instance name as the machine tree slug.
For example:

```text
serverfiles-apply@valheim-hostname-tld.timer
```

runs:

```bash
mise run machine:apply --machine valheim-hostname-tld
```

The service resets `/var/lib/serverfiles/repo` to `origin/main` before it
applies the state.

## Ownership boundary

Keep these bootstrap units in `systemd/`.

Put shared Podman Quadlet and configuration state in `systems/common/`.
Machine-specific state belongs in `systems/<machine-tree>/`.

If this repository later manages ordinary shared systemd services, store them
under a separate state directory such as `systems/common/systemd/`. Do not move
the `serverfiles-apply@.*` bootstrap units there.
