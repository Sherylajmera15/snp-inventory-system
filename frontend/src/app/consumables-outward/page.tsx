import GenericOutwardDashboard from "@/components/outward/GenericOutwardDashboard";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/consumable-outward",
  title: "Consumables",
  emoji: "🔧",
  routeBase: "/consumables-outward",
  searchPlaceholder: "Search by item, quantity, unit, issued by…",
};

export default function ConsumablesOutwardPage() {
  return <GenericOutwardDashboard config={CONFIG} />;
}
