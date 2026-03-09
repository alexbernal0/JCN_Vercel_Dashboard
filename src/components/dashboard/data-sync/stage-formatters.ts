import type { ConsoleLine } from './SyncConsole'

type AddLine = (text: string, type: ConsoleLine['type']) => void

export function formatStage1Response(data: any, addLine: AddLine) {
  // PRE-FLIGHT
  addLine('── PRE-FLIGHT CHECKS ' + '─'.repeat(53), 'header')
  const pf = data.preflight || {}
  for (const [key, check] of Object.entries(pf)) {
    const c = check as { status?: string; message?: string; latency_ms?: number }
    const icon = c.status === 'PASS' ? '✅' : c.status === 'WARN' ? '⚠️' : '❌'
    const lt = c.latency_ms ? ` (${c.latency_ms}ms)` : ''
    addLine(`  ${icon} [${key.toUpperCase()}] ${c.message || ''}${lt}`, c.status === 'PASS' ? 'success' : c.status === 'WARN' ? 'warning' : 'error')
  }
  addLine('', 'info')

  // SYNC WINDOW
  addLine('── SYNC WINDOW CALCULATION ' + '─'.repeat(48), 'header')
  const sw = data.sync_window || {}
  if (sw.message) addLine(`  ${sw.message}`, sw.status === 'PASS' ? 'info' : 'warning')
  if (sw.last_date) addLine(`  Last sync date: ${sw.last_date}`, 'info')
  if (sw.today) addLine(`  Today: ${sw.today}`, 'info')
  const tradingDays = sw.trading_days || []
  addLine(`  Trading days to sync: ${tradingDays.length}`, 'info')
  addLine('', 'info')

  // BATCHES
  const batches = data.batches || []
  if (batches.length > 0) {
    addLine('── BATCH DOWNLOAD ' + '─'.repeat(56), 'header')
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i]
      addLine(`  ▶ Batch ${i + 1}/${batches.length}: ${b.date}`, 'info')
      if (b.skipped_existing) {
        addLine(`    ⏩ ${b.message || 'Skipped (already exists)'}`, 'info')
      } else if (b.error) {
        addLine(`    ❌ ${b.error}`, 'error')
      } else {
        addLine(`    Downloaded: ${(b.rows_downloaded || 0).toLocaleString()} rows`, 'success')
        addLine(`    Stocks: ${(b.stocks_inserted || 0).toLocaleString()} | ETFs: ${(b.etfs_inserted || 0).toLocaleString()}`, 'success')
        const v = b.validation || {}
        const issues: string[] = []
        if (v.nulls_blocked > 0) issues.push(`${v.nulls_blocked} null-blocked`)
        if (v.price_lte_0 > 0) issues.push(`${v.price_lte_0} price<=0`)
        if (v.exchange_filtered > 0) issues.push(`${v.exchange_filtered} MF/OTC filtered`)
        if (issues.length > 0) {
          addLine(`    Validation: ${issues.join(' | ')}`, 'warning')
        } else {
          addLine('    Validation: ✅ clean', 'success')
        }
      }
    }
    addLine('', 'info')
  }

  // SUMMARY
  addLine('═'.repeat(72), 'divider')
  addLine('STAGE 1 SUMMARY', 'header')
  const s = data.summary || {}
  if (s.message) {
    addLine(`  ${s.message}`, 'info')
  } else {
    addLine(`  Trading days synced: ${s.trading_days_synced || 0}`, 'info')
    addLine(`  Total downloaded: ${(s.total_downloaded || 0).toLocaleString()} rows`, 'info')
    addLine(`  Stocks inserted: ${(s.total_stocks_inserted || 0).toLocaleString()} | ETFs: ${(s.total_etfs_inserted || 0).toLocaleString()}`, 'success')
    if (s.stocks_before !== undefined) {
      addLine(`  DEV survivorship: ${(s.stocks_before || 0).toLocaleString()} -> ${(s.stocks_after || 0).toLocaleString()}`, 'info')
    }
    if (s.etfs_before !== undefined) {
      addLine(`  DEV ETFs: ${(s.etfs_before || 0).toLocaleString()} -> ${(s.etfs_after || 0).toLocaleString()}`, 'info')
    }
  }
  addLine(`  Gate: ${s.gate_passed ? '✅ READY FOR STAGE 2' : '❌ ISSUES DETECTED'}`, s.gate_passed ? 'success' : 'error')
  if (data.execution_ms) addLine(`  Duration: ${data.execution_ms}ms`, 'info')
  addLine('═'.repeat(72), 'divider')
}

