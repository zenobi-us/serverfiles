import type { Service } from "../server/functions";

type Props = {
  service: Service | undefined;
  host: string;
  detailType: string;
  copiedHost: string;
  onCopy: (host: string) => void;
  onSelectHost: (service: Service, host: string) => void;
};

export function ServiceDetails(props: Props) {
  return (
    <section className="so-service-detail p-4 max-[600px]:p-2 text-sm" aria-label="Selected service details">
      <h3 className="mb-3 pb-2">
        SELECTED SERVICE <small className="text-sm">{props.service ? "01" : "00"}</small>
      </h3>
      {props.service ? (
        <>
          <div className="so-detail-kicker mt-4 mb-2 text-sm">
            <span>{props.service.category.toUpperCase()}</span>
            <span>EXAMPLE RECORD</span>
          </div>
          <h2 className="mb-2 text-xl">{props.service.title}</h2>
          <p className="text-base leading-relaxed">{props.service.description}</p>
          <div className="so-selected-host mt-4 mb-2 gap-1 p-3">
            <small className="text-xs">{props.detailType}</small>
            <code className="text-sm">{props.host}</code>
          </div>
          <button className="so-copy px-2 py-1.5 text-sm" onClick={() => void props.onCopy(props.host)}>
            {props.copiedHost === props.host ? "COPIED" : "COPY ADDRESS"}
          </button>
          <dl className="my-4 grid gap-1">
            <dt className="mt-2 text-xs">PROJECT KEY</dt>
            <dd className="text-sm">{props.service.project}</dd>
            <dt className="mt-2 text-xs">PRIMARY HOST</dt>
            <dd className="text-sm">{props.service.host}</dd>
            <dt className="mt-2 text-xs">ALIAS</dt>
            <dd className="text-sm">{props.service.alias}</dd>
            <dt className="mt-2 text-xs">VERSION HOSTS</dt>
            {props.service.versions.map((host) => (
              <dd className="so-version text-sm" key={host}>
                <button onClick={() => props.onSelectHost(props.service!, host)}>{host}</button>
              </dd>
            ))}
          </dl>
        </>
      ) : (
        <p>No service matches this filter.</p>
      )}
    </section>
  );
}
