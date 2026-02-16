'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
  { 
    name: 'Portfolios', 
    icon: '📊',
    children: [
      { name: 'Persistent Value', href: '/persistent-value', icon: '📊' },
      { name: 'Olivia Growth', href: '/olivia-growth', icon: '🌱' },
      { name: 'Pure Alpha', href: '/pure-alpha', icon: '⚡' },
    ]
  },
  {
    name: 'Analysis Tools',
    icon: '📈',
    children: [
      { name: 'Stock Analysis', href: '/stock-analysis', icon: '📈' },
      { name: 'Market Analysis', href: '/market-analysis', icon: '🌍' },
      { name: 'Risk Management', href: '/risk-management', icon: '🛡️' },
    ]
  },
  { name: 'About', href: '/about', icon: 'ℹ️' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [expandedSections, setExpandedSections] = useState<string[]>(['Portfolios', 'Analysis Tools'])

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const toggleSection = (name: string) => {
    setExpandedSections(prev =>
      prev.includes(name)
        ? prev.filter(s => s !== name)
        : [...prev, name]
    )
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* Logo/Title */}
      <div className="border-b border-gray-200 p-6 dark:border-gray-800">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">
          JCN Financial
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Investment Dashboard
        </p>
      </div>

      {/* Navigation */}
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
                      {expandedSections.includes(item.name) ? '▼' : '▶'}
                    </span>
                  </button>
                  {expandedSections.includes(item.name) && (
                    <ul className="ml-4 mt-2 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.name}>
                          <Link
                            href={child.href}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                              pathname === child.href
                                ? 'bg-blue-100 font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900'
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
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
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
          <span>{theme === 'light' ? '🌙' : '☀️'}</span>
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
      </div>
    </div>
  )
}
