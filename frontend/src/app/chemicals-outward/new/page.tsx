import GenericOutwardNew from "@/components/outward/GenericOutwardNew";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/chemical-outward",
  title: "Chemicals",
  emoji: "🧪",
  routeBase: "/chemicals-outward",
  searchPlaceholder: "Search by item, quantity, unit, issued by…",
};

export default function ChemicalsOutwardNewPage() {
  return <GenericOutwardNew config={CONFIG} />;
}
