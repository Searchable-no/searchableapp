"use client";

import { Suspense } from "react";
import { DashboardClient } from "./dashboard-client";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

// Main dashboard page with suspense for better loading experience
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient />
    </Suspense>
  );
}
