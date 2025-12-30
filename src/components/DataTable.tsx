import type { ReactNode } from "react";

import styles from "./DataTable.module.css";

export type Column<T> = { header: string; cell: (row: T) => ReactNode; nowrap?: boolean };

export function DataTable<T>({ rows, columns, rowKey, caption }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T, index: number) => string; caption?: string }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {columns.map((c) => (
                <td key={c.header} className={c.nowrap ? styles.nowrap : undefined}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type Tone = "ok" | "warn" | "danger" | "accent" | "neutral";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}
