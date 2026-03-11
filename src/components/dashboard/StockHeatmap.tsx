"use client"

import { useEffect, useRef } from "react"

const HEATMAP_CONFIG = {
  dataSource: "SPX500",
  grouping: "sector",
  blockSize: "market_cap_basic",
  blockColor: "change",
  locale: "en",
  symbolUrl: "",
  colorTheme: "dark",
  hasTopBar: false,
  isDataSetEnabled: false,
  isZoomEnabled: true,
  hasSymbolTooltip: true,
  isMonoSize: false,
  isTransparent: true,
  width: "100%",
  height: "100%",
}

const SCRIPT_URL =
  "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"

export default function StockHeatmap() {
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
    script.textContent = JSON.stringify(HEATMAP_CONFIG)
    wrapper.appendChild(script)

    container.appendChild(wrapper)

    return () => {
      container.innerHTML = ""
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
