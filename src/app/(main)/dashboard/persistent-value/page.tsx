import { PortfolioInput } from "@/components/portfolio/portfolio-input";

export default function PersistentValuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">📊 Persistent Value</h1>
        <p className="text-muted-foreground mt-2">Value-focused investment strategy with long-term growth potential</p>
      </div>

      <PortfolioInput />

      <div className="mt-8 p-8 border rounded-lg bg-muted/50">
        <p className="text-center text-muted-foreground">
          Additional components will be added here as we build them out.
        </p>
      </div>
    </div>
  );
}
