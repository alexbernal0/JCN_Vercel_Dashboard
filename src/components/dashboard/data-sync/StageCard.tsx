'use client'

import { useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { SyncConsole, type ConsoleLine } from './SyncConsole'
import type { Stage0Response } from '../../../types/stage0'

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
  apiEndpoint?: string
}

export interface StageCardHandle {
  run: () => Promise<StageStatus>
  getStatus: () => StageStatus
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

function formatStage0Response(data: Stage0Response, addLine: (text: string, type: ConsoleLine['type']) => void) {
  // Show cache indicator
  if (data.cached) {
    addLine('📋 Results from cache (< 5 min old)', 'info')
    addLine('', 'info')
  }

  const checks = data.checks
  if (!checks) {
    addLine('No check data returned', 'error')
    return
  }

  for (const [name, check] of Object.entries(checks)) {
    const status = check.status as string
    const message = check.message as string
    const latency = check.latency_ms as number | undefined
    const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌'
    const lineType: ConsoleLine['type'] = status === 'PASS' ? 'success' : status === 'WARN' ? 'warning' : 'error'
    const latStr = latency ? ` (${latency}ms)` : ''
    addLine(`${icon} [${name.toUpperCase()}] ${message}${latStr}`, lineType)

    // Show detail for important checks
    const detail = check.detail as Record<string, unknown> | null
    if (detail) {
      if (name === 'schemas_and_tables' && detail.row_counts) {
        const counts = detail.row_counts as Record<string, number>
        for (const [table, count] of Object.entries(counts)) {
          const short = table.split('.').pop() || table
          const display = typeof count === 'number' ? Number(count).toLocaleString() + ' rows' : String(count)
          addLine(`   ${short}: ${display}`, 'info')
        }
      }
      if (name === 'fundamentals_coverage') {
        const eod = (detail.eod_symbols as number)?.toLocaleString() || 'N/A'
        const obq = (detail.obq_scores_symbols as number)?.toLocaleString() || 'N/A'
        const mom = (detail.momentum_scores_symbols as number)?.toLocaleString() || 'N/A'
        addLine(`   EOD symbols: ${eod}  |  OBQ scores: ${obq}  |  Momentum: ${mom}`, 'info')
      }
      if (name === 'symbol_format' && detail.violations) {
        const violations = detail.violations as Record<string, string>
        for (const [table, desc] of Object.entries(violations)) {
          const short = table.split('.').pop() || table
          addLine(`   ${short}: ${desc}`, 'warning')
        }
      }
      if (name === 'data_gap') {
        addLine(`   Latest: ${detail.latest_eod_date}  |  Today: ${detail.today}  |  Gap: ${detail.gap_days} day(s)`, 'info')
      }
      if (name === 'duplicate_detection' && detail.scan_window) {
        addLine(`   Scan window: ${detail.scan_window}`, 'info')
      }
      if (name === 'symbol_format' && detail.sample_window) {
        addLine(`   Sample window: ${detail.sample_window}`, 'info')
      }
    }
  }

  // Summary
  addLine('', 'info')
  addLine('='.repeat(72), 'divider')
  const overall = data.overall_status
  const canProceed = data.can_proceed
  const overallType: ConsoleLine['type'] = overall === 'PASS' ? 'success' : overall === 'WARN' ? 'warning' : 'error'
  const execMs = data.execution_ms ? ` (${data.execution_ms}ms)` : ''
  addLine(`OVERALL: ${overall}  |  Can Proceed: ${canProceed ? "YES" : "NO"}${execMs}`, overallType)

  const blocking = data.blocking_issues
  if (blocking && blocking.length > 0) {
    addLine('', 'info')
    addLine('BLOCKING ISSUES:', 'error')
    blocking.forEach(issue => addLine(`  • ${issue}`, 'error'))
  }

  const heals = data.self_heal_actions
  if (heals && heals.length > 0) {
    addLine('', 'info')
    addLine('SELF-HEAL ACTIONS:', 'warning')
    heals.forEach(action => addLine(`  → ${action}`, 'warning'))
  }
  addLine('='.repeat(72), 'divider')
}

const stageMessages: Record<number, string[]> = {
  1: [
    'Querying DEV_EOD_survivorship...',
    'Querying DEV_EOD_Fundamentals...',
    'Calculating sync requirements...',
    'Running data quality cross-checks...',
  ],
  2: [
    'Checking EODHD rate limits...',
    'Calculating incremental date range...',
    'Downloading survivorship batch 1/N...',
    'Validating batch...',
  ],
  3: [
    'Section A: Table inventory...',
    'Section B: Survivorship integrity...',
    'Section C: Cross-table consistency...',
    'Section D: Final scoring...',
  ],
}

export const StageCard = forwardRef<StageCardHandle, StageCardProps>(function StageCard({ config }, ref) {
  const [status, setStatus] = useState<StageStatus>('idle')
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [showConsole, setShowConsole] = useState(false)
  const isLocked = config.stageNum > 0 && config.previousGatePassed === false

  const addLine = useCallback((text: string, type: ConsoleLine['type'] = 'info') => {
    const now = new Date().toLocaleTimeString('en-US', { hour12: false })
    setConsoleLines(prev => [...prev, { text, type, timestamp: now }])
  }, [])

  const runStage = useCallback(async (): Promise<StageStatus> => {
    if (isLocked) return 'idle'
    setStatus('running')
    setShowConsole(true)
    setConsoleLines([])
    let finalStatus: StageStatus = 'idle'

    addLine('='.repeat(72), 'divider')
    addLine(`STAGE ${config.stageNum}: ${config.title.toUpperCase()}`, 'header')
    addLine('='.repeat(72), 'divider')
    addLine('', 'info')

    // If this stage has a real API endpoint, call it
    if (config.apiEndpoint) {
      try {
        addLine('Connecting to backend...', 'info')
        const resp = await fetch(config.apiEndpoint)
        if (!resp.ok) {
          addLine(`API Error: HTTP ${resp.status} ${resp.statusText}`, 'error')
          finalStatus = 'error'
          setStatus(finalStatus)
          return finalStatus
        }
        const data = await resp.json()
        addLine('', 'info')

        // Format response based on stage
        if (config.stageNum === 0) {
          formatStage0Response(data, addLine)
        }

        // Set status based on response
  const overall = data.overall_status
        if (overall === 'FAIL') {
          finalStatus = 'error'
        } else if (overall === 'WARN') {
          finalStatus = 'warning'
        } else {
          finalStatus = 'success'
        }
        setStatus(finalStatus)
      } catch (err) {
        addLine(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
        addLine('Check browser console for details', 'error')
        finalStatus = 'error'
        setStatus(finalStatus)
      }
    } else {
      // Simulated placeholder output for stages without backend
      const messages = stageMessages[config.stageNum] || ['Running stage...']
      for (const msg of messages) {
        await new Promise(r => setTimeout(r, 300 + Math.random() * 200))
        addLine(msg)
      }
      addLine('', 'info')
      addLine('='.repeat(72), 'divider')
      addLine(`⏳ Stage ${config.stageNum} is a placeholder — backend not yet connected`, 'warning')
      addLine('Connect the FastAPI endpoint to enable live execution', 'warning')
      addLine('='.repeat(72), 'divider')
      finalStatus = 'warning'
      setStatus(finalStatus)
    }

    return finalStatus
  }, [config.stageNum, config.title, config.apiEndpoint, addLine, isLocked])

  useImperativeHandle(ref, () => ({
    run: runStage,
    getStatus: () => status,
  }), [runStage, status])

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
              onClick={runStage}
              disabled={status === 'running' || isLocked}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              🔍 Dry Run
            </button>
          )}
          <button
            onClick={runStage}
            disabled={status === 'running' || isLocked}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${
              status === 'running'
                ? 'bg-gray-400 dark:bg-gray-600'
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
            }`}>
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

      {/* Gate checks */}
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
})
