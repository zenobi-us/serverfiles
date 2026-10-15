# Deploy Authentik on services-lan

`systems/services-lan/` runs Authentik, PostgreSQL, and GoDoxy as rootful Podman Quadlets on the `services.lan` Fedora CoreOS host. Authentik publishes HTTP on loopback port 9000 for GoDoxy; PostgreSQL has no published port. Database and Authentik data persist in rootful Podman named volumes.

The Authentik and PostgreSQL image references are pinned by version and registry digest. Update both deliberately. Back up the `authentik-db` and `authentik-data` Podman volumes before an Authentik upgrade. Do not rely on rolling back only the image after a database migration.

## Before applying

1. Create or confirm the `services.lan` DNS/SSH entry and host. The machine tree uses `core@services.lan`.
2. Before the first reconciliation, install the two Authentik rootful Podman secrets described below. GoDoxy's three secrets are created after its Authentik provider exists.
3. The Authentik Quadlet binds port 9000 to loopback only. GoDoxy reaches it locally; do not add a public port-forward for 9000.
4. The GoDoxy unit stays gated by `/var/lib/godoxy/enabled`. Follow [Private LAN DNS and HTTPS deployment](deploy-private-lan-dns-acme.md) before creating this marker. Keep Authentik on loopback port 9000.
5. Restrict inbound DNS and HTTPS to intended LAN networks. Do not add an Internet port-forward.


Apply the machine after its required state is on the repository's `main` branch:

```bash
mise run machine:provision services-lan
```

The Quadlets create a private `authentik` network, PostgreSQL database, Authentik server, worker, and GoDoxy. PostgreSQL has no published port. Authentik listens on `127.0.0.1:9000`; GoDoxy publishes the application routes on host ports 80 and 443. Authentik's trusted proxy CIDR is loopback because GoDoxy uses host networking. No Podman socket is mounted into any container; application routes are declared in Git-managed YAML files.

## Create two age recipients

Use the current software age identity as the recovery recipient. Store that identity in gopass. Add a separate age-plugin-yubikey recipient for normal use. Both recipients must be in `fnox.toml` so future encrypted values can be opened by either identity.

The YubiKey holds its PIV private key. Its age identity file contains the plugin's key reference, not an exportable copy of the private key. The recovery age identity is a separate software key; it does not recreate a lost YubiKey key.

### Back up the recovery identity in gopass

The repository's current age identity is `~/.config/fnox/age.txt`. Confirm that file exists and that its public recipient matches the current entry in `fnox.toml` before you change providers.

1. Confirm gopass can encrypt and decrypt entries with your own GPG private key and the configured recipient set.
2. Run `gopass insert --multiline fnox/age-recovery` and copy the full contents of `~/.config/fnox/age.txt` into the editor. Save and close the editor. Protect editor swap and backup files while you do this.
3. Verify the stored value without printing it:

   ```bash
   gopass show --noparsing fnox/age-recovery | cmp - ~/.config/fnox/age.txt
   ```

4. Keep the working file at `~/.config/fnox/age.txt`. The gopass entry is its encrypted recovery copy. Do not commit either plaintext identity.

If gopass has no usable local GPG secret key, stop here. Do not store the age identity in an unencrypted file or repository as a workaround.

### Add a YubiKey-backed recipient

Install `age-plugin-yubikey` and ensure the PC/SC service can access the YubiKey. Use a YubiKey model that supports PIV. Check its PIV state before you create an identity. Do not reset PIV or overwrite an existing PIV key to make room.

After you confirm that a retired PIV slot is unused, generate the identity. Replace `82` with the free slot you confirmed; do not reset PIV or overwrite an existing key:

```bash
mkdir -p ~/.config/fnox
test ! -e ~/.config/fnox/yubikey-identity.txt
YUBIKEY_SLOT=82 # Replace with the free slot you confirmed.
age-plugin-yubikey --generate --slot "$YUBIKEY_SLOT" --name fnox-main \
  > ~/.config/fnox/yubikey-identity.txt
chmod 600 ~/.config/fnox/yubikey-identity.txt
age-plugin-yubikey --list
```

