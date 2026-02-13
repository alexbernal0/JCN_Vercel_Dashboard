import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RiskManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">🎯 Risk Management</h1>
        <p className="mt-2 text-muted-foreground">Portfolio risk assessment and management</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="mb-4 h-12 w-12 text-muted-foreground" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">The Risk Management page will include:</p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-muted-foreground text-sm">
            <li>Portfolio risk metrics (VaR, CVaR, beta, etc.)</li>
            <li>Stress testing and scenario analysis</li>
            <li>Correlation matrices and diversification analysis</li>
            <li>Drawdown analysis and recovery periods</li>
            <li>Hedging strategies and recommendations</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
