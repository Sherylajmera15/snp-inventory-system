import GenericOutwardDetailPage from "@/components/outward/GenericOutwardDetail";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/consumable-outward",
  title: "Consumables",
  emoji: "🔧",
  routeBase: "/consumables-outward",
  searchPlaceholder: "",
};

export default function ConsumablesOutwardDetailPage() {
  return <GenericOutwardDetailPage config={CONFIG} />;
}
