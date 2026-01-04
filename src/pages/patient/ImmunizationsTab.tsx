import type { Immunization } from "fhir/r4";
import { useParams } from "react-router";

import { Badge, DataTable, type Column } from "../../components/DataTable";
import { QueryView, TruncatedNote } from "../../components/QueryView";
import { Empty } from "../../components/States";
import { useImmunizations } from "../../data/queries";
import { immunizationDate, sortImmunizations } from "../../fhir/clinical";
import { codeableText, formatDate } from "../../fhir/format";

const columns: Column<Immunization>[] = [
  { header: "Vaccine", cell: (i) => codeableText(i.vaccineCode) },
  { header: "Date", cell: (i) => formatDate(immunizationDate(i)), nowrap: true },
  { header: "Status", cell: (i) => <Badge tone={i.status === "completed" ? "ok" : "warn"}>{i.status === "completed" ? "Given" : "Not given"}</Badge> },
  { header: "Location", cell: (i) => i.location?.display ?? "—" },
];

export function ImmunizationsTab() {
  const { id = "" } = useParams();
  return (
    <QueryView query={useImmunizations(id)} label="immunizations">
      {({ resources, truncated }) => {
        const rows = sortImmunizations(resources);
        if (!rows.length) return <Empty>No immunizations recorded.</Empty>;
        return (
          <>
            <TruncatedNote truncated={truncated} what="immunizations" />
            <DataTable rows={rows} columns={columns} rowKey={(i) => i.id!} caption={`${rows.length} immunizations`} />
          </>
        );
      }}
    </QueryView>
  );
}
