"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import {
  StageCard,
  type StageConfig,
  type StageCardHandle,
  type StageStatus,
} from "@/components/dashboard/data-sync/StageCard"

interface SyncRun {
  sync_date: string | null
  completed_at: string | null
  total_records: number
  tables_promoted: number
  status: string
  duration_secs: number
  executed_by: string
}

interface SyncHistoryData {
  last_sync: string | null
  prod_data_through: string | null
  runs: SyncRun[]
}

const stages: StageConfig[] = [
  {
    stageNum: 0,
    title: "Health & Inventory",
    description:
      "Connectivity check, gap analysis, fundamentals coverage, last sync status",
    icon: "\u2699\uFE0F",
    hasDryRun: false,
    apiEndpoint: "/api/sync/stage0",
  },
  {
    stageNum: 1,
    title: "Ingest",
    description:
      "EODHD download (prices + ETFs + fundamentals) with inline validation per batch",
    icon: "\u2B07\uFE0F",
    hasDryRun: true,
    previousGatePassed: true,
    apiEndpoint: "/api/sync/stage1",
  },
  {
    stageNum: 2,
    title: "Validate & Promote",
    description:
      "Full data quality audit \u2192 DEV \u2192 PROD promotion \u2192 universe maintenance \u2192 score verification",
    icon: "\uD83D\uDE80",
    hasDryRun: true,
    previousGatePassed: true,
    apiEndpoint: "/api/sync/stage2",
  },
  {
    stageNum: 3,
    title: "Audit & Report",
    description:
      "Final integrity report, cross-table consistency, self-healing recommendations",
    icon: "\uD83D\uDCDD",
    hasDryRun: false,
    previousGatePassed: true,
    apiEndpoint: "/api/sync/stage3",
  },
]

function formatTimestamp(ts: string | null): string {
  if (!ts) return "\u2014"
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ts
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  } catch {
    return ts
  }
}

function formatDate(ds: string | null): string {
  if (!ds) return "\u2014"
  try {
    const d = new Date(ds + "T12:00:00")
    if (isNaN(d.getTime())) return ds
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return ds
  }
}

export default function DataSyncPage() {
  const stageRefs = useRef<(StageCardHandle | null)[]>([])
  const [hasRunAll, setHasRunAll] = useState(false)
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [runAllStatus, setRunAllStatus] = useState<StageStatus>("idle")
  const [syncHistory, setSyncHistory] = useState<SyncHistoryData | null>(null)

  // Fetch sync history on mount and after pipeline runs
  useEffect(() => {
    const controller = new AbortController()
    async function fetchHistory() {
      try {
        const res = await fetch("/api/sync/history", {
          signal: controller.signal,
        })
        if (!res.ok) return
        const data: SyncHistoryData = await res.json()
        setSyncHistory(data)
      } catch {
        // ignore
      }
    }
    fetchHistory()
    return () => {
      controller.abort()
    }
  }, [hasRunAll])

  const lastSyncText = syncHistory?.last_sync
    ? `Last sync: ${formatTimestamp(syncHistory.last_sync)}`
    : syncHistory?.prod_data_through
      ? `PROD data through ${formatDate(syncHistory.prod_data_through)} \u2014 ready to sync`
      : "Checking status..."

  const runAllStages = useCallback(async () => {
    setIsRunningAll(true)
    setRunAllStatus("running")
    let worstStatus: StageStatus = "success"

    for (let i = 0; i < stages.length; i++) {
      const ref = stageRefs.current[i]
      if (ref) {
        const result = await ref.run()
        if (result === "error" || result === "gate_failed") {
          worstStatus = "error"
          break
        } else if (result === "warning") {
          worstStatus = "warning"
        }
      }
    }

    setRunAllStatus(worstStatus)
    setIsRunningAll(false)
    setHasRunAll(true)
  }, [])

  const runAllBtnColor = isRunningAll
    ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
    : runAllStatus === "success" && hasRunAll
      ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
      : runAllStatus === "error"
        ? "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
        : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                Data Sync Pipeline
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {lastSyncText}
              </p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                Auto-sync daily at 8:00 PM CST
              </p>
            </div>
            <button
              onClick={runAllStages}
              disabled={isRunningAll}
              className={`rounded-lg px-6 py-3 text-base font-semibold text-white shadow-sm transition-all ${runAllBtnColor}`}
            >
              {isRunningAll
                ? "\u23F3 Running Pipeline..."
                : hasRunAll
                  ? "\uD83D\uDD04 RERUN ALL"
                  : "\u25B6 RUN ALL"}
            </button>
          </div>
        </div>

        <hr className="my-6 border-gray-200 dark:border-gray-800" />

        {/* Pipeline stages */}
        <div className="space-y-4">
          {stages.map((stage, i) => (
            <StageCard
              key={stage.stageNum}
              ref={(el) => {
                stageRefs.current[i] = el
              }}
              config={stage}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <strong>Pipeline order:</strong> Each stage must pass its gate
            checks before the next stage unlocks. Stages with \uD83D\uDD12 are
            locked until prerequisites pass. Use Dry Run to preview without
            writing data.
          </p>
        </div>

        {/* Sync History Table */}
        {syncHistory && syncHistory.runs.length > 0 && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <div className="border-b border-gray-100 px-6 py-3 dark:border-gray-900">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Recent Syncs
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:border-gray-900 dark:text-gray-500">
                    <th className="px-6 py-2.5">Date</th>
                    <th className="px-6 py-2.5">Status</th>
                    <th className="px-6 py-2.5">Records</th>
                    <th className="px-6 py-2.5">Tables</th>
                    <th className="px-6 py-2.5">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {syncHistory.runs.map((run, i) => (
                    <tr
                      key={run.sync_date ?? i}
                      className={`border-b border-gray-50 dark:border-gray-900 ${i === 0 ? "bg-gray-50/50 dark:bg-gray-900/30" : ""}`}
                    >
                      <td className="px-6 py-2.5 text-gray-700 dark:text-gray-300">
                        {formatDate(run.sync_date)}
                      </td>
                      <td className="px-6 py-2.5">
                        {run.status === "SUCCESS" ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" />
                            {run.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-2.5 tabular-nums text-gray-600 dark:text-gray-400">
                        +{run.total_records.toLocaleString()}
                      </td>
                      <td className="px-6 py-2.5 text-gray-600 dark:text-gray-400">
                        {run.tables_promoted}
                      </td>
                      <td className="px-6 py-2.5 tabular-nums text-gray-500 dark:text-gray-500">
                        {run.duration_secs}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
