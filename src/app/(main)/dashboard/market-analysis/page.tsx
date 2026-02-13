import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">🌐 Market Analysis</h1>
        <p className="mt-2 text-muted-foreground">Broad market trends and sector analysis</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="mb-4 h-12 w-12 text-muted-foreground" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">The Market Analysis page will include:</p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-muted-foreground text-sm">
            <li>Market indices performance and trends</li>
            <li>Sector rotation and relative strength</li>
            <li>Economic indicators and macro analysis</li>
            <li>Market breadth and sentiment indicators</li>
            <li>Correlation analysis across asset classes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
