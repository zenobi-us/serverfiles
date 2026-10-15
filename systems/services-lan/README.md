# services-lan deployment checklist

Use this checklist to deploy Authentik and GoDoxy on `services.lan` and enable OpenID Connect (OIDC) sign-in for GoDoxy. It is for the operator who manages this host and its identity provider.

**Version:** 1.0

## 1. Publish and prepare

- [ ] Commit and push these changes to `main`. `services.lan` reconciles from `origin/main`.
- [x] The Authentik rootful Podman secrets `authentik-pg-password` and `authentik-secret-key` are installed. To create or replace them from fnox, run these commands from the repository root; they send each value to the host over SSH stdin without printing it:

  ```bash
  set -o pipefail

  mise exec fnox@1.39.0 -- fnox exec -- sh -c 'printf %s "$AUTHENTIK_PG_PASSWORD"' |
    ssh core@services.lan 'sudo podman secret create --replace authentik-pg-password -'

  mise exec fnox@1.39.0 -- fnox exec -- sh -c 'printf %s "$AUTHENTIK_SECRET_KEY"' |
    ssh core@services.lan 'sudo podman secret create --replace authentik-secret-key -'
  ```

  `--replace` overwrites an existing secret. Recreate Authentik containers after replacing secrets; running containers keep their current values. Keep the values in gopass and fnox, not in command arguments or Git.

- [x] Confirmed Podman is rootful and its socket is enabled with Secure Shell (SSH):

  ```bash
  ssh core@services.lan 'sudo systemctl enable --now podman.socket'
  ```

- [x] Verified the Authentik Quadlet binds port 9000 only to loopback with `PublishPort=127.0.0.1:9000:9000`. No host listener is expected before Authentik is deployed.

- [ ] Reserve `192.168.86.253` for `services.lan` in DHCP. Check that port 53 is free on the LAN address.
- [ ] Restrict inbound UDP and TCP port 53, and TCP ports 80 and 443, to intended LAN networks. The host has no managed firewall policy. Follow [Private LAN DNS and HTTPS deployment](../../docs/how-to/deploy-private-lan-dns-acme.md) for checks and rollback.
- [ ] Confirm `authentik.services.lan.zenobi.us` and `godoxy.services.lan.zenobi.us` resolve through CoreDNS before you change router or DHCP DNS.

## 2. Deploy Authentik and create its administrator

- [ ] Apply the revision now available on `main`:

  ```bash
  mise run machine:provision services-lan
  ```

- [ ] After Authentik starts, confirm the host listener is `127.0.0.1:9000`:

  ```bash
  ssh core@services.lan "sudo ss -ltnp 'sport = :9000'"
  ```

  A wildcard address such as `0.0.0.0:9000` or `*:9000` is not acceptable.

- [ ] Open an SSH tunnel for initial administration:

  ```bash
  ssh -L 9000:127.0.0.1:9000 core@services.lan
  ```

- [ ] In a browser on the workstation, open `http://127.0.0.1:9000/if/flow/initial-setup/` and create the initial Authentik administrator.
- [ ] Keep the tunnel private. Do not expose port 9000 to the LAN or Internet.
- [ ] Configure Discord and any other required identity sources in Authentik.

GoDoxy remains stopped until `/var/lib/godoxy/enabled` exists. This allows Authentik to start before its OIDC provider and client credentials are configured.

## 3. Create the GoDoxy OIDC provider

Keep the SSH tunnel open while configuring the provider in Authentik.

