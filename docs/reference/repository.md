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
│   ├── render-certificates
│   └── render
├── systemd/
│   ├── README.md
│   ├── serverfiles-apply@.service
│   └── serverfiles-apply@.timer
└── systems/
    ├── common/
    └── <machine-tree>/
        ├── builds
        ├── certificates/
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

Checks shell scripts, renders each machine tree, and runs isolated certificate lifecycle checks.
The certificate checks require OpenSSL, `bwrap`, and unprivileged user namespaces.
They use a local certificate authority and replace external DNS transport and service-manager calls.
They do not contact Let's Encrypt or Cloudflare.

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

### `certificates/*.certificate`

Each declaration manages one certificate on that machine, independently of its consumers.
This is a serverfiles format with systemd-like syntax, not a native systemd unit type.
The filename stem is the certificate ID. Use lowercase letters, digits, and hyphens.

```ini
[Unit]
Description=Storage HTTPS certificate

[Certificate]
Authority=letsencrypt
ContactEmailFile=/etc/serverfiles/acme-email
AcceptTermsOfService=yes
DNSProvider=cloudflare
DNSCredential=podman-secret:cloudflare-dns-token
Domain=storage.lan.zenobi.us
DNSResolver=1.1.1.1:53
RenewBefore=30d
MinimumValidity=14d

[Install]
Directory=/var/lib/storage/certs
CertificateFile=cert.crt
PrivateKeyFile=priv.key
User=1000
Group=1000
CertificateMode=0644
PrivateKeyMode=0400

[Timer]
OnCalendar=daily
Persistent=yes
RandomizedDelaySec=30min
```

Repeat `Domain=` to request one certificate with multiple DNS names.
Repeat `DNSResolver=` to select multiple public validation resolvers.
Only Let's Encrypt and Cloudflare DNS-01 are supported. Wildcard DNS names are not supported.
Store token values through fnox and provision the named rootful Podman secret on each host.
The contact-email file must also exist on each host before deployment.

`Directory=` holds `releases/` and the atomic `current` symlink.
Applications read `current/cert.crt` and `current/priv.key`, or the configured filenames.
`User=` and `Group=` are numeric IDs for the published files.
The publication and release directories remain root-owned. Consumers cannot replace the managed release paths.
An optional `RestartUnit=example.service` restarts that unit only when it is already active.
Omit it for certificate-only deployment. The certificate service never requires its consumer.

The default ACME state directory is `/var/lib/serverfiles/certificates/<id>/acme/`.
An explicit `StateDirectory=` preserves an existing account and certificate store.
The services-lan declaration keeps `/var/lib/serverfiles/acme/` for this reason.
Staging and production use separate subdirectories.
Publication and state directories must be absolute paths under `/var/lib/`.
Existing parent directories must be root-owned, without group or other write permissions.
The runner rejects symlink components and creates missing parent directories as root.
Declarations cannot use overlapping publication or state directories.

`RenewBefore=` accepts a positive whole number of days, such as `30d`.
`MinimumValidity=` sets the minimum accepted certificate lifetime.
It accepts positive durations in seconds, minutes, hours, days, or weeks, such as `1209600s`, `14d`, or `2w`.
The runner checks the exact DNS-name set, matching key, validity, and production trust before publication.
The unchanged decision includes certificate bytes, key bytes, numeric ownership, and file modes.
Metadata-only declaration changes publish a new release.
With no changes or pending activation, the runner skips publication and consumer restarts.
Failed consumer restarts trigger certificate rollback and a recovery restart attempt.
The recovery restart can fail. Inspect the journal and the application's served certificate after a failure.
Rollback applies to each certificate, not one transaction across the machine.

The parser accepts section headers, literal `Key=Value` entries, blank lines, and full-line comments.
It rejects unknown keys and repeated scalar keys.
It does not evaluate shell expressions or support systemd specifiers, continuations, drop-ins, or arbitrary execution hooks.
The shared runner pins the Lego image. Declarations contain secret references, never credential values.

Defaults apply when these fields are omitted:

| Field | Default |
| --- | --- |
| `RenewBefore` | `30d` |
| `MinimumValidity` | `14d` |
| `CertificateMode` | `0644` |
| `PrivateKeyMode` | `0400` |
| `Persistent` | `true` |
| `RandomizedDelaySec` | `0` |

`PrivateKeyMode` accepts only `0400` or `0600`.
`CertificateMode` accepts `0400`, `0440`, `0444`, `0600`, `0640`, or `0644`.

`bin/render` compiles declarations into ordinary units and tab-separated runtime descriptors:

- `systemd/certificate-<id>.service`
- `systemd/certificate-<id>.timer`
- `config/certificates/<id>.conf`
- `certificate-units`, the deployment issuance manifest

Do not list generated certificate units in the machine's `units` file.
The compiler adds timers automatically.
Reconciliation activates timers first, then publishes all declared certificates before any certificate-driven consumer restart.
It holds a deployment lock during publication and releases it before consumer activation.
Multiple certificates can share a consumer without restarting it before the other certificates exist.
Renewal remains scheduled if issuance or application startup fails.
Each apply checks issuance or renewal, in addition to the declared timer schedule.
If issuance fails, the apply fails before application restarts. Existing installed certificate pairs remain available.
Application startup has no online renewal dependency.

The runner records pending consumer activation in private ACME state before switching the `current` link.
If deployment is interrupted, the next production run finishes pending activation before contacting the issuer.
Deployment uses the runner's `activate` action to complete pending restarts without repeating DNS issuance.
Activation failures appear in the `serverfiles-apply@<machine>.service` journal.

For staging on an installed host:

```bash
sudo /etc/serverfiles/config/certificates/renew \
  /etc/serverfiles/config/certificates/storage.conf staging
```

Staging never publishes files or restarts a consumer.
For production, start `certificate-storage.service`.
Inspect `journalctl -u certificate-storage.service` and `systemctl list-timers certificate-storage.timer`.
Removing a declaration removes its managed units, but retains account state and published certificates.

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