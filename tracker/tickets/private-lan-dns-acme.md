---
id: private-lan-dns-acme
title: Provide private LAN DNS and trusted HTTPS for services-lan
type: task
triage: ready-for-agent
work_status: claimed
blocked_by: []
parent: private-lan-dns-acme
---

## What to build

Implement the [private LAN DNS and trusted HTTPS specification](../initiatives/private-lan-dns-acme/spec.md). Serve explicit `lan.zenobi.us` records through CoreDNS on the LAN. Automate Let's Encrypt DNS-01 validation through public Cloudflare DNS. Migrate Authentik and GoDoxy to `authentik.services.lan.zenobi.us` and `godoxy.services.lan.zenobi.us`. Keep the current SSH bootstrap address until after verification.

## Acceptance criteria

- A LAN client resolves the two new service names to the services host through CoreDNS. It still resolves unrelated Internet names. An unknown private name does not return a service address.
- Public DNS provides the active DNS-01 TXT proof. It does not publish public service address records. Private DNS does not need to answer public validation requests.
- The ACME workflow issues and renews a certificate covering both service names. Failed renewal preserves the last valid certificate. The API token and private key remain outside Git and command output.
- GoDoxy serves trusted HTTPS for both names. Authentik remains bound to loopback port 9000. The OIDC discovery issuer and registered callback use the new names. Authorized GoDoxy login works, and users outside the allowed group are denied.
- DNS, certificate, secrets, state directories, and firewall prerequisites are documented and checked before GoDoxy activation. The deployment procedure includes router or DHCP DNS setup and rollback.
- Tests exercise the rendered machine release and real LAN DNS, TLS, and OIDC behavior. They do not rely only on file-content assertions. Existing repository checks run before a commit.
- Human-only steps are explicit. Do not simulate Cloudflare credentials, firewall changes, or client DNS changes when access is unavailable.

## Comments

- Use the LAN client as the primary acceptance seam. The spec records supporting checks for public DNS and certificate renewal.
