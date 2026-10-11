import { useState } from "react";
import { getServiceTelemetry, type Service, type ServiceTelemetry } from "./server/functions";
import { ServiceActivity } from "./components/ServiceActivity";
import { ServiceDetails } from "./components/ServiceDetails";
import { ServiceHeader } from "./components/ServiceHeader";
import { ServiceTree } from "./components/ServiceTree";

type Props = { services: Service[]; initialTelemetry: ServiceTelemetry };

export function ServiceOutline(props: Props) {
  const [selectedProject, setSelectedProject] = useState(props.services[0]?.project ?? "");
  const [selectedHost, setSelectedHost] = useState(props.services[0]?.host ?? "");
  const [selectedHour, setSelectedHour] = useState(14);
  const [query, setQuery] = useState("");
  const [telemetry, setTelemetry] = useState(props.initialTelemetry);
  const [copiedHost, setCopiedHost] = useState("");
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  const filteredServices = props.services.filter((service) =>
    `${service.project} ${service.title} ${service.category} ${service.host} ${service.alias} ${service.versions.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const activeService = props.services.find((service) => service.project === selectedProject);
  const chosenHost =
    activeService &&
      [activeService.host, activeService.alias, ...activeService.versions].includes(selectedHost)
      ? selectedHost
      : (activeService?.host ?? "");
  const detailType = activeService
    ? chosenHost === activeService.host
      ? "PRIMARY HOST"
      : chosenHost === activeService.alias
        ? "ALIAS"
        : "VERSION HOST"
    : "";

  async function selectService(service: Service, hostname = service.host) {
    setSelectedProject(service.project);
    setSelectedHost(hostname);
    if (service.project === selectedProject) return;
    setLoadingTelemetry(true);
    try {
      setTelemetry(await getServiceTelemetry({ data: { project: service.project } }));
      setSelectedHour(14);
    } finally {
      setLoadingTelemetry(false);
    }
  }

  function changeQuery(value: string) {
    setQuery(value);
    const matchingService = props.services.find((service) =>
      `${service.project} ${service.title} ${service.category} ${service.host} ${service.alias} ${service.versions.join(" ")}`
        .toLowerCase()
        .includes(value.toLowerCase()),
    );
    if (matchingService && matchingService.project !== selectedProject)
      void selectService(matchingService);
  }

  async function copyHost(host: string) {
    await navigator.clipboard?.writeText(`https://${host}`);
    setCopiedHost(host);
    window.setTimeout(() => setCopiedHost(""), 1300);
  }

  return (
    <main className="dashboard al service-outline">
      <ServiceHeader query={query} onQueryChange={changeQuery} />
      <div className="so-workspace">
        <div className="so-columns">
          <ServiceTree
            services={filteredServices}
            activeProject={activeService?.project}
            selectedHost={chosenHost}
            onSelect={(service, host) => void selectService(service, host)}
          />
          <ServiceDetails
            service={activeService}
            host={chosenHost}
            detailType={detailType}
            copiedHost={copiedHost}
            onCopy={copyHost}
            onSelectHost={(service, host) => void selectService(service, host)}
          />
          <ServiceActivity
            telemetry={telemetry}
            selectedHour={selectedHour}
            loading={loadingTelemetry}
            onSelectHour={setSelectedHour}
          />
        </div>
      </div>
    </main>
  );
}
