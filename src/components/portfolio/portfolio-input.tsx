"use client";

import { useEffect, useState } from "react";

import { Lock, LockOpen, Pencil, Plus, Save, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_HOLDINGS, MAX_POSITIONS, type PortfolioHolding } from "@/types/portfolio-input";

interface PortfolioInputProps {
  initialPositions?: (PortfolioHolding | Omit<PortfolioHolding, "id">)[];
  onPositionsChange?: (positions: Omit<PortfolioHolding, "id">[]) => void;
}

export function PortfolioInput({ initialPositions, onPositionsChange }: PortfolioInputProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize holdings with provided or default data
  useEffect(() => {
    const source = initialPositions && initialPositions.length > 0 ? initialPositions : DEFAULT_HOLDINGS;
    const initialHoldings = source.map((holding, index) => ({
      ...holding,
      id: `holding-${index}`,
    }));
    setHoldings(initialHoldings);
  }, [initialPositions]);

  // Notify parent component of data changes
  useEffect(() => {
    if (onPositionsChange && holdings.length > 0) {
      const positions = holdings.map(({ symbol, costBasis, shares }) => ({ symbol, costBasis, shares }));
      onPositionsChange(positions);
    }
  }, [holdings, onPositionsChange]);

  const handleEdit = () => {
    setIsEditMode(true);
    setError(null);
  };

  const handleSave = () => {
    // Validate data before saving
    const hasEmptySymbols = holdings.some((h) => !h.symbol.trim());
    const hasInvalidNumbers = holdings.some((h) => h.costBasis <= 0 || h.shares < 0);

    if (hasEmptySymbols) {
      setError("All positions must have a valid stock symbol");
      return;
    }

    if (hasInvalidNumbers) {
      setError("Cost basis must be greater than $0 and shares must be non-negative");
      return;
    }

    setIsEditMode(false);
    setError(null);
  };

  const handleAddRow = () => {
    if (holdings.length >= MAX_POSITIONS) {
      setError(`Maximum ${MAX_POSITIONS} positions allowed`);
      return;
    }

    const newHolding: PortfolioHolding = {
      id: `holding-${Date.now()}`,
      symbol: "",
      costBasis: 0,
      shares: 0,
    };

    setHoldings([...holdings, newHolding]);
    setError(null);
  };

  const handleDeleteRow = (id: string) => {
    setHoldings(holdings.filter((h) => h.id !== id));
    setError(null);
  };

  const handleCellChange = (id: string, field: keyof Omit<PortfolioHolding, "id">, value: string | number) => {
    setHoldings(
      holdings.map((h) => {
        if (h.id === id) {
          return { ...h, [field]: value };
        }
        return h;
      }),
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">📊 Portfolio Input</CardTitle>
            <CardDescription>Enter your portfolio holdings below (max {MAX_POSITIONS} positions)</CardDescription>
          </div>
          <div className="flex gap-2">
            {isEditMode ? (
              <Button onClick={handleSave} variant="default" size="sm">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            ) : (
              <Button onClick={handleEdit} variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Indicator */}
        {isEditMode ? (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <LockOpen className="h-4 w-4" />
            <AlertDescription className="font-medium">
              ✏️ Edit Mode Active - You can now modify the portfolio. Click 'Save' when done.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <Lock className="h-4 w-4" />
            <AlertDescription className="font-medium">
              🔒 View Mode - Portfolio is locked. Click 'Edit' to make changes.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Portfolio Table */}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Stock Symbol</TableHead>
                <TableHead>Cost Basis ($)</TableHead>
                <TableHead>Number of Shares</TableHead>
                {isEditMode && <TableHead className="w-20">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((holding, index) => (
                <TableRow key={holding.id}>
                  <TableCell className="font-medium">{index}</TableCell>
                  <TableCell>
                    {isEditMode ? (
                      <Input
                        value={holding.symbol}
                        onChange={(e) => handleCellChange(holding.id, "symbol", e.target.value.toUpperCase())}
                        placeholder="e.g., AAPL"
                        maxLength={10}
                        className="max-w-[150px]"
                      />
                    ) : (
                      <span className="font-mono">{holding.symbol}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditMode ? (
                      <Input
                        type="number"
                        value={holding.costBasis}
                        onChange={(e) => handleCellChange(holding.id, "costBasis", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        step="0.01"
                        min="0.01"
                        className="max-w-[150px]"
                      />
                    ) : (
                      <span>${holding.costBasis.toFixed(2)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditMode ? (
                      <Input
                        type="number"
                        value={holding.shares}
                        onChange={(e) => handleCellChange(holding.id, "shares", parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        step="1"
                        min="0"
                        className="max-w-[150px]"
                      />
                    ) : (
                      <span>{holding.shares.toLocaleString()}</span>
                    )}
                  </TableCell>
                  {isEditMode && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRow(holding.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Add Row Button */}
        {isEditMode && (
          <Button
            onClick={handleAddRow}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={holdings.length >= MAX_POSITIONS}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Position ({holdings.length}/{MAX_POSITIONS})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
