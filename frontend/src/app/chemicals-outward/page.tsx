import GenericOutwardDashboard from "@/components/outward/GenericOutwardDashboard";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/chemical-outward",
  title: "Chemicals",
  emoji: "🧪",
  routeBase: "/chemicals-outward",
  searchPlaceholder: "Search by item, quantity, unit, issued by…",
};

export default function ChemicalsOutwardPage() {
  return <GenericOutwardDashboard config={CONFIG} />;
}
