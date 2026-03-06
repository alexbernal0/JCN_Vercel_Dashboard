export interface Stage0CheckResult {
  status: 'PASS' | 'WARN' | 'FAIL'
  message: string
  latency_ms?: number
  detail?: Record<string, unknown>
}

export interface Stage0Response {
  stage: 0
  overall_status: 'PASS' | 'WARN' | 'FAIL'
  timestamp_utc: string
  checks: Record<string, Stage0CheckResult>
  can_proceed: boolean
  blocking_issues: string[]
  self_heal_actions: string[]
  cached: boolean
  execution_ms: number | null
}
