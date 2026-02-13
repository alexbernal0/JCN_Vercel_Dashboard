import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PureAlphaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">⚡ Pure Alpha</h1>
        <p className="mt-2 text-muted-foreground">Alpha-generating investment strategy</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="mb-4 h-12 w-12 text-muted-foreground" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">The Pure Alpha portfolio page will include:</p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-muted-foreground text-sm">
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
