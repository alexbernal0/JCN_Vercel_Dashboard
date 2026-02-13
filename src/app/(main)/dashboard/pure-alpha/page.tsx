import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PureAlphaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">⚡ Pure Alpha</h1>
        <p className="text-muted-foreground mt-2">Alpha-generating investment strategy</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The Pure Alpha portfolio page will include:</p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Alpha generation metrics and tracking</li>
            <li>Risk-adjusted return analysis</li>
            <li>Portfolio holdings and strategy allocation</li>
            <li>Sharpe ratio and other performance indicators</li>
            <li>Market-neutral positioning analysis</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
