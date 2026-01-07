import type { RouteObject } from "react-router";

import { Layout } from "./components/Layout";
import { ConditionsTab } from "./pages/patient/ConditionsTab";
import { LabsTab } from "./pages/patient/LabsTab";
import { ImmunizationsTab } from "./pages/patient/ImmunizationsTab";
import { MedicationsTab } from "./pages/patient/MedicationsTab";
import { PatientLayout } from "./pages/patient/PatientLayout";
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
          { path: "labs", element: <LabsTab /> },
          { path: "conditions", element: <ConditionsTab /> },
          { path: "medications", element: <MedicationsTab /> },
          { path: "immunizations", element: <ImmunizationsTab /> },
        ],
      },
    ],
  },
];
