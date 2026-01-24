import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { useDocumentTitle } from "../hooks";
import styles from "./SearchPage.module.css";

export function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.lead}>
        That address doesn't match anything here. <Link to="/">Search for a patient</Link> instead.
      </p>
    </>
  );
}

/** Shown when a page throws while rendering, instead of a blank screen. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return (
    <div role="alert">
      <h1 className={styles.title}>Something broke on this page</h1>
      <p className={styles.lead}>
        {error instanceof Error ? error.message : "An unexpected error occurred."} <Link to="/">Back to search</Link>
      </p>
    </div>
  );
}