The identity file is needed for age to locate the YubiKey. Protect it from edits, but it is not a substitute for the hardware key. Record the recipient printed by the plugin.

Add that YubiKey recipient to the existing `[providers.age].recipients` list in `fnox.toml`. Keep the current software-key recipient in the list as the recovery recipient. Do not replace it.

Keep both recipients in the existing provider table:

```toml
[providers.age]
type = "age"
recipients = [
  "<existing software-key recipient>",
  "<YubiKey recipient>",
]
```

Replace the example values with the exact recipients already in `fnox.toml` and printed by `age-plugin-yubikey --list`. Leave `key_file` unset. fnox gives a configured `key_file` priority over `FNOX_AGE_KEY_FILE`, which would prevent switching to the recovery identity with an environment override.

Before changing normal workstation use, test both identities with a temporary secret. The YubiKey identity must work with the installed fnox and plugin versions. A reported fnox issue describes a failure with an `age1tag` recipient for a different age plugin; validate the exact YubiKey recipient format before re-encrypting important values: [fnox discussion #596](https://github.com/jdx/fnox/discussions/596).

```bash
printf '%s' 'temporary-test-value' |
  FNOX_AGE_KEY_FILE="$HOME/.config/fnox/age.txt" \
    mise exec fnox@1.39.0 -- fnox set FNOX_YUBIKEY_SMOKE

FNOX_AGE_KEY_FILE="$HOME/.config/fnox/yubikey-identity.txt" \
  mise exec fnox@1.39.0 -- fnox exec -- sh -c \
  'test "$FNOX_YUBIKEY_SMOKE" = "temporary-test-value"'

FNOX_AGE_KEY_FILE="$HOME/.config/fnox/age.txt" \
  mise exec fnox@1.39.0 -- fnox exec -- sh -c \
  'test "$FNOX_YUBIKEY_SMOKE" = "temporary-test-value"'

mise exec fnox@1.39.0 -- fnox remove FNOX_YUBIKEY_SMOKE
```

After the test passes, re-encrypt existing fnox values while the current software identity is still the active identity:

```bash
FNOX_AGE_KEY_FILE="$HOME/.config/fnox/age.txt" \
  mise exec fnox@1.39.0 -- fnox reencrypt
```

Set `FNOX_AGE_KEY_FILE="$HOME/.config/fnox/yubikey-identity.txt"` in the workstation shell for normal YubiKey use. Keep the software recipient in `recipients` as the recovery path. If the YubiKey is unavailable, restore the software identity from gopass to a mode-600 file and set `FNOX_AGE_KEY_FILE` to that file for recovery commands.


A second YubiKey can add device-loss recovery without relying on the software identity. Add its recipient and re-encrypt again. The password-manager recovery key remains independent of both hardware keys.

## Create Authentik secrets

This procedure generates each value once, stores it in gopass, then encrypts the same value with fnox. It overwrites any existing gopass and fnox entries with these names.

```bash
set -o pipefail

openssl rand -hex 32 |
  gopass insert --force services-lan/authentik/AUTHENTIK_PG_PASSWORD
gopass show --noparsing services-lan/authentik/AUTHENTIK_PG_PASSWORD |
  tr -d '\n' |
  mise exec fnox@1.39.0 -- fnox set AUTHENTIK_PG_PASSWORD

openssl rand -hex 48 |
  gopass insert --force services-lan/authentik/AUTHENTIK_SECRET_KEY
gopass show --noparsing services-lan/authentik/AUTHENTIK_SECRET_KEY |
  tr -d '\n' |
  mise exec fnox@1.39.0 -- fnox set AUTHENTIK_SECRET_KEY
```

This keeps the values out of command arguments and temporary files. Confirm the gopass entries can decrypt before you provision Podman secrets.

`AUTHENTIK_SECRET_KEY` is recovery-critical. Keep it stable and include it in fnox backups. The PostgreSQL password is also required by both the database and Authentik. Do not rotate it by only replacing the Podman secret; coordinate the PostgreSQL role password change.

Before the first apply, create each rootful Podman secret on the target over SSH. Use the workstation's configured host alias:

```bash
mise exec fnox@1.39.0 -- fnox exec -- sh -c 'printf %s "$AUTHENTIK_PG_PASSWORD"' |
  ssh core@services.lan \
    'sudo podman secret create --replace authentik-pg-password -'

mise exec fnox@1.39.0 -- fnox exec -- sh -c 'printf %s "$AUTHENTIK_SECRET_KEY"' |
  ssh core@services.lan \
    'sudo podman secret create --replace authentik-secret-key -'
```

The secret values travel over SSH stdin. They do not appear in command arguments or temporary files. The target does not need fnox or age. Recreate containers after replacing Podman secrets; running containers do not receive updates to a replaced secret.

## Back up and restore

Back up PostgreSQL with a database-aware backup method. Include the `authentik-data` Podman volume if it contains uploaded files. Store backups off the `services.lan` host. Test a restore before relying on it. Keep the `AUTHENTIK_SECRET_KEY` and both age recovery materials separate from the database backup.

To restore the software age identity after loss of the workstation key file, first unlock gopass with a configured recovery-capable GPG key. Write the result to a protected file, then verify its recipient before using it:

```bash
umask 077
mkdir -p ~/.config/fnox
gopass show --noparsing fnox/age-recovery > ~/.config/fnox/age-recovery.txt
chmod 600 ~/.config/fnox/age-recovery.txt
age-keygen -y ~/.config/fnox/age-recovery.txt
```

Use that file for recovery commands with `FNOX_AGE_KEY_FILE=~/.config/fnox/age-recovery.txt`. Do not remove the YubiKey recipient from `fnox.toml` unless you intend to make the hardware key unable to decrypt those values.

## Initial Authentik setup

Before GoDoxy's OIDC provider exists, reach Authentik through an SSH tunnel:

```bash
ssh -L 9000:127.0.0.1:9000 core@services.lan
```

Open `http://127.0.0.1:9000/if/flow/initial-setup/` on the workstation to create the initial administrator. Keep this tunnel restricted to administration; do not publish port 9000. The GoDoxy Quadlet is skipped until `/var/lib/godoxy/enabled` exists, so the first reconciliation can install and start Authentik without exposing an unauthenticated dashboard. Create the provider through the SSH tunnel before enabling GoDoxy. After GoDoxy is running, use the public HTTPS URLs for routine administration.

Configure Discord and other required identity sources, then create Authentik application bindings or policies that limit access by user or group. Each local service must use an Authentik provider or outpost for those access rules to apply.

See [Authentik's deployment documentation](https://docs.goauthentik.io/install-config/install/container/) and [age-plugin-yubikey](https://github.com/str4d/age-plugin-yubikey) for current setup details.

## Connect GoDoxy to Authentik

GoDoxy uses Authentik for WebUI sign-in. Authentik remains on loopback port 9000. GoDoxy proxies `authentik.services.lan.zenobi.us` to that port.

Both `authentik.services.lan.zenobi.us` and `godoxy.services.lan.zenobi.us` must resolve to the services host. Follow [Private LAN DNS and HTTPS deployment](deploy-private-lan-dns-acme.md) before enabling GoDoxy.

### 1. Prepare Authentik

1. Start an SSH tunnel to the Authentik loopback port:

   ```bash
   ssh -L 9000:127.0.0.1:9000 core@services.lan
   ```

2. Open `http://127.0.0.1:9000/if/flow/initial-setup/` on the workstation. Create the initial administrator.
3. Keep port 9000 private. Do not publish it on the LAN or Internet.

### 2. Create the Authentik application and provider

GoDoxy uses the OAuth2 authorization-code flow. Authentik's `Authorization Flow` field selects the user authorization flow, not the OAuth2 grant type.

1. In Authentik, create an application with the slug `godoxy`.
2. Create an OAuth2/OpenID provider for that application.
3. In `Authorization Flow`, select `default-provider-authorization-explicit-consent (Authorize Application)`.
4. In `Client Type`, select `Confidential`. GoDoxy uses a client ID and client secret.
5. Use `authentik Self-signed Certificate` as the signing key. Do not set an encryption key.
6. Set issuer mode to based on the application slug.
7. Add this exact redirect URI:

   ```text
   https://godoxy.services.lan.zenobi.us/auth/callback
   ```

8. Enable the `openid`, `profile`, `email`, and `groups` scopes. Do not enable `offline_access`.
9. Create the `godoxy-admins` group. Add only users who can access the GoDoxy WebUI.
10. Configure the `groups` claim to include the `godoxy-admins` group.

Authentik 2026.8 accepts forwarded headers only from trusted proxy addresses. This host trusts loopback and the Authentik Podman gateway, `10.89.0.1`.

Because the SSH tunnel uses `127.0.0.1`, send the external host and HTTPS scheme in the forwarded headers:

```bash
curl -fsS \
  -H 'Host: authentik.services.lan.zenobi.us' \
  -H 'X-Forwarded-Host: authentik.services.lan.zenobi.us' \
  -H 'X-Forwarded-Proto: https' \
  http://127.0.0.1:9000/application/o/godoxy/.well-known/openid-configuration |
  jq -e '.issuer == "https://authentik.services.lan.zenobi.us/application/o/godoxy/"'
```

Stop if this command fails. Correct Authentik's external host or issuer before you continue.

### 3. Store the GoDoxy credentials

Store the provider's client ID and client secret in gopass. Then add them to fnox:

```bash
gopass insert --multiline services-lan/godoxy/OIDC_CLIENT_ID
gopass insert --multiline services-lan/godoxy/OIDC_CLIENT_SECRET
gopass show --noparsing services-lan/godoxy/OIDC_CLIENT_ID |
  tr -d '\n' | mise exec fnox@1.39.0 -- fnox set GODOXY_OIDC_CLIENT_ID
gopass show --noparsing services-lan/godoxy/OIDC_CLIENT_SECRET |
  tr -d '\n' | mise exec fnox@1.39.0 -- fnox set GODOXY_OIDC_CLIENT_SECRET
```

Keep the client secret encrypted. Do not put it in a Quadlet, an environment file, or Git.

GoDoxy also needs a separate API JWT secret. This secret protects GoDoxy's own API. It is not the Authentik client secret:

```bash
openssl rand -base64 32 |
  gopass insert --multiline services-lan/godoxy/API_JWT_SECRET
gopass show --noparsing services-lan/godoxy/API_JWT_SECRET |
  tr -d '\n' | mise exec fnox@1.39.0 -- fnox set GODOXY_API_JWT_SECRET
```

### 4. Prepare DNS, certificate, firewall, and state

Follow [Private LAN DNS and HTTPS deployment](deploy-private-lan-dns-acme.md). That procedure checks CoreDNS, the public DNS-01 challenge, certificate renewal, GoDoxy secrets, state ownership, and LAN firewall rules. Do not create `/var/lib/godoxy/enabled` until those checks pass.

### 5. Enable GoDoxy

After the preflight in the private LAN deployment guide passes, create the enable marker and reconcile from `main`:

```bash
ssh core@services.lan 'sudo touch /var/lib/godoxy/enabled'
mise run machine:provision services-lan
```

The host pulls the current revision from `origin/main`. Push all required changes before this step. The GoDoxy unit runs the preflight again before it starts.

### 6. Confirm sign-in

1. Open `https://authentik.services.lan.zenobi.us` from a LAN client. Check the trusted certificate and Authentik page.
2. Open `https://godoxy.services.lan.zenobi.us`. Sign in with a member of `godoxy-admins`.
3. Sign in with a user outside `godoxy-admins`. GoDoxy must deny access.
4. Confirm the callback is `https://godoxy.services.lan.zenobi.us/auth/callback` and the issuer is `https://authentik.services.lan.zenobi.us/application/o/godoxy/`.
5. Confirm port 9000 listens on loopback only and DNS and HTTPS ports are restricted to the LAN.

To disable GoDoxy, stop `godoxy.service` before removing `/var/lib/godoxy/enabled`. Removing the marker alone does not stop a running container.
