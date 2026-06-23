import GenericOutwardDetail from "@/components/outward/GenericOutwardDetail";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/micro-chemicals-outward",
  title: "Micro Chemicals",
  emoji: "🧫",
  routeBase: "/micro-outward/chemicals",
  searchPlaceholder: "Search by chemical name…",
};

export default function MicroChemicalsOutwardDetailPage() {
  return <GenericOutwardDetail config={CONFIG} />;
}
