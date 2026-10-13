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

## Prepare secrets before applying a machine

The committed [`fnox.toml`](../../fnox.toml) configures age encryption and public recipients. Secret values added with fnox are encrypted before they are written to this file. fnox and age are workstation-only tools: do not add them to the project-wide tool list because machine apply also runs mise on the target.

Install the pinned tools and create a private age identity on your workstation:

```bash
mise install fnox@1.39.0 age@1.3.2
mkdir -p ~/.config/fnox
if [ ! -f ~/.config/fnox/age.txt ]; then
  mise exec age@1.3.2 -- age-keygen -o ~/.config/fnox/age.txt
fi
mise exec age@1.3.2 -- age-keygen -y ~/.config/fnox/age.txt
```

The current public recipient is already listed in `fnox.toml`; verify that it matches the output. Keep `~/.config/fnox/age.txt` private and back it up outside the repository. Never commit the private identity. Each authorized operator needs an age identity; add their public recipient and run `mise exec fnox@1.39.0 -- fnox reencrypt` after changing recipients so they can decrypt existing secrets.

Store a secret with a hidden prompt:

```bash
mise exec fnox@1.39.0 -- fnox set AUTHENTIK_PG_PASSWORD
```

This writes encrypted ciphertext to `fnox.toml`. Do not use `fnox export` to create a committed environment file; exported values are plaintext.

The target does not need fnox. Before `machine:provision` or any apply that starts a secret-consuming unit, provision each rootful Podman secret over SSH from your workstation:

```bash
mise exec fnox@1.39.0 -- fnox exec -- sh -c 'printf %s "$AUTHENTIK_PG_PASSWORD"' |
  ssh core@<configured-host> \
    'sudo podman secret create --replace authentik-pg-password -'
```

Repeat for each secret, using the corresponding fnox name and Podman secret name. The secret value travels over SSH stdin, not as a command-line argument or temporary file. The target requires passwordless `sudo`, as listed above. Add each Podman secret name to only the Quadlets that need it. Recreate those containers after replacing a Podman secret; existing containers do not receive the replacement automatically.

For fnox provider setup and security behavior, see the [fnox age guide](https://fnox.jdx.dev/providers/age) and [Podman secret documentation](https://docs.podman.io/en/v5.8.0/markdown/podman-secret-create.1.html).

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