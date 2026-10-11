import { Search } from "lucide-react";

type Props = { query: string; onQueryChange: (value: string) => void };

export function ServiceHeader(props: Props) {
  return (
    <header className="so-header gap-3.5 px-4 py-2">
      <div className="gap-1">
        <small className="text-sm">SERVICE TREE / SAMPLE MANIFEST</small>
        <b className="text-base">LOCAL SERVICES</b>
      </div>
      <label className="ml-auto gap-2 px-2 py-1.5 text-sm">
        <Search size={16} />
        <input
          aria-label="Search service tree"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="Filter services and hosts"
        />
      </label>
      <span className="max-[600px]:ml-auto text-sm">TELEMETRY IS SIMULATED</span>
    </header>
  );
}
