# Add a machine

Run `machine:new` with the machine's fully qualified host name:

```bash
mise run machine:new valheim.hostname.tld
```

The task replaces each dot with a hyphen. This command creates
`systems/valheim-hostname-tld/`.

## Configure the machine

Edit `machine.toml` if the SSH user is not `core`:

```toml
host = "valheim.hostname.tld"
user = "core"
```

Put machine-specific Quadlet files in `quadlets/`. Put service configuration
files in `config/`.

List each generated systemd service in `units`:

```text
valheim.service
```

For the Authentik deployment on `services-lan`, see [Deploy Authentik](deploy-authentik.md).

For host-managed HTTPS certificates, add `certificates/<id>.certificate`.
See the [certificate declaration reference](../reference/repository.md#certificatescertificate).
Provision the contact-email file and DNS credential secret before deployment.
The deployment creates and starts each certificate service without requiring GoDoxy or another consumer.
Generated certificate timers do not need entries in `units`.

Run the repository check:

```bash
mise run check
```

The task stops if the machine tree exists or the host name is not valid.