export function formatStage2Response(data: any, addLine: AddLine) {
  // PHASE 1: DQ AUDIT
  addLine('── PHASE 1: DATA QUALITY AUDIT (DEV) ' + '─'.repeat(37), 'header')
  const dq = data.dq_audit || {}
  const dqChecks = dq.checks || []
  for (const c of dqChecks) {
    const icon = c.passed ? '✅' : '❌'
    addLine(`  ${icon} ${c.name}`, c.passed ? 'success' : 'error')
    if (c.detail) addLine(`    ${c.detail}`, 'info')
  }
  addLine(`  DQ Score: ${dq.passed || 0}/${dq.total || 0} PASS`, dq.all_pass ? 'success' : 'error')
  addLine('', 'info')

  // PHASE 2: PROMOTION
  const promos = data.promotions || []
  if (promos.length > 0) {
    addLine('── PHASE 2: DEV → PROD PROMOTION ' + '─'.repeat(40), 'header')
    for (const pr of promos) {
      if (pr.status === 'FAIL') {
        addLine(`  ❌ ${pr.table}: ${pr.error || 'Failed'}`, 'error')
      } else {
        addLine(`  ▶ ${pr.table}`, 'info')
        addLine(`    Before: ${(pr.before || 0).toLocaleString()} rows -> After: ${(pr.after || 0).toLocaleString()} rows (+${(pr.inserted || 0).toLocaleString()})`, 'success')
      }
    }
    addLine('', 'info')
  }

  // PHASE 3: WEEKLY OHLC
  const weekly = data.weekly_ohlc || {}
  if (weekly.status) {
    addLine('── PHASE 3: WEEKLY OHLC REBUILD ' + '─'.repeat(42), 'header')
    if (weekly.status === 'PASS') {
      addLine(`  ✅ Weekly OHLC: ${(weekly.before || 0).toLocaleString()} -> ${(weekly.after || 0).toLocaleString()} rows (+${(weekly.inserted || 0).toLocaleString()})`, 'success')
    } else {
      addLine(`  ❌ Weekly OHLC: ${weekly.error || 'Failed'}`, 'error')
    }
    addLine('', 'info')
  }

  // PHASE 4: POST-VALIDATION
  const pv = data.post_validation || {}
  const pvChecks = pv.checks || []
  if (pvChecks.length > 0) {
    addLine('── PHASE 4: POST-PROMOTION VALIDATION ' + '─'.repeat(36), 'header')
    for (const c of pvChecks) {
      const icon = c.passed ? '✅' : '❌'
      addLine(`  ${icon} ${c.name}`, c.passed ? 'success' : 'error')
      if (c.detail) addLine(`    ${c.detail}`, 'info')
    }
    addLine('', 'info')
  }

  if (data.sync_log) addLine('  ✅ SYNC_LOG entry written', 'success')

  // SUMMARY
  addLine('═'.repeat(72), 'divider')
  addLine('STAGE 2 SUMMARY', 'header')
  addLine(`  DQ Audit: ${dq.passed || 0}/${dq.total || 0} PASS`, dq.all_pass ? 'success' : 'error')
  addLine(`  Promoted: ${promos.filter((pp: { status?: string }) => pp.status === 'PASS').length} tables`, 'success')
  if (weekly.status === 'PASS') addLine(`  Weekly OHLC: refreshed (+${(weekly.inserted || 0).toLocaleString()} rows)`, 'success')
  addLine(`  Post-validation: ${pv.passed || 0}/${pv.total || 0} PASS`, pv.all_pass ? 'success' : 'warning')
  addLine(`  Gate: ${data.can_proceed ? '✅ READY FOR STAGE 3' : '❌ ISSUES DETECTED'}`, data.can_proceed ? 'success' : 'error')
  if (data.execution_ms) addLine(`  Duration: ${data.execution_ms}ms`, 'info')
  addLine('═'.repeat(72), 'divider')
}

