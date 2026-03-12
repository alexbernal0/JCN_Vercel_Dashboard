import dynamic from "next/dynamic"

const BpbpDashboard = dynamic(
  () => import("@/components/risk/BpbpDashboard"),
  { ssr: false }
)

export default function RiskManagementPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Risk Management</h1>
        <p className="text-sm text-gray-400 mt-1">
          BPBP (Bull Power / Bear Pressure) Market Regime Indicator
        </p>
      </div>
      <BpbpDashboard />
    </div>
  )
}
