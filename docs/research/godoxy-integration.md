# GoDoxy integration research

**Date:** 2026-08-27  
**Repository:** `yusing/godoxy`  
**Compared with:** `serverfiles` at `origin/main` (`885667b`)

## Decision

GoDoxy fits this repository as an optional reverse-proxy service. It does not fit as a replacement for the `serverfiles` reconciliation loop.

Use a small Quadlet adaptation after a local Podman proof. Do not copy the GoDoxy Compose file into this repository.

## GoDoxy facts

GoDoxy is a reverse proxy with a WebUI. It discovers Docker or Podman containers, reads labels and port data, and reloads routes after container or configuration changes. It supports HTTP, TCP, and UDP routes. It also supports DNS-01 certificates, OpenID Connect, ForwardAuth, access rules, metrics, and idle sleep. [GoDoxy README](https://raw.githubusercontent.com/yusing/godoxy/main/README.md)

The latest release inspected was `v0.31.0`, published on 2026-08-21. This release requires Go 1.27 for source builds and changes the JSON implementation. These facts do not affect use of the published container image. [v0.31.0 release](https://github.com/yusing/godoxy/releases/tag/v0.31.0)

GoDoxy expects host network mode for its main container. The example publishes a socket-proxy on `127.0.0.1:2375`, then sets `DOCKER_HOST` in GoDoxy to that address. The example grants only `NET_BIND_SERVICE` and drops all other capabilities. [Compose example](https://raw.githubusercontent.com/yusing/godoxy/main/compose.example.yml)

The example socket proxy enables container listing, events, information, and selected lifecycle operations. It mounts the container runtime socket. The default example enables start, stop, and restart operations. [Compose example](https://raw.githubusercontent.com/yusing/godoxy/main/compose.example.yml)

GoDoxy can use Podman when `DOCKER_SOCKET` points to the Podman socket. Its agent template also selects Podman with `RUNTIME=podman` and `/var/run/podman/podman.sock`. [Environment example](https://raw.githubusercontent.com/yusing/godoxy/main/.env.example) [Agent Compose template](https://raw.githubusercontent.com/yusing/godoxy/main/agent/pkg/agent/templates/agent.compose.yml.tmpl)

GoDoxy creates routes from labels such as `proxy.aliases` and `proxy.<alias>.*`. It can also load routes from YAML files. An explicit-only Docker provider uses a provider name ending in `!`. [Provider README](https://raw.githubusercontent.com/yusing/godoxy/main/internal/route/provider/README.md) [Docker label source](https://raw.githubusercontent.com/yusing/godoxy/main/internal/docker/label.go)

For a local Docker or Podman provider, GoDoxy uses a container network IP when a route selects a network. For a host-network container, it inspects exposed ports and uses the host address. A route with no usable network can fail with `no network found`. [Container source](https://raw.githubusercontent.com/yusing/godoxy/main/internal/docker/container.go)

GoDoxy stores configuration, logs, error pages, metrics data, and certificates in mounted directories. Its example configuration includes ACME credentials, API credentials, OIDC credentials, and certificate material. These values need the repository's `fnox` secret boundary. [Compose example](https://raw.githubusercontent.com/yusing/godoxy/main/compose.example.yml) [Configuration example](https://raw.githubusercontent.com/yusing/godoxy/main/config.example.yml) [Environment example](https://raw.githubusercontent.com/yusing/godoxy/main/.env.example)

## Serverfiles facts

`serverfiles` renders common and machine-specific files, then applies Podman Quadlets and systemd units. A systemd timer pulls `origin/main` every 15 minutes and runs `machine:apply`. [Desired-state model](../explanation/desired-state-model.md) [Systemd README](../../systemd/README.md)

The repository keeps shared application state in `systems/common/`. Machine-specific Quadlets live in `systems/<machine-tree>/quadlets/`. The reconcile script does not remove unrelated files from `/etc/containers/systemd/`. [Repository reference](../reference/repository.md) [Reconcile script](../../bin/reconcile)

The inspected machine has one application container. `prominence.container` uses the `shared.network` Quadlet network and publishes Minecraft port `25565`. Its image is built locally as `localhost/serverfiles-prominence:latest`. [Prominence Quadlet](../../systems/minecraft-lan/quadlets/prominence.container) [Shared network](../../systems/common/quadlets/shared.network)

## Fit

- GoDoxy can run as an additional Quadlet. The reconcile script can manage its files without owning unrelated Quadlets.
- GoDoxy can discover the existing `prominence` container through the Podman socket.
- GoDoxy can route to the `prominence` container through its `shared` network IP, if the GoDoxy process can reach that network.
- GoDoxy's file provider can keep route declarations in a machine `config/` directory. This is closer to the current Git-managed model than WebUI-only edits.
- GoDoxy can provide HTTP and HTTPS for future services. It cannot provide an HTTP route for the current Minecraft service unless that service exposes an HTTP endpoint.

## Conflicts and risks

### Network model

The required GoDoxy host network mode differs from the `shared` network used by `prominence`. GoDoxy can inspect the `shared` network and obtain its container IP, but this must be tested on the target. A route that targets a container name or Podman DNS name is not a safe assumption from host network mode.

A safer first route uses an explicit network and a fixed service port. Keep GoDoxy and `prominence` on separate ownership boundaries. Do not add GoDoxy to `shared` only to make name resolution appear to work.

### Socket privilege

The socket proxy is a control boundary. The official example enables lifecycle operations that this repository does not need for basic routing. Start with read-only discovery and events. Add lifecycle permissions only after a separate decision.

The socket path and socket ownership differ between rootful and rootless Podman. The Quadlet must use the socket that owns the managed containers. A wrong socket produces an empty or incomplete route list.

### Port ownership

GoDoxy uses host ports `80` and `443` by default. No current Quadlet uses these ports, but future services can claim them. GoDoxy must become the single owner of public HTTP and HTTPS ports on a machine.

### Mutable WebUI state

GoDoxy's WebUI can write route and configuration files. That conflicts with the repository rule that Git is the deployment boundary. Treat the WebUI as an inspection tool during the first rollout. Keep route files in Git and use the file provider. If WebUI writes become required, define an export and reconciliation policy first.

### Secrets and certificates

GoDoxy requires credentials for login unless OIDC is configured. ACME DNS providers also require credentials. Do not put these values in `systems/` as plain text. Use fnox references and machine-local storage. Certificate and metrics directories are mutable state and belong under `/var/lib/` on the machine.

### Update control

The official examples use `latest`. That is not reproducible with the `serverfiles` Git deployment model. Pin a GoDoxy image digest or a reviewed version tag. Review releases before changing the pin.

### Failure behavior

GoDoxy route discovery can mark a route as failed when a network or port is missing. The serverfiles apply process does not test application-level proxy health. Add a smoke test for the GoDoxy listener and one known route before production use.

## Minimal incorporation plan

1. Create a ticket for the integration. Keep this research report as the decision record.
2. Add two Quadlets under the selected machine tree: one GoDoxy container and one socket-proxy container.
3. Use the Podman socket for the same Podman service that owns the target containers.
4. Set the socket proxy to discovery and event access only. Do not enable start, stop, or restart.
5. Set GoDoxy to host network mode and bind its public listeners to the intended machine addresses.
6. Store GoDoxy configuration under the machine `config/` directory, with route YAML files in Git.
7. Store logs, metrics, certificates, and GoDoxy data under `/var/lib/godoxy/` with restricted ownership.
8. Add `proxy.aliases` and route labels only to services that need proxying. Use `proxy.exclude: true` for containers that GoDoxy must not expose.
9. Pin the image version or digest. Do not use `latest`.
10. Run `mise run check`, apply to a test machine, and verify container discovery, one route, certificate behavior, restart behavior, and the 15-minute reconciliation cycle.

## Recommendation

Proceed only if this machine needs HTTP or HTTPS ingress. For the current Minecraft-only machine, GoDoxy adds a public listener, socket access, certificate state, and another upgrade stream without a current HTTP route.

The minimum useful first change is a separate integration on a machine with an HTTP service. Keep `serverfiles` as the owner of Quadlets and Git state. Let GoDoxy own proxy runtime behavior and route observation.

## Sources

All GoDoxy sources in this report are official repository files or official GitHub release data:

- [GoDoxy repository](https://github.com/yusing/godoxy)
- [README](https://raw.githubusercontent.com/yusing/godoxy/main/README.md)
- [Compose example](https://raw.githubusercontent.com/yusing/godoxy/main/compose.example.yml)
- [Configuration example](https://raw.githubusercontent.com/yusing/godoxy/main/config.example.yml)
- [Environment example](https://raw.githubusercontent.com/yusing/godoxy/main/.env.example)
- [Docker label source](https://raw.githubusercontent.com/yusing/godoxy/main/internal/docker/label.go)
- [Container source](https://raw.githubusercontent.com/yusing/godoxy/main/internal/docker/container.go)
- [Route provider README](https://raw.githubusercontent.com/yusing/godoxy/main/internal/route/provider/README.md)
- [v0.31.0 release](https://github.com/yusing/godoxy/releases/tag/v0.31.0)
