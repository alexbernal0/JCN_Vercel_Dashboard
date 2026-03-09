"use client"

import { useRef, useState, useCallback } from 'react'
import { StageCard, type StageConfig, type StageCardHandle, type StageStatus } from '@/components/dashboard/data-sync/StageCard'

const stages: StageConfig[] = [
  {
    stageNum: 0,
    title: 'Health & Inventory',
    description: 'Connectivity check, gap analysis, fundamentals coverage, last sync status',
    icon: '⚙️',
    hasDryRun: false,
    apiEndpoint: '/api/sync/stage0',
  },
  {
    stageNum: 1,
    title: 'Ingest',
    description: 'EODHD download (prices + ETFs + fundamentals) with inline validation per batch',
    icon: '⬇️',
    hasDryRun: true,
    previousGatePassed: true,
    apiEndpoint: '/api/sync/stage1',
  },
  {
    stageNum: 2,
    title: 'Validate & Promote',
    description: 'Full data quality audit → DEV → PROD promotion → universe maintenance → score verification',
    icon: '🚀',
    hasDryRun: true,
    previousGatePassed: true,
    apiEndpoint: '/api/sync/stage2',
  },
  {
    stageNum: 3,
    title: 'Audit & Report',
    description: 'Final integrity report, cross-table consistency, self-healing recommendations',
    icon: '📝',
    hasDryRun: false,
    previousGatePassed: true,
    apiEndpoint: '/api/sync/stage3',
  },
]

export default function DataSyncPage() {
  const stageRefs = useRef<(StageCardHandle | null)[]>([])
  const [hasRunAll, setHasRunAll] = useState(false)
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [runAllStatus, setRunAllStatus] = useState<StageStatus>('idle')

  const runAllStages = useCallback(async () => {
    setIsRunningAll(true)
    setRunAllStatus('running')
    let worstStatus: StageStatus = 'success'

    for (let i = 0; i < stages.length; i++) {
      const ref = stageRefs.current[i]
      if (ref) {
        const result = await ref.run()
        if (result === 'error' || result === 'gate_failed') {
          worstStatus = 'error'
          break
        } else if (result === 'warning') {
          worstStatus = 'warning'
        }
      }
    }

    setRunAllStatus(worstStatus)
    setIsRunningAll(false)
    setHasRunAll(true)
  }, [])

  const runAllBtnColor = isRunningAll
    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
    : runAllStatus === 'success' && hasRunAll
    ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
    : runAllStatus === 'error'
    ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
    : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
                🔄 Data Sync Pipeline
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Mission-critical 4-stage data synchronization — EODHD → DEV → PROD with validation gates
              </p>
            </div>
            <button
              onClick={runAllStages}
              disabled={isRunningAll}
              className={`rounded-lg px-6 py-3 text-base font-semibold text-white shadow-sm transition-all ${runAllBtnColor}`}
            >
              {isRunningAll ? '⏳ Running Pipeline...' : hasRunAll ? '🔄 RERUN ALL' : '▶ RUN ALL'}
            </button>
          </div>

        </div>

        <hr className="my-6 border-gray-200 dark:border-gray-800" />

        {/* Pipeline stages */}
        <div className="space-y-4">
          {stages.map((stage, i) => (
            <StageCard
              key={stage.stageNum}
              ref={(el) => { stageRefs.current[i] = el }}
              config={stage}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <strong>Pipeline order:</strong> Each stage must pass its gate checks before the next stage unlocks.
            Stages with 🔒 are locked until prerequisites pass. Use Dry Run to preview without writing data.
          </p>
        </div>
      </div>
    </div>
  )
}
