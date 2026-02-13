import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OliviaGrowthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">🌱 Olivia Growth</h1>
        <p className="mt-2 text-muted-foreground">Growth-focused investment strategy</p>
      </div>

      <Card>
        <CardHeader>
          <Construction className="mb-4 h-12 w-12 text-muted-foreground" />
          <CardTitle>Under Construction</CardTitle>
          <CardDescription>This page is currently being built. Check back soon!</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">The Olivia Growth portfolio page will include:</p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-muted-foreground text-sm">
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
