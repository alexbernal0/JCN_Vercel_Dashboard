"use client"

import dynamic from "next/dynamic"

const StockHeatmap = dynamic(
  () => import("@/components/dashboard/StockHeatmap"),
  { ssr: false },
)

export default function DashboardPage() {
  return (
    <div className="h-[calc(100vh-56px)] w-full p-2 md:h-screen md:p-4">
      <StockHeatmap />
    </div>
  )
}
