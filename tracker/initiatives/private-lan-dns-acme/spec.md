# Private LAN DNS and trusted HTTPS

## Problem Statement

The operator can reach Authentik through an SSH tunnel, but cannot use a trusted HTTPS name on the LAN. The current application names end in `services.lan`. GoDoxy expects a certificate that covers both Authentik and its WebUI, but no certificate or automated renewal exists. The operator wants names under `lan.zenobi.us` to resolve only on the LAN. Public DNS must still prove domain control to Let's Encrypt without making the services available on the Internet.

## Solution

Serve explicit `lan.zenobi.us` records from a Git-managed CoreDNS zone on `services-lan`. Direct LAN clients to that resolver through the existing network DNS mechanism. Keep public `zenobi.us` DNS at Cloudflare for automated Let's Encrypt DNS-01 challenges. Issue and renew a certificate that covers each announced HTTPS host, install it as host state for GoDoxy, and keep the DNS API token and private key out of Git. Change GoDoxy and Authentik's OIDC registration to `authentik.services.lan.zenobi.us` and `godoxy.services.lan.zenobi.us`. Do not enable GoDoxy until certificate, secrets, directories, DNS, and firewall prerequisites pass. Preserve `services.lan` as the SSH bootstrap name during the transition.

## User Stories

1. As an operator, I want the two service names to follow `*.services.lan.zenobi.us`, so that their HTTPS identities match the new naming scheme.
2. As an operator, I want explicit DNS records in Git, so that I can review each name and address before deployment.
3. As an operator, I want one private DNS zone for `lan.zenobi.us`, so that I can add names at different depths without public address records.
4. As a LAN user, I want internal service names to resolve to LAN addresses, so that I can open services without an SSH tunnel.
5. As a LAN user, I want ordinary Internet names to continue to resolve, so that the private DNS rollout does not break browsing.
6. As an operator, I want LAN clients to use the new DNS service through the network's DNS configuration, so that I do not edit every device by hand.
7. As an operator, I want a way to check DNS directly before changing client DNS, so that I can avoid a network-wide outage.
8. As an operator, I want an independent path to SSH and public DNS, so that DNS or proxy failures do not block recovery.
9. As an operator, I want Let's Encrypt to validate ownership through public DNS-01 records, so that no public HTTP endpoint is necessary.
10. As an operator, I want unattended certificate renewal, so that HTTPS does not expire after initial setup.
11. As an operator, I want the DNS API token stored outside Git with limited access, so that a public repository does not expose DNS credentials.
12. As an operator, I want the certificate and key installed in host state with controlled ownership, so that GoDoxy can use them without putting keys in Git.
13. As an operator, I want new HTTPS names to have certificate coverage before DNS or proxy access is enabled, so that no client receives a name mismatch.
14. As an Authentik user, I want the login flow to use the new HTTPS issuer, so that browsers and OIDC clients see one consistent identity.
15. As a GoDoxy user, I want the new WebUI callback registered in Authentik, so that sign-in returns to the correct host.
16. As an operator, I want the current SSH bootstrap address to keep working, so that provisioning remains possible during the change.
17. As an operator, I want a gate before GoDoxy starts, so that missing secrets, certificate, state, or firewall setup cannot expose a partial deployment.
18. As an operator, I want public DNS to contain no service address records, so that public resolvers do not direct clients to internal addresses.
19. As an operator, I want LAN firewall rules for DNS and HTTPS, so that external clients cannot reach private services even if they learn the names.
20. As an operator, I want a documented rollback order, so that I can restore the former client DNS path if the resolver fails.
21. As an operator, I want a renewal failure signal and a certificate-expiry check, so that I can repair an issue before a certificate expires.
22. As an operator, I want an end-to-end check from a LAN client, so that DNS, TLS, proxy routing, and OIDC work together.

## Implementation Decisions

