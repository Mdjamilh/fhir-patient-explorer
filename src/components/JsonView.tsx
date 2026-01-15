import { useMemo, useState } from "react";

import { tokenize } from "./json";
import styles from "./JsonView.module.css";

/** Pretty-printed, highlighted JSON with a copy button. */
export function JsonView({ value, label }: { value: unknown; label: string }) {
  const json = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const tokens = useMemo(() => tokenize(json), [json]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.copy} onClick={() => void copy()}>
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className={styles.pre} tabIndex={0} aria-label={label}>
        {tokens.map((t, i) => (t.kind ? <span key={i} className={styles[t.kind]}>{t.text}</span> : t.text))}
      </pre>
    </div>
  );
}
