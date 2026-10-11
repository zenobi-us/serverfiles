# LAN service directory

A TanStack Start app for the LAN service outline. It shows a searchable service tree, selected-service details, sample request activity, and sample resource use.

The server functions return fake service and telemetry data. The dashboard does not discover services, verify DNS or health, or read live request logs. Keep all sample data marked as simulated until a host-side collector provides real data.

## Run locally

From this directory, install dependencies and start the app:

```sh
bun install
bun run dev
```

From the repository root, use the mise tasks:

```sh
mise run //systems/dev-lan/definitions/dashboard:bootstrap
mise run //systems/dev-lan/definitions/dashboard:dev
```

Build and preview the production bundle with `bun run build` and `bun run preview`.

## Server functions

- `getServices` returns the sample service inventory.
- `getServiceTelemetry` returns sample hourly activity, request logs, and resource use for one project.

Keep these functions as the data boundary when replacing fake data with a read-only host-side collector. Do not give the dashboard container access to the rootful Podman socket.
