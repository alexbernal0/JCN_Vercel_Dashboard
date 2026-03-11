"use client"

import { useState, useCallback } from "react"
import { FILTER_TABS, type FilterTab } from "./filterPresets"

/**
 * Active filter = a field with a non-"Any" selection.
 * Stored as { field: string, op: string, value: any }.
 */
export interface ActiveFilter {
  field: string
  op: string
  value: number | number[] | string | string[]
}

interface ScreenerFiltersProps {
  activeFilters: ActiveFilter[]
  onFiltersChange: (filters: ActiveFilter[]) => void
}

export default function ScreenerFilters({
  activeFilters,
  onFiltersChange,
}: ScreenerFiltersProps) {
  const [activeTab, setActiveTab] = useState<string>("descriptive")

  // Get the currently selected option index for a given field
  const getSelectedIndex = useCallback(
    (field: string): number => {
      const active = activeFilters.find((f) => f.field === field)
      if (!active) return 0 // "Any"

      // Find matching tab and filter def
      for (const tab of FILTER_TABS) {
        const filterDef = tab.filters.find((f) => f.field === field)
        if (filterDef) {
          const idx = filterDef.options.findIndex(
            (opt) =>
              opt.value.op === active.op &&
              JSON.stringify(opt.value.value) === JSON.stringify(active.value),
          )
          return idx >= 0 ? idx : 0
        }
      }
      return 0
    },
    [activeFilters],
  )

  const handleFilterChange = useCallback(
    (field: string, optionIndex: number, tab: FilterTab) => {
      const filterDef = tab.filters.find((f) => f.field === field)
      if (!filterDef) return

      const option = filterDef.options[optionIndex]
      if (!option) return

      // Remove existing filter for this field
      const newFilters = activeFilters.filter((f) => f.field !== field)

      // If not "Any" (index 0), add the filter
      if (optionIndex !== 0) {
        // Special case: sector "Any" has value ""
        if (field === "gics_sector" && option.value.value === "") {
          // Don't add — it's "Any"
        } else {
          newFilters.push({
            field,
            op: option.value.op,
            value: option.value.value,
          })
        }
      }

      onFiltersChange(newFilters)
    },
    [activeFilters, onFiltersChange],
  )

  const clearAllFilters = useCallback(() => {
    onFiltersChange([])
  }, [onFiltersChange])

  const activeCount = activeFilters.length
  const currentTab =
    FILTER_TABS.find((t) => t.id === activeTab) ?? FILTER_TABS[0]

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 px-3 pt-2 dark:border-gray-800">
        {FILTER_TABS.map((tab) => {
          const tabFilterCount = activeFilters.filter((af) =>
            tab.filters.some((f) => f.field === af.field),
          ).length

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
              {tabFilterCount > 0 && (
                <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                  {tabFilterCount}
                </span>
              )}
            </button>
          )
        })}

        {/* Clear All */}
        {activeCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="ml-auto whitespace-nowrap px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Clear All ({activeCount})
          </button>
        )}
      </div>

      {/* Filter Dropdowns for Active Tab */}
      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {currentTab.filters.map((filterDef) => {
          const selectedIdx = getSelectedIndex(filterDef.field)
          const isActive = selectedIdx !== 0

          return (
            <div key={filterDef.field} className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {filterDef.label}
              </label>
              <select
                value={selectedIdx}
                onChange={(e) =>
                  handleFilterChange(
                    filterDef.field,
                    parseInt(e.target.value, 10),
                    currentTab,
                  )
                }
                className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                  isActive
                    ? "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-200"
                    : "border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                } focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              >
                {filterDef.options.map((opt, i) => (
                  <option key={i} value={i}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
