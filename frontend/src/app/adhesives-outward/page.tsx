import GenericOutwardDashboard from "@/components/outward/GenericOutwardDashboard";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/adhesive-outward",
  title: "Adhesives",
  emoji: "🏷️",
  routeBase: "/adhesives-outward",
  searchPlaceholder: "Search by item, quantity, unit, issued by…",
};

export default function AdhesivesOutwardPage() {
  return <GenericOutwardDashboard config={CONFIG} />;
}
