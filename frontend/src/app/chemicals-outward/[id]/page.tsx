import GenericOutwardDetailPage from "@/components/outward/GenericOutwardDetail";
import { OutwardModuleConfig } from "@/types/generic-outward";

const CONFIG: OutwardModuleConfig = {
  apiPrefix: "/api/chemical-outward",
  title: "Chemicals",
  emoji: "🧪",
  routeBase: "/chemicals-outward",
  searchPlaceholder: "",
};

export default function ChemicalsOutwardDetailPage() {
  return <GenericOutwardDetailPage config={CONFIG} />;
}
