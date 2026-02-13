import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">JCN Financial Dashboard</h1>
        <p className="text-muted-foreground mt-2">Investment Dashboard - Welcome</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>📊 Persistent Value</CardTitle>
            <CardDescription>Value-focused investment strategy with long-term growth potential</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">View portfolio performance, holdings, and analytics</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🌱 Olivia Growth</CardTitle>
            <CardDescription>Growth-focused investment strategy</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Track growth metrics and portfolio composition</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>⚡ Pure Alpha</CardTitle>
            <CardDescription>Alpha-generating investment strategy</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Monitor alpha generation and risk-adjusted returns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📈 Stock Analysis</CardTitle>
            <CardDescription>Individual stock research and analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Deep dive into individual stock fundamentals and technicals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🌐 Market Analysis</CardTitle>
            <CardDescription>Broad market trends and sector analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Analyze market trends, sectors, and economic indicators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🎯 Risk Management</CardTitle>
            <CardDescription>Portfolio risk assessment and management</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Evaluate portfolio risk, correlations, and hedging strategies
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <h3 className="font-semibold mb-2">Real-time Data</h3>
            <p className="text-sm text-muted-foreground">
              All portfolio data is updated in real-time using market feeds
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Comprehensive Analysis</h3>
            <p className="text-sm text-muted-foreground">Detailed performance metrics and risk assessments</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Multi-Portfolio</h3>
            <p className="text-sm text-muted-foreground">Track multiple investment strategies simultaneously</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
