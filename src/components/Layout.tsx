import { Link, Outlet } from "react-router";

import { useCapabilities } from "../data/queries";
import { useServer } from "../data/server-context";
import { useTheme } from "../hooks";
import styles from "./Layout.module.css";

export function Layout() {
  const { client } = useServer();
  const { theme, toggle } = useTheme();
  const metadata = useCapabilities();
  const state = metadata.isSuccess ? "ok" : metadata.isError ? "error" : "loading";

  return (
    <>
      <a href="#main" className="visually-hidden">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <span className={styles.logo} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 32 32">
              <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="currentColor" />
            </svg>
          </span>
          <span className={styles.brandText}>FHIR Patient Explorer</span>
        </Link>
        <Link to="/server" className={styles.server} title="Change FHIR server">
          <span className={styles.dot} data-state={state} aria-hidden />
          <span className="visually-hidden">
            {state === "ok" ? "Connected to" : state === "error" ? "Cannot reach" : "Connecting to"}
          </span>
          <span className={styles.serverUrl}>{client.baseUrl.replace(/^https?:\/\//, "")}</span>
        </Link>
        <button
          type="button"
          className={styles.iconButton}
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </header>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        Data comes straight from the selected FHIR server and stays in your browser. Public test servers hold synthetic
        patients only.
      </footer>
    </>
  );
}
