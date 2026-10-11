import type { Service } from "../server/functions";

type TreeProps = {
  services: Service[];
  activeProject: string | undefined;
  selectedHost: string;
  onSelect: (service: Service, host?: string) => void;
};
type HostProps = { label: string; type: string; selected: boolean; onClick: () => void };

function HostButton(props: HostProps) {
  return (
    <button className={`so-host-row gap-1 py-2 pl-5 pr-1 text-sm ${props.selected ? "selected" : ""}`} onClick={props.onClick}>
      <span>├─</span>
      <span>{props.label}</span>
      <small className="text-xs">{props.type}</small>
    </button>
  );
}

function Branch(props: {
  service: Service;
  active: boolean;
  selectedHost: string;
  onSelect: TreeProps["onSelect"];
}) {
  return (
    <section className="so-service-branch mb-2" key={props.service.project}>
      <button
        className={`so-project-row gap-1 px-1 py-2 ${props.active ? "selected" : ""}`}
        onClick={() => props.onSelect(props.service)}
      >
        <span aria-hidden="true">⌄</span>
        <b className="text-sm">{props.service.project}</b>
        <small className="text-xs">project</small>
      </button>
      <HostButton
        label={`${props.service.project}.dev.lan`}
        type="primary"
        selected={props.selectedHost === props.service.host}
        onClick={() => props.onSelect(props.service, props.service.host)}
      />
      <HostButton
        label={props.service.alias}
        type="alias"
        selected={props.selectedHost === props.service.alias}
        onClick={() => props.onSelect(props.service, props.service.alias)}
      />
      {props.service.versions.map((host) => (
        <HostButton
          key={host}
          label={host}
          type="version"
          selected={props.selectedHost === host}
          onClick={() => props.onSelect(props.service, host)}
        />
      ))}
    </section>
  );
}

export function ServiceTree(props: TreeProps) {
  return (
    <nav className="so-service-tree p-4 max-[600px]:p-2 text-sm" aria-label="Service tree">
      <h3 className="mb-3 pb-2">
        PROJECTS <small className="text-sm">{props.services.length}</small>
      </h3>
      {props.services.map((service) => (
        <Branch
          key={service.project}
          service={service}
          active={props.activeProject === service.project}
          selectedHost={props.selectedHost}
          onSelect={props.onSelect}
        />
      ))}
      {props.services.length === 0 && <p>No services match this filter.</p>}
    </nav>
  );
}