- Use CoreDNS, not Blocky, as the private zone server. Use a versioned Corefile and zone file. Do not introduce an ad-blocking resolver in this change.
- Serve explicit records in the private `lan.zenobi.us` zone. Do not publish its authoritative nameserver on the Internet. Do not add public A or AAAA records for private hosts.
- Put CoreDNS under the existing machine-tree Quadlet and reconciliation model. Listen on the services host's LAN address on both UDP and TCP port 53. Check existing host and Podman DNS listeners before selecting the binding. Do not expose DNS on a WAN interface.
- Provide a nonrecursive answer for private zone names and a deliberate upstream path for other DNS names. Avoid forwarding loops with the host's resolver. The deployment procedure must cover client DNS routing, fallback, and rollback.
- Keep Cloudflare as the public authoritative DNS provider for `zenobi.us`. The public challenge records are for certificate validation only. DNS-01 runs against public DNS independently of CoreDNS.
- Run an ACME client with Cloudflare DNS-01 support through a reproducible host task or service. Use a narrowly scoped DNS token via fnox or an appropriate Podman secret. Never write its plaintext value to Git, logs, or command arguments.
- Start with one renewable certificate whose subject alternative names cover `authentik.services.lan.zenobi.us` and `godoxy.services.lan.zenobi.us`. Additional announced HTTPS hosts must be included in a managed certificate before activation. Do not issue a wildcard until the service count justifies its broader private-key scope.
- Keep certificate and private key as mutable host state under `/var/lib/godoxy/certs`. Install them atomically with the ownership and modes required by GoDoxy. Renew the certificate unattended and reload or restart GoDoxy after a verified replacement. Preserve the last valid pair on failure.
- Update the reverse-proxy route, WebUI alias, OIDC issuer, Authentik redirect URI, verification checks, and deployment instructions as one migration. The issuer remains based on the Authentik application slug.
- Preserve `services.lan` in the machine's SSH bootstrap configuration until the new DNS and TLS paths work. Changing the bootstrap hostname is a separate cutover decision.
- Keep GoDoxy's enable marker as the explicit activation gate. Require its existing three Podman secrets, state directories, certificate, working internal DNS, and LAN firewall restrictions before the marker is created.
- Split DNS is for routing, not access control. Restrict access by firewall or upstream network policy. Public certificate transparency can disclose service names even when no public address records exist.
- Human-only steps include creating a scoped Cloudflare token, changing LAN DHCP or router DNS settings, and approving firewall or upstream network changes. The repository must document exact preflight and rollback checks for these steps.

## Testing Decisions

- Prefer one end-to-end acceptance seam: run queries and HTTPS requests from a LAN client against the deployed resolver and proxy. This tests user-visible DNS, certificate, routing, and OIDC behavior, not file contents.
- Before the client DNS cutover, ask CoreDNS directly for both named services, an unknown private name, and an unrelated Internet name. Confirm that the answers and response status match the configured zone and upstream behavior over UDP and TCP.
- Check that public authoritative DNS answers the active DNS-01 challenge and does not publish public service addresses. Use the public resolvers for challenge propagation checks; the private zone can give a different answer.
- Exercise staging issuance, renewal, and failure handling with the same ACME workflow. Confirm that a failed renewal leaves the last valid certificate and key in place and that the next successful renewal updates the served certificate.
- From a LAN client, check trusted HTTPS for both names and a working Authentik page. Confirm the issuer in the discovery document equals the new HTTPS URL. Confirm an authorized GoDoxy login and rejection of a user outside the allowed group.
- From outside the LAN, confirm that DNS knowledge alone does not provide access to GoDoxy or Authentik. Verify that Authentik still binds only to loopback port 9000.
- Use the existing machine render and reconcile path as the setup seam. Rendered-configuration checks are useful before deployment, but they do not replace DNS and HTTPS acceptance checks.
- Keep tests deterministic and free of secret values. Do not add tests that only check that a string appears in a copied file.

## Out of Scope

- Moving all machines away from `.lan` names or changing the `services.lan` SSH bootstrap address now.
- Publishing any service on the Internet or adding a public inbound port-forward for certificate validation.
- Adding Blocky, network-wide ad blocking, dynamic DNS updates, or a public DNS delegation for `lan.zenobi.us`.
- Replacing GoDoxy, Authentik, or their existing Podman data volumes.
- Changing other service providers or moving application data between hosts.

## Further Notes

- Public DNS for `zenobi.us` currently uses Cloudflare nameservers. Confirm the zone and token permissions at implementation time.
- The last observed host state had Authentik running, GoDoxy inactive, and no GoDoxy certificate, state directories, enable marker, or three GoDoxy secrets. Check the current host again before deployment.
- Let's Encrypt DNS-01 permits private web endpoints and requires a new public TXT value for each validation and renewal: https://letsencrypt.org/docs/challenge-types/.
- CoreDNS serves a standard zone file through its `file` plugin: https://coredns.io/plugins/file/.
- DNS-01 validation must not depend on a public NS delegation to a private LAN-only nameserver.
- The test seam is the LAN client's DNS and HTTPS behavior. Change it only if another seam gives stronger proof of the same user-visible contract.
