'use client'

import { useState, useCallback } from 'react'
import { SyncConsole, type ConsoleLine } from './SyncConsole'

export type StageStatus = 'idle' | 'running' | 'success' | 'warning' | 'error' | 'gate_failed'

interface GateCheck {
  name: string
  passed: boolean
  detail: string
}

export interface StageConfig {
  stageNum: number
  title: string
  description: string
  icon: string
  gateChecks?: GateCheck[]
  previousGatePassed?: boolean
  hasDryRun?: boolean
}

interface StageCardProps {
  config: StageConfig
}

const statusBadge: Record<StageStatus, { label: string; color: string }> = {
  idle: { label: 'IDLE', color: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  running: { label: 'RUNNING', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  success: { label: 'PASSED', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  warning: { label: 'WARNING', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  error: { label: 'ERROR', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  gate_failed: { label: 'GATE FAILED', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
}

export function StageCard({ config }: StageCardProps) {
  const [status, setStatus] = useState<StageStatus>('idle')
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [showConsole, setShowConsole] = useState(false)
  const isLocked = config.stageNum > 0 && config.previousGatePassed === false

  const addLine = useCallback((text: string, type: ConsoleLine['type'] = 'info') => {
    const now = new Date().toLocaleTimeString('en-US', { hour12: false })
    setConsoleLines(prev => [...prev, { text, type, timestamp: now }])
  }, [])

  const simulateRun = useCallback(async () => {
    if (isLocked) return
    setStatus('running')
    setShowConsole(true)
    setConsoleLines([])

    addLine('='.repeat(72), 'divider')
    addLine(`STAGE ${config.stageNum}: ${config.title.toUpperCase()}`, 'header')
    addLine('='.repeat(72), 'divider')
    addLine('')

    // Simulated placeholder output per stage
    const stageMessages: Record<number, string[]> = {
      0: [
        'Checking MotherDuck connection...',
        'Checking EODHD API key...',
        'Verifying DEV_EODHD_DATA schema...',
        'Verifying PROD_EODHD schema...',
      ],
      1: [
        'Querying DEV_EOD_survivorship...',
        'Querying DEV_EOD_Fundamentals...',
        'Querying DEV_EOD_ETFs...',
        'Querying PROD tables...',
        'Calculating sync requirements...',
        'Running data quality cross-checks...',
      ],
      2: [
        'Checking EODHD rate limits...',
        'Calculating incremental date range...',
        'Downloading survivorship batch 1/N...',
        'Validating batch — symbol format, prices, duplicates...',
        'Writing validated batch to DEV...',
      ],
      3: [
        'Check 1: Duplicate detection...',
        'Check 2: Metadata population...',
        'Check 3: Date continuity...',
        'Check 4: Negative price scan...',
        'Check 5: PIT violation scan...',
        'Running 10 more checks...',
      ],
      4: [
        'Section A: DEV vs PROD gap analysis...',
        'Section B: DEV → PROD promotion...',
        'Section C: Score distribution validation...',
        'Section D: Final verification + sync log...',
      ],
      5: [
        'Auditing PROD_Symbol_Universe...',
        'Filtering MF/OTC/warrants...',
        'Updating has_fundamentals flags...',
        'Updating price_row_count...',
        'Updating is_active for delisted symbols...',
      ],
      6: [
        'Analyzing DEV vs PROD ETF gap...',
        'Promoting incremental ETF rows...',
        'Verifying no equity contamination...',
        'Writing sync log entry...',
      ],
      7: [
        'Section A: Table inventory...',
        'Section B: Survivorship integrity...',
        'Section C: Fundamentals coverage...',
        'Section D: Symbol universe quality...',
        'Section E: Score completeness...',
        'Section F: Data freshness...',
        'Section G: Cross-table consistency...',
        'Section H: PIT compliance...',
        'Section I: Final scoring...',
      ],
    }

    const messages = stageMessages[config.stageNum] || ['Running stage...']
    for (const msg of messages) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200))
      addLine(msg)
    }

    addLine('')
    addLine('='.repeat(72), 'divider')
    addLine(`⏳ Stage ${config.stageNum} is a placeholder — backend not yet connected`, 'warning')
    addLine('Connect the FastAPI endpoint to enable live execution', 'warning')
    addLine('='.repeat(72), 'divider')
    setStatus('warning')
  }, [config.stageNum, config.title, addLine, isLocked])

  const badge = statusBadge[status]

  return (
    <div className={`rounded-xl border bg-white shadow-sm dark:bg-gray-950 ${
      isLocked
        ? 'border-gray-200 opacity-60 dark:border-gray-800'
        : 'border-gray-200 dark:border-gray-800'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl dark:bg-gray-900">
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                Stage {config.stageNum}: {config.title}
              </h3>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{config.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {config.hasDryRun && (
            <button
              onClick={simulateRun}
              disabled={status === 'running' || isLocked}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              🔍 Dry Run
            </button>
          )}
          <button
            onClick={simulateRun}
            disabled={status === 'running' || isLocked}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${
              status === 'running'
                ? 'bg-gray-400 dark:bg-gray-600'
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
            }`}
          >
            {status === 'running' ? '⏳ Running...' : isLocked ? '🔒 Locked' : '▶ Run'}
          </button>
          <button
            onClick={() => setShowConsole(!showConsole)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900"
          >
            {showConsole ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Gate checks (if previous stage has them) */}
      {config.gateChecks && config.gateChecks.length > 0 && (
        <div className="border-b border-gray-100 px-6 py-3 dark:border-gray-900">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Gate Checks
          </p>
          <div className="flex flex-wrap gap-2">
            {config.gateChecks.map((check, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                  check.passed
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}
                title={check.detail}
              >
                {check.passed ? '✓' : '✗'} {check.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Console output */}
      {showConsole && (
        <div className="px-6 py-4">
          <SyncConsole lines={consoleLines} isRunning={status === 'running'} />
        </div>
      )}
    </div>
  )
}

