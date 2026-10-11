import type { ServiceTelemetry } from "../server/functions";

type Props = {
  telemetry: ServiceTelemetry;
  selectedHour: number;
  loading: boolean;
  onSelectHour: (hour: number) => void;
};
const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

function ResourceMeter(props: { label: string; value: number; display: string; detail: string }) {
  return (
    <div className="so-resource my-2">
      <div className="text-sm">
        <b>{props.label}</b>
        <span>{props.display}</span>
      </div>
      <div
        className="so-resource-track my-1"
        role="meter"
        aria-label={`${props.label} sample utilization`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(props.value)}
      >
        <i style={{ width: `${Math.min(100, Math.max(0, props.value))}%` }} />
      </div>
      <small className="text-xs">{props.detail}</small>
    </div>
  );
}

export function ServiceActivity(props: Props) {
  const activity = props.telemetry.activity;
  const profile = props.telemetry.resources;
  const maxRequests = Math.max(1, ...activity.map((slot) => slot.requests));
  const currentActivity = activity[props.selectedHour] ?? { requests: 0, errors: 0, logs: [] };

  return (
    <section className="so-stats p-4 max-[600px]:p-2 text-sm" aria-label="Service activity and resource statistics">
      <div className="so-stats-heading">
        <div>
          <h3 className="mb-1 text-sm">ACTIVITY / 24 HOURS</h3>
          <small className="text-xs">LOCAL TIME · ILLUSTRATIVE SAMPLE</small>
        </div>
        <span className="so-demo-badge px-1.5 py-1 text-xs">SIMULATED</span>
      </div>
      <div className="so-legend mt-3 mb-2 gap-3 text-xs">
        <span className="gap-1">
          <i className="so-ok" />
          REQUESTS
        </span>
        <span className="gap-1">
          <i className="so-error" />
          ERRORS
        </span>
        <span className="gap-1">
          <i className="so-idle" />
          NO ACTIVITY
        </span>
      </div>
      <div
        className="so-chart gap-0.5"
        role="group"
        aria-label="Illustrative requests and errors by hour. Select a bar to view sample logs."
      >
        {activity.map((slot, hour) => (
          <button
            key={hour}
            className={`so-hour gap-1 py-0.5 ${hour === props.selectedHour ? "selected" : ""} ${slot.requests === 0 ? "inactive" : ""}`}
            aria-label={`${formatHour(hour)}: ${slot.requests} requests, ${slot.errors} errors`}
            aria-pressed={hour === props.selectedHour}
            onClick={() => props.onSelectHour(hour)}
          >
            <span className="so-bar">
              <i
                style={{
                  height: `${slot.requests ? Math.max(5, (slot.requests / maxRequests) * 100) : 0}%`,
                }}
              />
              <i
                style={{
                  height: `${slot.errors ? Math.max(5, (slot.errors / maxRequests) * 100) : 0}%`,
                }}
              />
            </span>
            <small className="text-xs">{String(hour).padStart(2, "0")}</small>
          </button>
        ))}
      </div>
      <div className="so-activity-summary gap-3 py-2 text-sm">
        <b>{formatHour(props.selectedHour)}</b>
        <span>{currentActivity.requests} requests</span>
        <span>{currentActivity.errors} errors</span>
      </div>
      <div className="so-logs mt-3" aria-live="polite">
        <h4 className="mb-2 pb-1.5 text-sm">REQUEST LOG / SAMPLE</h4>
        {props.loading ? (
          <p className="text-sm">Loading sample telemetry…</p>
        ) : currentActivity.logs.length ? (
          currentActivity.logs.map((log) => (
            <div className={`so-log gap-2 px-0.5 py-1 text-sm ${log.kind}`} key={`${log.time}-${log.path}`}>
              <time>{log.time}</time>
              <b>{log.method}</b>
              <code>{log.path}</code>
              <span>{log.status}</span>
            </div>
          ))
        ) : (
          <p className="text-sm">No sample requests for this hour.</p>
        )}
      </div>
      <div className="so-resource-list mt-3">
        <h4 className="mb-2 pb-1.5 text-sm">RESOURCE USE / SIMULATED</h4>
        <ResourceMeter
          label="CPU"
          value={profile.cpu}
          display={`${profile.cpu}%`}
          detail="Illustrative host allocation"
        />
        <ResourceMeter
          label="MEMORY"
          value={(profile.memory / profile.memoryLimit) * 100}
          display={`${profile.memory} / ${profile.memoryLimit} GB`}
          detail="Sample container usage"
        />
        <ResourceMeter
          label="STORAGE"
          value={(profile.storage / profile.storageLimit) * 100}
          display={`${profile.storage} / ${profile.storageLimit} GB`}
          detail="Sample service data"
        />
      </div>
    </section>
  );
}
