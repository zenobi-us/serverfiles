#!/usr/bin/env bash
set -euo pipefail

fail() {
	printf 'GoDoxy preflight: %s\n' "$1" >&2
	exit 1
}

[[ -f /var/lib/godoxy/firewall-verified ]] || fail 'verify LAN-only firewall rules, then create /var/lib/godoxy/firewall-verified'
[[ $(stat -c '%u:%a' /var/lib/godoxy/firewall-verified) == 0:600 ]] || fail 'firewall verification marker must be root-owned with mode 0600'

for name in godoxy-oidc-client-id godoxy-oidc-client-secret godoxy-api-jwt-secret; do
	podman secret inspect "$name" >/dev/null 2>&1 || fail "missing Podman secret: $name"
done

for dir in /var/lib/godoxy/logs /var/lib/godoxy/data /var/lib/godoxy/config /var/lib/godoxy/error_pages; do
	[[ -d $dir && $(stat -c '%u:%g' "$dir") == 1000:1000 ]] || fail "missing or incorrectly owned state directory: $dir"
done
[[ -d /var/lib/godoxy/certs && $(stat -c '%u:%g:%a' /var/lib/godoxy/certs) == 0:0:755 ]] || fail 'certificate publication directory must be root-owned with mode 0755'

cert=/var/lib/godoxy/certs/current/cert.crt
key=/var/lib/godoxy/certs/current/priv.key
[[ -f $cert && -f $key ]] || fail 'certificate and private key are required'
[[ $(stat -c '%u:%g:%a' "$cert") == 1000:1000:644 ]] || fail 'certificate owner or mode is incorrect'
[[ $(stat -c '%u:%g:%a' "$key") == 1000:1000:400 ]] || fail 'private key owner or mode is incorrect'
openssl x509 -in "$cert" -noout -checkend 604800 >/dev/null || fail 'certificate expires within seven days'
for name in authentik.services.lan.zenobi.us godoxy.services.lan.zenobi.us; do
	openssl x509 -in "$cert" -noout -checkhost "$name" >/dev/null || fail "certificate does not cover $name"
	[[ $(dig +time=2 +tries=1 +short @192.168.86.253 "$name" A) == 192.168.86.253 ]] || fail "private DNS does not resolve $name"
done
cmp -s <(openssl x509 -in "$cert" -pubkey -noout) <(openssl pkey -in "$key" -pubout 2>/dev/null) || fail 'certificate and private key do not match'
[[ $(dig +time=2 +tries=1 +short @192.168.86.253 example.com A) ]] || fail 'external DNS resolution failed'
systemctl is-active --quiet coredns.service || fail 'CoreDNS is not active'
