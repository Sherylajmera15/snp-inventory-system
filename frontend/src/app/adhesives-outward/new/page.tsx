import GenericOutwardNew from "@/components/outward/GenericOutwardNew";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/adhesive-outward",
  title: "Adhesives",
  emoji: "🏷️",
  routeBase: "/adhesives-outward",
  searchPlaceholder: "Search by item, quantity, unit, issued by…",
};

export default function AdhesivesOutwardNewPage() {
  return <GenericOutwardNew config={CONFIG} />;
}