export function formatStage3Response(data: any, addLine: AddLine) {
  const renderChecks = (checks: { name: string; passed: boolean; detail?: string; action_taken?: string }[], label: string) => {
    const passCount = checks.filter(c => c.passed).length
    for (const c of checks) {
      const icon = c.passed ? '✅' : '⚠️'
      addLine(`  ${icon} ${c.name}`, c.passed ? 'success' : 'warning')
      if (c.detail) addLine(`    ${c.detail}`, 'info')
      if (c.action_taken) addLine(`    -> Action: ${c.action_taken}`, 'warning')
    }
    addLine(`  ${label}: ${passCount}/${checks.length} PASS`, passCount === checks.length ? 'success' : 'warning')
    addLine('', 'info')
  }

  addLine('── CROSS-TABLE CONSISTENCY ' + '─'.repeat(48), 'header')
  renderChecks(data.cross_table || [], 'Cross-table')

  addLine('── PROD INTEGRITY CERTIFICATION ' + '─'.repeat(42), 'header')
  renderChecks(data.integrity || [], 'Integrity')

  addLine('── SELF-HEALING SCAN ' + '─'.repeat(53), 'header')
  const sh = data.self_healing || []
  const shPass = sh.filter((c: { passed: boolean }) => c.passed).length
  for (const c of sh) {
    const icon = c.passed ? '✅' : '⚠️'
    addLine(`  ${icon} ${c.name}`, c.passed ? 'success' : 'warning')
    if (c.detail) addLine(`    ${c.detail}`, 'info')
    if (c.action_taken) addLine(`    -> Action: ${c.action_taken}`, 'warning')
  }
  addLine(`  Self-heal: ${shPass}/${sh.length} PASS`, shPass === sh.length ? 'success' : 'warning')
  addLine('', 'info')

  const recs = data.recommendations || []
  if (recs.length > 0) {
    addLine('── RECOMMENDATIONS ' + '─'.repeat(55), 'header')
    for (const r of recs) {
      addLine(`  • ${r}`, 'info')
    }
    addLine('', 'info')
  }

  addLine('═'.repeat(72), 'divider')
  addLine('PIPELINE COMPLETE', 'header')
  const ct = data.cross_table || []
  const ig = data.integrity || []
  const ctPass = ct.filter((c: { passed: boolean }) => c.passed).length
  const igPass = ig.filter((c: { passed: boolean }) => c.passed).length
  addLine(`  Cross-table: ${ctPass}/${ct.length} PASS`, ctPass === ct.length ? 'success' : 'warning')
  addLine(`  Integrity:   ${igPass}/${ig.length} PASS`, igPass === ig.length ? 'success' : 'warning')
  addLine(`  Self-heal:   ${shPass}/${sh.length} PASS`, shPass === sh.length ? 'success' : 'warning')
  const certified = data.overall_status === 'PASS'
  addLine(`  PROD status: ${certified ? '✅ CERTIFIED' : '⚠️ WARNINGS'}`, certified ? 'success' : 'warning')
  if (data.execution_ms) addLine(`  Duration: ${data.execution_ms}ms`, 'info')
  addLine('═'.repeat(72), 'divider')
}

