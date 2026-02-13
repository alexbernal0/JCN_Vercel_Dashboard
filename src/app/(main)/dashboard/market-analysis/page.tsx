import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🌐 Market Analysis</h1>
        <p className="text-muted-foreground mt-2">Broad market trends and sector analysis</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The Market Analysis page will include:</p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
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
