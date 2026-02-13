import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ℹ️ About</h1>
        <p className="text-muted-foreground mt-2">Learn more about JCN Financial & Tax Advisory Group</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>JCN Financial & Tax Advisory Group, LLC</CardTitle>
          <CardDescription>Investment Dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">About This Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              This investment dashboard provides comprehensive portfolio tracking, analysis tools, and market insights
              for JCN Financial clients. The platform offers real-time data, detailed performance metrics, and risk
              assessment capabilities across multiple investment strategies.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Our Investment Strategies</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
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
            <h3 className="font-semibold mb-2">Analysis Tools</h3>
            <p className="text-sm text-muted-foreground">
              Our platform provides sophisticated analysis tools including individual stock research, broad market
              analysis, and comprehensive risk management capabilities to help you make informed investment decisions.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Technology</h3>
            <p className="text-sm text-muted-foreground">
              Built with Next.js, React, TypeScript, and Tailwind CSS. Deployed on Vercel for optimal performance and
              reliability.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
