# Deploy private LAN DNS and HTTPS

Use this guide to deploy private service names and trusted HTTPS on `services.lan`.

**Reader:** The operator of the services host and LAN router.  
**Date:** 2026-10-17.

## Overview

CoreDNS answers explicit names in `lan.zenobi.us` at `192.168.86.253` and keeps the `services.lan` SSH bootstrap name available. It forwards other names to public resolvers. Cloudflare remains authoritative for public `zenobi.us`. Let's Encrypt checks public DNS-01 TXT records; it never needs to contact the private resolver or services host. GoDoxy uses one certificate for `authentik.services.lan.zenobi.us` and `godoxy.services.lan.zenobi.us`. Keep `core@services.lan` as the SSH recovery path. Certificate transparency can disclose service names even without public address records. DNS does not provide access control.

Follow these sections in order:

- [Check the host and reserve its address](#check-the-host-and-reserve-its-address)
- [Install the DNS token and release](#install-the-dns-token-and-release)
- [Check private and public DNS](#check-private-and-public-dns)
- [Issue and renew the certificate](#issue-and-renew-the-certificate)
- [Enable LAN HTTPS after preflight](#enable-lan-https-after-preflight)
- [Test from a LAN client](#test-from-a-lan-client)
- [Roll back client DNS and GoDoxy](#roll-back-client-dns-and-godoxy)

## Check the host and reserve its address

1. Reserve `192.168.86.253` for `services.lan` in the router or DHCP server. The observed address was DHCP-assigned, not static. Confirm it still belongs to the host:

   ```bash
   ssh core@services.lan 'ip -4 -brief address show ens18; sudo ss -lntup'
   ```

2. Check that no listener binds port 53 on `192.168.86.253`. The observed listeners on `127.0.0.53`, `127.0.0.54`, and `10.89.0.1` serve other interfaces. Do not disable systemd-resolved or Podman DNS to make room.
3. Set a host or upstream network policy that permits UDP and TCP port 53, and TCP ports 80 and 443, only from intended LAN clients. Deny access from other networks. Do not create a public port-forward. Verify the active rules from an allowed LAN client and a blocked network. The repository does not manage firewall rules; the operator must approve and apply them.
4. Keep the router's current DNS settings until direct resolver checks pass. If the host loses its reserved address, correct DHCP and the CoreDNS zone and listener before changing clients.

## Install the DNS token and release

1. Open [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens/). Select **Create Token**. Use the **Edit zone DNS** template or a custom user token. Name it `services-lan-acme`.
2. Set **Zone / Zone / Read** and **Zone / DNS / Edit** permissions. Under zone resources, include only `zenobi.us`. Lego reads the zone ID and edits DNS-01 TXT records. Do not use a Global API Key. Do not grant access to all zones. If the token has an expiry, plan its replacement before that date.
3. Select **Continue to summary**. Make sure that the summary shows `zenobi.us` and the two permissions. Select **Create Token**. Cloudflare shows the token value once. Do not paste it into a command, chat, or repository file. See the [Cloudflare token procedure](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) and [lego Cloudflare permissions](https://go-acme.github.io/lego/dns/cloudflare/) if the dashboard labels change.
4. Store the token in gopass and fnox on the workstation. Paste it into the secure editor that `gopass insert` opens. These commands do not display the token:

   ```bash
   set -o pipefail
   gopass insert --multiline services-lan/acme/CLOUDFLARE_DNS_TOKEN
   gopass show --noparsing services-lan/acme/CLOUDFLARE_DNS_TOKEN |
     tr -d '\n' | mise exec fnox@1.39.0 -- fnox set CLOUDFLARE_DNS_TOKEN
   mise exec fnox@1.39.0 -- fnox exec -- sh -c 'test -n "$CLOUDFLARE_DNS_TOKEN"'
   ```

   `fnox set` stores encrypted data in `fnox.toml`. Check the Git diff before you commit it. Do not commit a plaintext token or a temporary token file.
5. Transfer the fnox value over Secure Shell (SSH) standard input. Rootful Podman stores it as `cloudflare-dns-token` on `services.lan`. Do not put the value in a command argument or log:

   ```bash
   set -o pipefail
   mise exec fnox@1.39.0 -- fnox exec -- sh -c 'printf %s "$CLOUDFLARE_DNS_TOKEN"' |
     ssh core@services.lan 'sudo podman secret create --replace cloudflare-dns-token -'
   ssh core@services.lan \
     'sudo podman secret inspect --format "{{.Spec.Name}}" cloudflare-dns-token'
   ```

   The last command must show only `cloudflare-dns-token`. The ACME client reads the token from `/run/secrets/cf-token` inside its container.
6. Set the Let's Encrypt account contact email on the host. Use an address that you monitor. The commands work in Bash and Zsh. They replace an empty email file from a failed input attempt:

   ```bash
   set -o pipefail
   ssh core@services.lan 'sudo install -d -m 0755 /etc/serverfiles'
   printf "Let's Encrypt contact email: " >&2
   if IFS= read -r acme_email && [[ $acme_email == *@*.* ]]; then
     printf '%s\n' "$acme_email" |
       ssh core@services.lan 'sudo install -m 0644 /dev/stdin /etc/serverfiles/acme-email'
   else
     printf 'No valid email entered; host file unchanged.\n' >&2
   fi
   unset acme_email
   ssh core@services.lan 'sudo bash -c '\''IFS= read -r email </etc/serverfiles/acme-email; test -n "$email"'\'''
   ```

   The last command returns a failure if the email is empty. It does not display the email. The ACME script also checks the email format.
7. Before the first production deployment, render the declaration and run staging on the host. This uses isolated staging state and does not change GoDoxy:

   ```bash
   bin/render services-lan
   staging_dir=$(ssh core@services.lan 'mktemp -d /tmp/serverfiles-certificate.XXXXXXXX')
   scp .rendered/services-lan/config/certificates/{renew,services-lan.conf} "core@services.lan:$staging_dir/"
   ssh core@services.lan "sudo bash '$staging_dir/renew' '$staging_dir/services-lan.conf' staging"
   ssh core@services.lan "rm -rf '$staging_dir'"
   unset staging_dir
   ```

8. Commit and push the release to `main`, then run `mise run machine:provision services-lan`. Deployment activates the certificate timer, then starts `certificate-services-lan.service` before application restarts. Install the email and token first. GoDoxy stays stopped until `/var/lib/godoxy/enabled` exists. Check the timer and CoreDNS through SSH:

   ```bash
   ssh core@services.lan 'systemctl status coredns.service certificate-services-lan.timer'
   ```

   If renewal fails, inspect `journalctl -u certificate-services-lan.service`. Provider output is suppressed to protect credentials. Do not send secret values in support output.

## Check private and public DNS

Run the following commands from a LAN client before changing router or DHCP DNS. Confirm both transport paths return `192.168.86.253`, unknown private names return `NXDOMAIN` without an address, and unrelated Internet names resolve:

```bash
for name in authentik.services.lan.zenobi.us godoxy.services.lan.zenobi.us; do
  dig @192.168.86.253 "$name" A
  dig +tcp @192.168.86.253 "$name" A
done
dig @192.168.86.253 missing.services.lan.zenobi.us A
dig +tcp @192.168.86.253 missing.services.lan.zenobi.us A
dig @192.168.86.253 services.lan A
dig +tcp @192.168.86.253 services.lan A
dig @192.168.86.253 example.com A
dig +tcp @192.168.86.253 example.com A
```

The same private zone maps `pve3.lan.zenobi.us`, `pve4.lan.zenobi.us`, and `pve5.lan.zenobi.us` to `192.168.86.60`, `192.168.86.70`, and `192.168.86.80`. Check each name over UDP and TCP against `192.168.86.253`. If a LAN client's router still returns `NXDOMAIN` after the zone update, wait for its cached negative answer to expire (up to 300 seconds) and check again.

Check public DNS from outside the private resolver. Neither service name must have a public A or AAAA record:

```bash
dig @1.1.1.1 authentik.services.lan.zenobi.us A
dig @1.1.1.1 authentik.services.lan.zenobi.us AAAA
dig @1.1.1.1 godoxy.services.lan.zenobi.us A
dig @1.1.1.1 godoxy.services.lan.zenobi.us AAAA
```

During an active ACME order, inspect the `_acme-challenge` TXT records through the public Cloudflare nameservers or `@1.1.1.1`. The proof value changes for each order. The private zone does not need to answer the public validation query. After validation, the TXT record can disappear.

## Issue and renew the certificate

The [machine declaration](../../systems/services-lan/certificates/services-lan.certificate) owns certificate names, permissions, destination, and schedule. The shared runner does not require GoDoxy. See the [format reference](../reference/repository.md#certificatescertificate).

1. For a staging recheck after deployment, run the shared runner. Staging certificates are not browser-trusted and never replace production files:

   ```bash
   ssh core@services.lan 'sudo /etc/serverfiles/config/certificates/renew /etc/serverfiles/config/certificates/services-lan.conf staging'
   ```

2. Deployment already starts the production service. To run it manually, use the following command. It publishes a verified pair under `/var/lib/godoxy/certs/current/`. Existing ACME accounts and certificates remain under `/var/lib/serverfiles/acme/{production,staging}/`:

   ```bash
   ssh core@services.lan 'sudo systemctl start certificate-services-lan.service'
   ```

3. Check the certificate names, expiry, and timer without displaying the key:

   ```bash
   ssh core@services.lan 'sudo openssl x509 -in /var/lib/godoxy/certs/current/cert.crt -noout -dates -ext subjectAltName; systemctl list-timers certificate-services-lan.timer'
   ```

4. Inspect the public TXT proof while the order is active. Run the same service again before its renewal window to confirm that it keeps the existing valid pair. If an issuance fails, confirm that the `current` link and served certificate remain unchanged. Check the service failure in `systemctl status` and `journalctl`. Repair the token, public DNS, or network path before the certificate expires. Check expiry periodically with `openssl x509 -checkend 2592000 -noout -in /var/lib/godoxy/certs/current/cert.crt` on the host.

The daily timer remains active between deployments. Each apply publishes all certificates before consumer activation and application restarts. Unchanged pairs with matching metadata and no pending activation do not trigger a certificate-driven restart. Removing the declaration removes managed certificate units, but retains ACME state and published certificates.

## Enable LAN HTTPS after preflight

1. In Authentik, set issuer mode to the application slug, register `https://godoxy.services.lan.zenobi.us/auth/callback`, and grant `godoxy-admins` access to the GoDoxy application. Follow [Deploy Authentik on services-lan](deploy-authentik.md#connect-godoxy-to-authentik).
2. Install the three GoDoxy Podman secrets and create its writable state directories with ownership `1000:1000`. Keep `/var/lib/godoxy/certs` root-owned with mode `0755`. Published certificate files retain owner `1000:1000`. Follow the [services-lan deployment checklist](../../systems/services-lan/README.md#4-install-godoxy-secrets-certificate-and-state).
3. After the firewall policy is applied and checked from allowed and blocked networks, record the human approval. Then run the preflight and create the enable marker:

   ```bash
   ssh core@services.lan 'sudo install -d -m 0755 /var/lib/godoxy; sudo install -m 0600 -o root -g root /dev/null /var/lib/godoxy/firewall-verified; sudo bash /etc/serverfiles/config/godoxy/preflight.sh && sudo touch /var/lib/godoxy/enabled'
   mise run machine:provision services-lan
   ```

   The preflight checks secrets, directories, certificate owner, modes, names, validity, matching key, CoreDNS, and Internet DNS. It cannot inspect the router's policy. The root-owned marker records the operator's firewall check. GoDoxy runs this preflight again before every start.

## Test from a LAN client

If the router supports conditional forwarding, send only `lan.zenobi.us` to `192.168.86.253`. Keep the existing public DNS path for other names. Otherwise, advertise `192.168.86.253` as the client DNS server through DHCP after the direct checks pass. Do not advertise an unrelated secondary resolver: clients may send private names to it and receive inconsistent answers. Record the old DNS settings before changing them. Renew a test client's DHCP lease and confirm it uses the intended resolver.

Run `bin/check-services-lan` on that LAN client from a repository checkout. The script renders the machine release and exercises UDP and TCP DNS, public address absence, trusted HTTPS, and OpenID Connect (OIDC) discovery. In a browser, open both HTTPS names. Confirm the Authentik page loads. Sign in to GoDoxy with a member of `godoxy-admins`, then with a user outside that group. The second login must be denied. Check the callback matches the registered URL. From outside the LAN, confirm that access to ports 53, 80, and 443 is blocked even if the service names are known. On the host, confirm `sudo ss -ltnp 'sport = :9000'` shows loopback only.

## Roll back client DNS and GoDoxy

1. Restore the recorded router or DHCP DNS settings first. Renew a test client's lease and check Internet DNS before rolling back other clients. If conditional forwarding was used, remove only the `lan.zenobi.us` rule.
2. If HTTPS or sign-in fails, stop GoDoxy and remove its activation marker. Keep Authentik on loopback for SSH-tunnel access:

   ```bash
   ssh core@services.lan 'sudo systemctl stop godoxy.service; sudo rm -f /var/lib/godoxy/enabled'
   ```

3. Keep `core@services.lan` unchanged for recovery. Do not delete the last valid certificate, token, or Authentik data. Correct DNS, certificate, or OIDC settings; repeat preflight and LAN acceptance before enabling GoDoxy again.
