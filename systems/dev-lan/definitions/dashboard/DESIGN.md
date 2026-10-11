# LAN Service Directory

## Summary

The dashboard presents sample LAN services in a searchable tree. It shows each selected service, its hostnames, sample request activity, and sample resource use. All service and telemetry data comes from TanStack Start server functions and remains illustrative.

## Interface behavior

- Search matches project keys, titles, categories, primary hosts, aliases, and version hosts.
- Select a project or hostname to inspect that service and hostname.
- Select an hour to view that hour's sample request logs and counts.
- Copy the selected address as an HTTPS URL.
- Keep simulated-data labels visible until a real data source replaces the samples.

At narrow widths, the service tree, details, and telemetry remain readable and can scroll horizontally. Controls use native buttons and inputs with visible keyboard focus states.

## Data boundary

`src/server/functions.ts` provides `getServices` and `getServiceTelemetry`. These server functions return deterministic fake data. They do not discover running services, verify DNS or health, or read live logs and metrics.

Keep the server functions as the boundary for a future read-only host-side collector. Do not give the dashboard container access to the rootful Podman socket. Keep example rows and measurements labeled as simulated until a defined live source replaces them.

## Implementation map

| Concern | Source |
| --- | --- |
| Start document and global styles | `src/routes/__root.tsx`, `src/styles.css` |
| Dashboard route and initial server data | `src/routes/index.tsx` |
| Service selection, search, and display | `src/ServiceOutline.tsx` |
| Fake inventory and telemetry | `src/server/functions.ts` |
| Local commands and scope | `README.md` |
