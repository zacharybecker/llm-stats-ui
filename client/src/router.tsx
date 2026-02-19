import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { ComparisonPage } from "./components/comparison/ComparisonPage";
import { PricingPage } from "./components/pricing/PricingPage";
import { ModelDetailPage } from "./components/detail/ModelDetailPage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/comparison", element: <ComparisonPage /> },
      { path: "/pricing", element: <PricingPage /> },
      { path: "/models/*", element: <ModelDetailPage /> },
    ],
  },
]);
