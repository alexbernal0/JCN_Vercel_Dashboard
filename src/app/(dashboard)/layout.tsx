"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/Sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      {/* Sidebar handles its own mobile/desktop rendering internally */}
      <Sidebar isMobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Content column: mobile header bar + main */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Mobile header — only visible below md breakpoint */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden dark:border-gray-800 dark:bg-gray-950">
          <button
            onClick={() => setMobileOpen(true)}
            className="-ml-2 p-2 text-gray-700 dark:text-gray-300"
            aria-label="Open navigation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            JCN Financial
          </span>
          <div className="w-8" /> {/* spacer to keep title centered */}
        </div>

        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  )
}