For exact provider values, secret handling, host requirements, and verification steps, follow [the detailed GoDoxy setup](../../docs/how-to/deploy-authentik.md#connect-godoxy-to-authentik).
`Authorization Flow` controls Authentik's user-consent step. It is not the OAuth2 grant type.

- [ ] Create an application with slug `godoxy` and an OAuth2/OpenID provider.
- [ ] Set `Authorization Flow` to `default-provider-authorization-explicit-consent (Authorize Application)`.
- [ ] Set `Client Type` to `Confidential`. GoDoxy uses a client ID and client secret.
- [ ] Use Authentik's self-signed signing certificate, no encryption key, and issuer mode based on the application slug.
- [ ] Register this exact redirect URI: `https://godoxy.services.lan.zenobi.us/auth/callback`.
- [ ] Enable the `openid`, `profile`, `email`, and `groups` scopes. Do not request `offline_access` for this setup.
- [ ] Create the `godoxy-admins` group. Add only users who may access the GoDoxy WebUI and configure the `groups` claim to include that group.
- [ ] Check the provider discovery document through the SSH tunnel. Send the external host and HTTPS scheme:

  ```bash
  curl -fsS \
    -H 'Host: authentik.services.lan.zenobi.us' \
    -H 'X-Forwarded-Host: authentik.services.lan.zenobi.us' \
    -H 'X-Forwarded-Proto: https' \
    http://127.0.0.1:9000/application/o/godoxy/.well-known/openid-configuration |
    jq -e '.issuer == "https://authentik.services.lan.zenobi.us/application/o/godoxy/"'
  ```

  If this check fails, correct the trusted proxy CIDR or forwarded headers before you enable GoDoxy.

- [ ] Store the generated client ID and client secret in gopass, then add them to fnox without displaying their values:

  ```bash
  set -o pipefail

  gopass insert --multiline services-lan/godoxy/OIDC_CLIENT_ID
  gopass insert --multiline services-lan/godoxy/OIDC_CLIENT_SECRET

  gopass show --noparsing services-lan/godoxy/OIDC_CLIENT_ID |
    tr -d '\n' | mise exec fnox@1.39.0 -- fnox set GODOXY_OIDC_CLIENT_ID
  gopass show --noparsing services-lan/godoxy/OIDC_CLIENT_SECRET |
    tr -d '\n' | mise exec fnox@1.39.0 -- fnox set GODOXY_OIDC_CLIENT_SECRET
  ```

- [ ] Generate a stable GoDoxy application programming interface (API) JSON Web Token (JWT) secret, store it in gopass, and add it to fnox:

  ```bash
  set -o pipefail

  openssl rand -base64 32 |
    gopass insert --multiline services-lan/godoxy/API_JWT_SECRET
  gopass show --noparsing services-lan/godoxy/API_JWT_SECRET |
    tr -d '\n' | mise exec fnox@1.39.0 -- fnox set GODOXY_API_JWT_SECRET
  ```

## 4. Install GoDoxy secrets, certificate, and state

- [ ] Transfer each fnox value over SSH stdin into its rootful Podman secret on `services.lan`:

  ```bash
  set -o pipefail

  mise exec fnox@1.39.0 -- fnox exec -- sh -c 'printf %s "$GODOXY_OIDC_CLIENT_ID"' |
    ssh core@services.lan 'sudo podman secret create --replace godoxy-oidc-client-id -'

  mise exec fnox@1.39.0 -- fnox exec -- sh -c 'printf %s "$GODOXY_OIDC_CLIENT_SECRET"' |
    ssh core@services.lan 'sudo podman secret create --replace godoxy-oidc-client-secret -'

  mise exec fnox@1.39.0 -- fnox exec -- sh -c 'printf %s "$GODOXY_API_JWT_SECRET"' |
    ssh core@services.lan 'sudo podman secret create --replace godoxy-api-jwt-secret -'
  ```

- [ ] Create GoDoxy's persistent state directories with user ID (UID) and group ID (GID) 1000 ownership:

  ```bash
  ssh core@services.lan \
    'sudo install -d -o 1000 -g 1000 /var/lib/godoxy/logs /var/lib/godoxy/data /var/lib/godoxy/certs'
  ```

- [ ] Issue the certificate with the DNS-01 workflow in [Private LAN DNS and HTTPS deployment](../../docs/how-to/deploy-private-lan-dns-acme.md). Check both Subject Alternative Names and the renewal timer. Keep the private key outside Git.
- [ ] Confirm the firewall restricts DNS and HTTPS to the LAN. After checking the active rules, create `/var/lib/godoxy/firewall-verified` as root with mode `0600`. Use the command in [Private LAN DNS and HTTPS deployment](../../docs/how-to/deploy-private-lan-dns-acme.md#enable-lan-https-after-preflight).

## 5. Enable GoDoxy and verify access

- [ ] Run `/etc/serverfiles/config/godoxy/preflight.sh` as root on `services.lan`. Create the enable marker only if it passes:

  ```bash
  ssh core@services.lan 'sudo /etc/serverfiles/config/godoxy/preflight.sh && sudo touch /var/lib/godoxy/enabled'
  mise run machine:provision services-lan
  ```

- [ ] Confirm `https://authentik.services.lan.zenobi.us` loads with a certificate trusted by LAN clients.
- [ ] Open `https://godoxy.services.lan.zenobi.us` and confirm it redirects to Authentik for sign-in.
- [ ] Confirm a member of `godoxy-admins` can sign in and a user outside that group is denied.
- [ ] Confirm the issuer and callback match the registered new names.
- [ ] Confirm port 9000 is reachable only on loopback and ports 80/443 are limited by the firewall.
- [ ] Confirm no Podman socket is mounted into the GoDoxy or Authentik containers. GoDoxy routes are static YAML files managed in this repository.

For the full Authentik, fnox, backup, and recovery procedure, see [the Authentik deployment guide](../../docs/how-to/deploy-authentik.md).
