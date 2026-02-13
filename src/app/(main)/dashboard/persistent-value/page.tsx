import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PersistentValuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">📊 Persistent Value</h1>
        <p className="text-muted-foreground mt-2">Value-focused investment strategy with long-term growth potential</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The Persistent Value portfolio page will include:</p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Portfolio performance metrics and charts</li>
            <li>Current holdings and allocations</li>
            <li>Historical performance analysis</li>
            <li>Risk metrics and volatility analysis</li>
            <li>Sector and asset class breakdown</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
