import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OliviaGrowthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🌱 Olivia Growth</h1>
        <p className="text-muted-foreground mt-2">Growth-focused investment strategy</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The Olivia Growth portfolio page will include:</p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Growth metrics and performance tracking</li>
            <li>Portfolio composition and top holdings</li>
            <li>Growth rate analysis and projections</li>
            <li>Sector exposure and concentration</li>
            <li>Comparative performance vs benchmarks</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
