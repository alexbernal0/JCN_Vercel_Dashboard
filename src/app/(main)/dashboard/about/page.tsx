import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">ℹ️ About</h1>
        <p className="mt-2 text-muted-foreground">Learn more about JCN Financial & Tax Advisory Group</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>JCN Financial & Tax Advisory Group, LLC</CardTitle>
          <CardDescription>Investment Dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-2 font-semibold">About This Dashboard</h3>
            <p className="text-muted-foreground text-sm">
              This investment dashboard provides comprehensive portfolio tracking, analysis tools, and market insights
              for JCN Financial clients. The platform offers real-time data, detailed performance metrics, and risk
              assessment capabilities across multiple investment strategies.
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Our Investment Strategies</h3>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground text-sm">
              <li>
                <strong>Persistent Value:</strong> Value-focused investment strategy with long-term growth potential
              </li>
              <li>
                <strong>Olivia Growth:</strong> Growth-focused investment strategy targeting high-growth opportunities
              </li>
              <li>
                <strong>Pure Alpha:</strong> Alpha-generating investment strategy focused on risk-adjusted returns
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Analysis Tools</h3>
            <p className="text-muted-foreground text-sm">
              Our platform provides sophisticated analysis tools including individual stock research, broad market
              analysis, and comprehensive risk management capabilities to help you make informed investment decisions.
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Technology</h3>
            <p className="text-muted-foreground text-sm">
              Built with Next.js, React, TypeScript, and Tailwind CSS. Deployed on Vercel for optimal performance and
              reliability.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
