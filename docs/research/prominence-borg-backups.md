# Borg backup options for Prominence

**Scope:** `systems/minecraft-lan/definitions/prominence` and its Podman Quadlet.

**Repository state:** `origin/main@ad0ccb1`.

## Local findings

The Prominence image uses `itzg/docker-minecraft-server`. The Quadlet binds
`/var/lib/minecraft/prominence/data` to `/data`. The definition README now uses
the same path.

The server is a bind mount, not a Podman named volume. A host backup can read
`/var/lib/minecraft/prominence/data` directly. The service runs under systemd,
so a systemd timer and service fit the repository model.

## Viable approaches

### 1. Host Borgmatic service — recommended

Install Borg and borgmatic on the host. Back up the bind-mounted data path to a
remote Borg repository. Use borgmatic command hooks to stop Prominence before
`create`, then start it after the backup. Borgmatic supports before and after
hooks, including cleanup after errors. [borgmatic hooks](https://torsion.org/borgmatic/how-to/add-preparation-and-cleanup-steps-to-backups/)

Advantages:

- No privileged backup container.
- No Podman socket access.
- Direct access to the bind mount.
- Natural systemd timer integration.
- The same Borg job can back up other host paths and exported volumes.

Use the Minecraft server's RCON save or a clean service stop before copying.
A stopped server gives the safest world snapshot.

### 2. Borgmatic container as a Quadlet

`borgmatic-collective/docker-borgmatic` publishes a Borgmatic image that also
runs with Podman. Mount source data read-only and mount Borg credentials and
configuration separately. The image supports Podman secrets through borgmatic.
[container image](https://github.com/borgmatic-collective/docker-borgmatic/)
[container secrets](https://torsion.org/borgmatic/reference/configuration/credentials/container/)

This works for the Prominence bind mount. Do not give the container the Podman
socket unless container lifecycle control is required. Stopping the Minecraft
service from the host timer is simpler and limits privilege.

### 3. Generic Podman volume export plus Borg

`podman volume export` writes a named volume as a tar stream or file.
`podman volume import` restores a tar archive into an existing volume.
[volume export](https://docs.podman.io/en/stable/markdown/podman-volume-export.1.html)
[volume import](https://docs.podman.io/en/stable/markdown/podman-volume-import.1.html)

A small host script can export each named volume to a temporary file or FIFO,
then run `borg create` on that export. This generalizes beyond Minecraft to OCI
volumes. Prefer a stream or temporary filesystem so the tar file does not become
a second backup dataset.

The export is not a consistency mechanism. Stop the owning container or use an
application-aware freeze before export.

### 4. `chadweimer/podman-volume-backup` plus Borg

This project adds systemd units and labels for recurring Podman volume backups.
It stops labeled containers, runs `podman volume export`, and writes gzip tar
files. It supports Quadlet-managed containers.
[project](https://github.com/chadweimer/podman-volume-backup)

It is useful as a volume-discovery and stop/start reference. It does not use
Borg. Adding Borg after its gzip archive duplicates compression and adds an
extra restore layer. Use it only if tar archives are also required.

### 5. `itzg/docker-mc-backup` plus Borg

This sidecar coordinates Minecraft backups through RCON and a read-only shared
`/data` mount. It writes tar or zip-style backup archives, not Borg archives.
[project](https://github.com/itzg/docker-mc-backup)

It is a good Minecraft consistency reference. It is not the best base for this
repository because Borgmatic hooks or a host service can perform the same
coordination without another backup format.

### 6. `ovski4/docker-borgbackup-cron`

This image periodically backs up mounted folders to a remote Borg repository.
It supports SSH and Docker-style deployment examples.
[project](https://github.com/Ovski4/docker-borgbackup-cron)

It can run under Podman, but the cron-inside-container model is weaker than the
existing systemd model. It also adds image-specific environment and secret
handling. Prefer host borgmatic or a Borgmatic Quadlet.

## Curated list findings

`awesome-selfhosted` points readers to Borgmatic and a dedicated backup list.
[awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)

`awesome-minecraft` lists DriveBackupV2, Advanced Backups, restic, Kopia, and
rclone. These tools do not provide Borg repositories. They are alternatives,
not candidates for a Borg base backup.
[awesome-minecraft](https://github.com/2lstudios-mc/awesome-minecraft)

## Recommendation for CoreOS

Use a dedicated backup container as a Quadlet. Trigger it with a systemd timer.
The image contains Borg and the Podman client. The container reads labels from
the rootful Podman API socket and backs up selected containers.

Mount these paths into the backup container:

- `/run/podman/podman.sock` for label discovery and volume export.
- `/` at `/host` read-only for bind-mounted data paths.
- Borg SSH keys and passphrase through Podman secrets.

The Podman API socket grants full control of Podman. Treat this image as a
trusted host administrator. Do not expose the socket over TCP. Podman documents
this risk and requires `label=disable` when a container accesses the socket.
[Podman service](https://docs.podman.io/en/stable/markdown/podman-system-service.1.html)

Use labels like these on a backup target:

```ini
Label=backup.borg.enabled=true
Label=backup.borg.name=prominence
Label=backup.borg.consistency=minecraft
```

The backup container can inspect all mounts for the labelled container. It can
read bind mounts from `/host` and stream named volumes through `podman volume
export`. Borg supports storing that stream under a stable name with
`--stdin-name`. [Borg stdin](https://borgbackup.readthedocs.io/en/stable/usage/create.html)

For Prominence, the `minecraft` consistency mode should run `rcon-cli save-all
flush`, call `sync`, pause the container, back up the data mount, unpause it,
and then report failure if any step fails. This avoids stopping a Quadlet service
from inside another container.

For other workloads, support a small fixed set of consistency modes:

- `pause`: sync, pause, back up, unpause.
- `stop`: stop and start the target container.
- `command`: run an approved image-specific command before and after backup.

Do not execute arbitrary shell text from labels. Labels select data and a fixed
consistency mode. The backup image owns the commands for each mode.

This gives one CoreOS-native mechanism for bind mounts and named OCI volumes.
It also avoids a second tar backup format. Do not use Git-based Minecraft
backups for world data. Git stores large binary files poorly and does not
provide Borg's chunk deduplication.

## Sources

- [Borg `create` documentation](https://borgbackup.readthedocs.io/en/stable/usage/create.html)
- [Borgmatic command hooks](https://torsion.org/borgmatic/reference/configuration/command-hooks/)
- [Borgmatic container](https://github.com/borgmatic-collective/docker-borgmatic)
- [Borgbase container backup guidance](https://docs.borgbase.com/setup/borg/containers)
- [Podman volume export](https://docs.podman.io/en/stable/markdown/podman-volume-export.1.html)
- [Podman volume import](https://docs.podman.io/en/stable/markdown/podman-volume-import.1.html)
- [Podman volume mount](https://docs.podman.io/en/stable/markdown/podman-volume-mount.1.html)
- [Podman volume backup project](https://github.com/chadweimer/podman-volume-backup)
- [Minecraft backup sidecar](https://github.com/itzg/docker-mc-backup)
- [Borg backup cron image](https://github.com/Ovski4/docker-borgbackup-cron)
- [Awesome Minecraft](https://github.com/2lstudios-mc/awesome-minecraft)
