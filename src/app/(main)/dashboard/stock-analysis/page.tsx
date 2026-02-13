import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StockAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">📈 Stock Analysis</h1>
        <p className="text-muted-foreground mt-2">Individual stock research and analysis</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The Stock Analysis page will include:</p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
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
