"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: "🏠" },
  {
    name: "Portfolios",
    icon: "📊",
    children: [
      { name: "Persistent Value", href: "/persistent-value", icon: "📊" },
      { name: "Olivia Growth", href: "/olivia-growth", icon: "🌱" },
      { name: "Pure Alpha", href: "/pure-alpha", icon: "⚡" },
    ],
  },
  {
    name: "Analysis Tools",
    icon: "📈",
    children: [
      { name: "Stock Analysis", href: "/stock-analysis", icon: "📈" },
      { name: "Market Analysis", href: "/market-analysis", icon: "🌍" },
      { name: "Risk Management", href: "/risk-management", icon: "🛡️" },
      { name: "Screener", href: "/screener", icon: "🔍" },
      { name: "Watchlist", href: "/watchlist", icon: "⭐" },
      { name: "Wiki", href: "/wiki", icon: "📖" },
      { name: "Data Sync", href: "/data-sync", icon: "🔄" },
    ],
  },
  { name: "About", href: "/about", icon: "ℹ️" },
]

interface SidebarProps {
  isMobileOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isMobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "Portfolios",
    "Analysis Tools",
  ])
  const [collapsed, setCollapsed] = useState(false)

  // Load theme + collapsed state from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle("dark", savedTheme === "dark")
    }
    const savedCollapsed = localStorage.getItem("sidebar_collapsed")
    if (savedCollapsed === "true") setCollapsed(true)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    document.documentElement.classList.toggle("dark", newTheme === "dark")
  }

  const toggleSection = (name: string) => {
    setExpandedSections((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    )
  }

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("sidebar_collapsed", String(next))
      return next
    })
  }

  // Called when a nav link is clicked inside the mobile drawer
  const handleMobileNavClick = () => {
    onClose?.()
  }

  // ── Shared expanded nav + theme toggle (used by both mobile drawer and desktop expanded sidebar) ──
  // isMobile=true wires up onClose on each Link click
  const renderExpandedContent = (isMobile: boolean) => (
    <>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleSection(item.name)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
                  >
                    <span className="flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </span>
                    <span className="text-xs">
                      {expandedSections.includes(item.name) ? "▼" : "▶"}
                    </span>
                  </button>
                  {expandedSections.includes(item.name) && (
                    <ul className="ml-4 mt-2 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.name}>
                          <Link
                            href={child.href}
                            onClick={
                              isMobile ? handleMobileNavClick : undefined
                            }
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                              pathname === child.href
                                ? "bg-blue-100 font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
                            }`}
                          >
                            <span>{child.icon}</span>
                            <span>{child.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href!}
                  onClick={isMobile ? handleMobileNavClick : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    pathname === item.href
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Theme Toggle */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          <span>{theme === "light" ? "🌙" : "☀️"}</span>
          <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ── MOBILE DRAWER (fixed overlay, hidden on md+) ── */}
      <div className="md:hidden">
        {/* Semi-transparent backdrop */}
        <div
          className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
            isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Sliding drawer panel */}
        <div
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-gray-800 dark:bg-gray-950 ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Drawer header: logo + X close button */}
          <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
            <Link href="/" onClick={handleMobileNavClick} className="block">
              <h1 className="text-lg font-bold text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-50 dark:hover:text-blue-400">
                🏠 JCN Financial
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Investment Dashboard
              </p>
            </Link>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              title="Close menu"
              aria-label="Close navigation"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {renderExpandedContent(true)}
        </div>
      </div>

      {/* ── DESKTOP SIDEBAR (hidden on mobile, visible on md+) ── */}

      {/* Collapsed: icon-only thin bar */}
      {collapsed && (
        <div className="hidden h-screen w-12 flex-col border-r border-gray-200 bg-white transition-all duration-200 md:flex dark:border-gray-800 dark:bg-gray-950">
          {/* Expand toggle */}
          <div className="flex items-center justify-center border-b border-gray-200 py-4 dark:border-gray-800">
            <button
              onClick={toggleCollapse}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              title="Expand sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Icon-only nav */}
          <nav className="flex-1 overflow-y-auto py-3">
            <ul className="flex flex-col items-center gap-1">
              {navigation.map((item) => {
                if (item.children) {
                  return item.children.map((child) => (
                    <li key={child.name}>
                      <Link
                        href={child.href}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                          pathname === child.href
                            ? "bg-blue-100 dark:bg-blue-950"
                            : "hover:bg-gray-100 dark:hover:bg-gray-900"
                        }`}
                        title={child.name}
                      >
                        <span>{child.icon}</span>
                      </Link>
                    </li>
                  ))
                }
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href!}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                        pathname === item.href
                          ? "bg-blue-100 dark:bg-blue-950"
                          : "hover:bg-gray-100 dark:hover:bg-gray-900"
                      }`}
                      title={item.name}
                    >
                      <span>{item.icon}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Theme toggle (icon only) */}
          <div className="border-t border-gray-200 py-3 dark:border-gray-800">
            <div className="flex justify-center">
              <button
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-900"
                title={theme === "light" ? "Dark Mode" : "Light Mode"}
              >
                <span>{theme === "light" ? "🌙" : "☀️"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded: full w-64 sidebar */}
      {!collapsed && (
        <div className="hidden h-screen w-64 flex-col border-r border-gray-200 bg-white transition-all duration-200 md:flex dark:border-gray-800 dark:bg-gray-950">
          {/* Logo/Title + collapse toggle */}
          <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
            <Link href="/" className="block">
              <h1 className="text-lg font-bold text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-50 dark:hover:text-blue-400">
                🏠 JCN Financial
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Investment Dashboard
              </p>
            </Link>
            <button
              onClick={toggleCollapse}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              title="Collapse sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {renderExpandedContent(false)}
        </div>
      )}
    </>
  )
}
