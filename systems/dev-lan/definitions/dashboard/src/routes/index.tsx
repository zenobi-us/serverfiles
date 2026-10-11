import { createFileRoute } from "@tanstack/react-router";
import { ServiceOutline } from "../ServiceOutline";
import { getServiceTelemetry, getServices } from "../server/functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    const services = await getServices();
    const telemetry = await getServiceTelemetry({ data: { project: services[0].project } });
    return { services, telemetry };
  },
  component: DashboardRoute,
});

function DashboardRoute() {
  const { services, telemetry } = Route.useLoaderData();
  return <ServiceOutline services={services} initialTelemetry={telemetry} />;
}
