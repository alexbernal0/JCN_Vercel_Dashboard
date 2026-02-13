"use client";

import { useState } from "react";

import { PortfolioInput } from "@/components/portfolio/portfolio-input";
import { PortfolioPerformanceDetails } from "@/components/portfolio/portfolio-performance-details";
import type { PortfolioPosition } from "@/types/portfolio-input";

// Default portfolio positions
const defaultPositions: PortfolioPosition[] = [
  { symbol: "SPMO", costBasis: 97.4, shares: 14301 },
  { symbol: "ASML", costBasis: 660.32, shares: 1042 },
  { symbol: "MNST", costBasis: 50.01, shares: 8234 },
  { symbol: "MSCI", costBasis: 342.94, shares: 2016 },
  { symbol: "COST", costBasis: 655.21, shares: 798 },
  { symbol: "AVGO", costBasis: 138.0, shares: 6088 },
  { symbol: "MA", costBasis: 418.76, shares: 1389 },
  { symbol: "FICO", costBasis: 1850.0, shares: 778 },
  { symbol: "SPGI", costBasis: 427.93, shares: 1554 },
  { symbol: "IDXX", costBasis: 378.01, shares: 1570 },
  { symbol: "ISRG", costBasis: 322.5, shares: 1893 },
  { symbol: "V", costBasis: 276.65, shares: 2230 },
  { symbol: "CAT", costBasis: 287.7, shares: 1980 },
  { symbol: "ORLY", costBasis: 103.0, shares: 5430 },
  { symbol: "HEI", costBasis: 172.0, shares: 3220 },
  { symbol: "CPRT", costBasis: 52.0, shares: 10890 },
  { symbol: "WM", costBasis: 177.77, shares: 2890 },
  { symbol: "TSLA", costBasis: 270.0, shares: 2340 },
  { symbol: "AAPL", costBasis: 181.4, shares: 3450 },
  { symbol: "LRCX", costBasis: 73.24, shares: 7890 },
  { symbol: "TSM", costBasis: 99.61, shares: 5670 },
];

export default function PersistentValuePage() {
  const [positions, setPositions] = useState<PortfolioPosition[]>(defaultPositions);

  const handlePositionsChange = (newPositions: PortfolioPosition[]) => {
    setPositions(newPositions);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">📊 Persistent Value</h1>
        <p className="mt-2 text-muted-foreground">Value-focused investment strategy with long-term growth potential</p>
      </div>

      {/* Portfolio Performance Details - Above the input table */}
      <PortfolioPerformanceDetails positions={positions} />

      {/* Portfolio Input - Always at the bottom */}
      <PortfolioInput initialPositions={positions} onPositionsChange={handlePositionsChange} />
    </div>
  );
}
