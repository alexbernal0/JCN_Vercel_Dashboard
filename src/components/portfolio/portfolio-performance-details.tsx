"use client";

import { useCallback, useEffect, useState } from "react";

import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PortfolioPosition } from "@/types/portfolio-input";
import type { PortfolioPerformanceData } from "@/types/portfolio-performance";

interface PortfolioPerformanceDetailsProps {
  positions: PortfolioPosition[];
}

export function PortfolioPerformanceDetails({ positions }: PortfolioPerformanceDetailsProps) {
  const [data, setData] = useState<PortfolioPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchPerformanceData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/portfolio/performance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ positions }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch performance data");
      }

      const result = await response.json();
      setData(result.data);
      setLastUpdated(result.timestamp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [positions]);

  useEffect(() => {
    if (positions.length === 0) {
      setLoading(false);
      return;
    }

    fetchPerformanceData();
  }, [positions, fetchPerformanceData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getPercentColor = (value: number) => {
    if (value > 0) return "text-green-600 dark:text-green-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getPercentBgColor = (value: number) => {
    if (value > 0) return "bg-green-50 dark:bg-green-950";
    if (value < 0) return "bg-red-50 dark:bg-red-950";
    return "";
  };

  const getPortfolioBgOpacity = (portPct: number) => {
    // Blue gradient based on portfolio percentage (0-100)
    const opacity = Math.min(portPct / 20, 1); // Max opacity at 20%
    return `rgba(59, 130, 246, ${opacity * 0.2})`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Portfolio Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading performance data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Portfolio Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Portfolio Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              No portfolio data available. Please add positions to the Portfolio Input table.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Portfolio Performance Details
          </CardTitle>
          {lastUpdated && (
            <Badge variant="outline" className="text-xs">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Security</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead className="text-right">Cost Basis</TableHead>
                <TableHead className="text-right">Cur Price</TableHead>
                <TableHead className="text-right">% Port.</TableHead>
                <TableHead className="text-right">Daily % Change</TableHead>
                <TableHead className="text-right">YTD %</TableHead>
                <TableHead className="text-right">YoY % Change</TableHead>
                <TableHead className="text-right">Port. Gain %</TableHead>
                <TableHead className="text-right">% Below 52wk High</TableHead>
                <TableHead className="text-right">52wk Chan Range</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Industry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.symbol}>
                  <TableCell className="font-medium">{row.security_name}</TableCell>
                  <TableCell>{row.symbol}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.cost_basis)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.current_price)}</TableCell>
                  <TableCell
                    className="text-right font-medium"
                    style={{
                      backgroundColor: getPortfolioBgOpacity(row.portfolio_pct),
                    }}
                  >
                    {formatPercent(row.portfolio_pct)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getPercentColor(row.daily_change_pct)} ${getPercentBgColor(row.daily_change_pct)}`}
                  >
                    {formatPercent(row.daily_change_pct)}
                  </TableCell>
                  <TableCell className={`text-right ${getPercentColor(row.ytd_pct)}`}>
                    {formatPercent(row.ytd_pct)}
                  </TableCell>
                  <TableCell className={`text-right ${getPercentColor(row.yoy_pct)}`}>
                    {formatPercent(row.yoy_pct)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getPercentColor(row.portfolio_gain_pct)}`}>
                    {formatPercent(row.portfolio_gain_pct)}
                  </TableCell>
                  <TableCell className="text-right">{formatPercent(row.pct_below_52w_high)}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.channel_range_52w)}</TableCell>
                  <TableCell>{row.sector}</TableCell>
                  <TableCell>{row.industry}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
