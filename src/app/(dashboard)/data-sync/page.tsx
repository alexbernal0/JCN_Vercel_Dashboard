"use client"

import { StageCard, type StageConfig } from '@/components/dashboard/data-sync/StageCard'

const stages: StageConfig[] = [
  {
    stageNum: 0,
    title: 'Environment Check',
    description: 'Verify MotherDuck connection, EODHD API key, and schema availability',
    icon: '⚙️',
    hasDryRun: false,
  },
  {
    stageNum: 1,
    title: 'Inventory & Gap Analysis',
    description: 'Compare DEV vs PROD tables — row counts, date ranges, symbol coverage',
    icon: '📋',
    hasDryRun: true,
    previousGatePassed: true,
  },
  {
    stageNum: 2,
    title: 'EODHD Download',
    description: 'Incremental download from EODHD API into DEV tables with validation',
    icon: '⬇️',
    hasDryRun: true,
    previousGatePassed: true,
  },
  {
    stageNum: 3,
    title: 'Data Quality Checks',
    description: '15-point validation: duplicates, nulls, date gaps, PIT compliance, price sanity',
    icon: '🔍',
    hasDryRun: true,
    previousGatePassed: true,
  },
  {
    stageNum: 4,
    title: 'DEV → PROD Promotion',
    description: 'Promote validated DEV data to PROD with score recalculation and verification',
    icon: '🚀',
    hasDryRun: true,
    previousGatePassed: true,
  },
  {
    stageNum: 5,
    title: 'Symbol Universe Maintenance',
    description: 'Update universe table — filter MF/OTC, update flags, mark delisted',
    icon: '🌍',
    hasDryRun: true,
    previousGatePassed: true,
  },
  {
    stageNum: 6,
    title: 'ETF Sync',
    description: 'Promote ETF data separately — verify no equity contamination',
    icon: '📊',
    hasDryRun: true,
    previousGatePassed: true,
  },
  {
    stageNum: 7,
    title: 'Full Audit Report',
    description: '9-section comprehensive audit — integrity, coverage, freshness, PIT, scoring',
    icon: '📝',
    hasDryRun: false,
    previousGatePassed: true,
  },
]

export default function DataSyncPage() {
  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
            🔄 Data Sync Pipeline
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Mission-critical 8-stage data synchronization — EODHD → DEV → PROD with validation gates
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-1.5 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
              <span>⚠️</span>
              <span>Backend not connected — UI shell with simulated output</span>
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-200 dark:border-gray-800" />

        {/* Pipeline stages */}
        <div className="space-y-4">
          {stages.map((stage) => (
            <StageCard key={stage.stageNum} config={stage} />
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
