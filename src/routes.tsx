import type { RouteObject } from "react-router";

import { Layout } from "./components/Layout";
import { ConditionsTab } from "./pages/patient/ConditionsTab";
import { LabsTab } from "./pages/patient/LabsTab";
import { ImmunizationsTab } from "./pages/patient/ImmunizationsTab";
import { MedicationsTab } from "./pages/patient/MedicationsTab";
import { PatientLayout } from "./pages/patient/PatientLayout";
import { RawDataTab } from "./pages/patient/RawDataTab";
import { SummaryTab } from "./pages/patient/SummaryTab";
import { VisitsTab } from "./pages/patient/VisitsTab";
import { SearchPage } from "./pages/SearchPage";

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <SearchPage /> },
      {
        path: "patients/:id",
        element: <PatientLayout />,
        children: [
          { index: true, element: <SummaryTab /> },
          { path: "labs", element: <LabsTab /> },
          { path: "conditions", element: <ConditionsTab /> },
          { path: "medications", element: <MedicationsTab /> },
          { path: "visits", element: <VisitsTab /> },
          { path: "immunizations", element: <ImmunizationsTab /> },
          { path: "data", element: <RawDataTab /> },
        ],
      },
    ],
  },
];
