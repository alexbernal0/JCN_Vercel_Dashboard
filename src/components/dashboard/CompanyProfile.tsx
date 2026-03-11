"use client"

import { useEffect, useRef } from "react"

interface CompanyProfileProps {
  symbol: string
}

const SCRIPT_URL =
  "https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js"

export default function CompanyProfile({ symbol }: CompanyProfileProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear any previous widget (React strict-mode double-mount or symbol change)
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
      symbol: symbol,
      colorTheme: "light",
      isTransparent: false,
      width: "100%",
      height: "100%",
      locale: "en",
    })
    wrapper.appendChild(script)

    container.appendChild(wrapper)

    return () => {
      container.innerHTML = ""
    }
  }, [symbol])

  return <div ref={containerRef} className="h-full w-full" />
}
