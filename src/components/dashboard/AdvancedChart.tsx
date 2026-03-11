"use client"

import { useEffect, useRef } from "react"

interface AdvancedChartProps {
  symbol: string
}

const SCRIPT_URL =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"

export default function AdvancedChart({ symbol }: AdvancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear any previous widget (React strict-mode double-mount)
    container.innerHTML = ""

    const wrapper = document.createElement("div")
    wrapper.className = "tradingview-widget-container"
    wrapper.style.width = "100%"
    wrapper.style.height = "100%"

    const widgetDiv = document.createElement("div")
    widgetDiv.className = "tradingview-widget-container__widget"
    widgetDiv.style.width = "100%"
    widgetDiv.style.height = "100%"
    wrapper.appendChild(widgetDiv)

    const script = document.createElement("script")
    script.type = "text/javascript"
    script.src = SCRIPT_URL
    script.async = true
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: "D",
      timezone: "America/New_York",
      theme: "light",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_volume: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    })
    wrapper.appendChild(script)

    container.appendChild(wrapper)

    return () => {
      container.innerHTML = ""
    }
  }, [symbol])

  return <div ref={containerRef} className="h-full w-full" />
}
