"use client";

import { useParams } from "next/navigation";
import { VisitScreen } from "@/components/visit-screen";

export default function VisitPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id ?? ""));
  return <VisitScreen inspectionId={id} />;
}
