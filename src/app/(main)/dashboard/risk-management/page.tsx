import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RiskManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🎯 Risk Management</h1>
        <p className="text-muted-foreground mt-2">Portfolio risk assessment and management</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The Risk Management page will include:</p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
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
