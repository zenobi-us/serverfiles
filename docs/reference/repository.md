# Repository reference

## Layout

```text
.
├── .mise/
│   ├── config.toml
│   └── tasks/
│       ├── check
│       ├── container/
│       │   └── run
│       └── machine/
│           ├── apply
│           ├── new
│           └── provision
├── bin/
│   ├── reconcile
│   └── render
├── systemd/
│   ├── README.md
│   ├── serverfiles-apply@.service
│   └── serverfiles-apply@.timer
└── systems/
    ├── common/
    └── <machine-tree>/
        ├── builds
        ├── config/
        ├── definitions/
        ├── machine.toml
        ├── quadlets/
        └── units
```

## Mise configuration

`.mise/config.toml` pins these local tools:

- `shellcheck`
- `shfmt`
- `usage`

It also defines the `bootstrap` task.

## Tasks

### `mise run check`

Checks the shell scripts and renders each machine tree.

### `mise run machine:new <host>`

Creates a machine tree from a fully qualified host name.

Example mapping:

```text
valheim.hostname.tld -> systems/valheim-hostname-tld/
```

### `mise run machine:provision <machine-tree>`

Installs pull-based reconciliation for the named machine tree.

### `mise run machine:apply --machine <machine-tree>`

Builds changed local image definitions, then renders and applies the named
machine tree on the current host.

### `mise run container:run --system <machine-tree> --definition <name>`

Builds a definition and runs it as a local rootless Podman container. The task
uses the matching `<name>.container` Quadlet for environment variables, ports,
and volume destinations.

Local volume data is stored under `.local/containers/`. Add `--dry-run` to
print the generated `podman run` command.

## Systemd units

The files in `systemd/` are bootstrap infrastructure. The provision task
installs them directly into `/etc/systemd/system/`. The apply task does not
manage them.

They remain outside `systems/common/` to avoid a bootstrap cycle. Read
[`systemd/README.md`](../../systemd/README.md) for the ownership boundary.

`serverfiles-apply@.timer` runs two minutes after boot and every 15 minutes
after that. The timer uses a random delay of up to 30 seconds.

`serverfiles-apply@.service` fetches `origin/main`, resets the checkout in
`/var/lib/serverfiles/repo`, and runs `machine:apply` for `%i`.

## Machine files

### `machine.toml`

```toml
host = "minecraft.lan"
user = "core"
```

`host` is the SSH destination. `user` is the SSH user.

### `quadlets/`

Files in this directory map to `/etc/containers/systemd/` on the target.

### `config/`

Files in this directory map to `/etc/serverfiles/config/` on the target.

### Future shared systemd state

Ordinary shared systemd services can use a future `systems/common/systemd/`
directory. The `serverfiles-apply@.*` units must remain in the root `systemd/`
directory because they start the apply mechanism.

### `units`

This file contains one generated systemd service name per line. Blank lines
and lines that start with `#` are ignored.

### `builds`

This optional file contains one image definition name per line. For example:

```text
prominence
```

The apply task builds `definitions/prominence/Containerfile` as
`localhost/serverfiles-prominence:latest`.

### `definitions/`

Each child directory is a Podman build context. Definitions are not copied to
the rendered release. They are inputs for local image builds on the target.

## Remote state

The reconcile script stores its state in `/var/lib/serverfiles/`:

- `managed-quadlets` records managed Quadlet file names.
- `managed-units` records managed systemd service names.

Image build hashes are stored in `/var/lib/serverfiles/builds/`.

The remote Git checkout is `/var/lib/serverfiles/repo`.