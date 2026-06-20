import GenericOutwardNew from "@/components/outward/GenericOutwardNew";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/consumable-outward",
  title: "Consumables",
  emoji: "🔧",
  routeBase: "/consumables-outward",
  searchPlaceholder: "Search by item, quantity, unit, issued by…",
};

export default function ConsumablesOutwardNewPage() {
  return <GenericOutwardNew config={CONFIG} />;
}
