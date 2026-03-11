"use client"

import dynamic from "next/dynamic"

const AdvancedChart = dynamic(
  () => import("@/components/dashboard/AdvancedChart"),
  { ssr: false },
)

const StockHeatmap = dynamic(
  () => import("@/components/dashboard/StockHeatmap"),
  { ssr: false },
)

const CHARTS = ["SPY", "QQQ", "ACWI"] as const

export default function DashboardPage() {
  return (
    <div className="flex h-[calc(100vh-56px)] w-full flex-col gap-2 p-2 md:h-screen md:gap-3 md:p-4">
      {/* Three equally spaced daily candle charts */}
      <div className="grid min-h-0 flex-[2] grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
        {CHARTS.map((symbol) => (
          <div key={symbol} className="min-h-[200px]">
            <AdvancedChart symbol={symbol} />
          </div>
        ))}
      </div>

      {/* S&P 500 heatmap */}
      <div className="min-h-0 flex-[3]">
        <StockHeatmap />
      </div>
    </div>
  )
}
