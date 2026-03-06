'use client'

import { useEffect, useRef } from 'react'

export interface ConsoleLine {
  text: string
  type: 'info' | 'success' | 'warning' | 'error' | 'header' | 'divider'
  timestamp?: string
}

interface SyncConsoleProps {
  lines: ConsoleLine[]
  isRunning: boolean
  maxHeight?: string
}

const typeStyles: Record<ConsoleLine['type'], string> = {
  info: 'text-gray-300',
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  header: 'text-cyan-400 font-bold',
  divider: 'text-gray-600',
}

export function SyncConsole({ lines, isRunning, maxHeight = '400px' }: SyncConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div
      className="overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 font-mono text-sm"
      style={{ maxHeight }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>
          <span className="ml-2 text-xs text-gray-500">OBQ Sync Terminal</span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-xs text-green-400">RUNNING</span>
          </div>
        )}
      </div>

      <div className="p-4 leading-relaxed">
        {lines.length === 0 ? (
          <div className="text-gray-600">
            <p>{'>'} Awaiting command...</p>
            <p className="mt-1 animate-pulse">{'>'} _</p>
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={`${typeStyles[line.type]} whitespace-pre-wrap`}>
              {line.timestamp && (
                <span className="mr-2 text-gray-600">[{line.timestamp}]</span>
              )}
              {line.text}
            </div>
          ))
        )}
        {isRunning && (
          <div className="mt-1 animate-pulse text-gray-500">{'>'} _</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
