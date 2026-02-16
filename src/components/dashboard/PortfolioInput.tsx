'use client';

import { useState } from 'react';


export interface PortfolioHolding {
  symbol: string;
  costBasis: number;
  shares: number;
}

interface PortfolioInputProps {
  initialHoldings?: PortfolioHolding[];
  onSave?: (holdings: PortfolioHolding[]) => void;
}

export function PortfolioInput({ initialHoldings = [], onSave }: PortfolioInputProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(
    initialHoldings.length > 0 ? initialHoldings : [
      { symbol: '', costBasis: 0, shares: 0 }
    ]
  );

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleSave = () => {
    setIsEditMode(false);
    if (onSave) {
      // Filter out empty rows before saving
      const validHoldings = holdings.filter(h => h.symbol.trim() !== '');
      onSave(validHoldings);
    }
  };

  const handleAddRow = () => {
    if (holdings.length < 30) {
      setHoldings([...holdings, { symbol: '', costBasis: 0, shares: 0 }]);
    }
  };

  const handleRemoveRow = (index: number) => {
    const newHoldings = holdings.filter((_, i) => i !== index);
    setHoldings(newHoldings.length > 0 ? newHoldings : [{ symbol: '', costBasis: 0, shares: 0 }]);
  };

  const handleChange = (index: number, field: keyof PortfolioHolding, value: string | number) => {
    const newHoldings = [...holdings];
    if (field === 'symbol') {
      newHoldings[index][field] = (value as string).toUpperCase();
    } else {
      newHoldings[index][field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    }
    setHoldings(newHoldings);
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg mt-8">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            📊 Portfolio Input
          </h3>
          <div className="flex items-center gap-4">
            {isEditMode ? (
              <>
                <button onClick={handleSave} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">
                  💾 Save
                </button>
                <button onClick={handleAddRow} disabled={holdings.length >= 30} className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  ➕ Add Row
                </button>
              </>
            ) : (
              <button onClick={handleEdit} className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                ✏️ Edit
              </button>
            )}
          </div>
        </div>

        {/* Status Message */}
        {isEditMode ? (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-700 dark:text-blue-300">
            ✏️ <strong>Edit Mode Active</strong> - You can now modify the portfolio. Click &apos;Save&apos; when done.
          </div>
        ) : (
          <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-300">
            🔒 <strong>View Mode</strong> - Portfolio is locked. Click &apos;Edit&apos; to make changes.
          </div>
        )}

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Enter your portfolio holdings below (max 30 positions)
        </p>

        {/* Table */}
        <div className="border rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">#</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Stock Symbol</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Cost Basis ($)</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Number of Shares</th>
                {isEditMode && <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding, index) => (
                <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{index}</td>
                  <td className="px-4 py-2">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={holding.symbol}
                        onChange={(e) => handleChange(index, 'symbol', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                        placeholder="e.g., AAPL"
                        maxLength={10}
                      />
                    ) : (
                      <span className="text-sm">{holding.symbol || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditMode ? (
                      <input
                        type="number"
                        value={holding.costBasis}
                        onChange={(e) => handleChange(index, 'costBasis', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    ) : (
                      <span className="text-sm">${holding.costBasis.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditMode ? (
                      <input
                        type="number"
                        value={holding.shares}
                        onChange={(e) => handleChange(index, 'shares', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                        placeholder="0"
                        step="1"
                        min="0"
                      />
                    ) : (
                      <span className="text-sm">{holding.shares}</span>
                    )}
                  </td>
                  {isEditMode && (
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleRemoveRow(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        disabled={holdings.length === 1}
                      >
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {holdings.length >= 30 && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            ⚠️ Maximum 30 positions reached
          </p>
        )}
        
        {/* Footer white space for future links */}
        <div className="mt-8 mb-4">
          {/* Reserved for footer links */}
        </div>
      </div>
    </div>
  );
}
