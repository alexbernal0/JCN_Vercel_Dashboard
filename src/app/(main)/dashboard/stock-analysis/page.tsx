import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StockAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">📈 Stock Analysis</h1>
        <p className="mt-2 text-muted-foreground">Individual stock research and analysis</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="mb-4 h-12 w-12 text-muted-foreground" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">The Stock Analysis page will include:</p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-muted-foreground text-sm">
            <li>Stock search and selection tools</li>
            <li>Fundamental analysis (P/E, EPS, revenue, etc.)</li>
            <li>Technical analysis charts and indicators</li>
            <li>Company financials and key metrics</li>
            <li>Analyst ratings and price targets</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
