import GenericOutwardDetailPage from "@/components/outward/GenericOutwardDetail";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/adhesive-outward",
  title: "Adhesives",
  emoji: "🏷️",
  routeBase: "/adhesives-outward",
  searchPlaceholder: "",
};

export default function AdhesivesOutwardDetailPage() {
  return <GenericOutwardDetailPage config={CONFIG} />;
}
