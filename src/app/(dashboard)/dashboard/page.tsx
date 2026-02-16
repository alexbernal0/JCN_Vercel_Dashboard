export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50">
            JCN Financial Dashboard
          </h1>
          <p className="mt-2 text-xl text-gray-600 dark:text-gray-400">
            Investment Portfolio Tracking & Analysis
          </p>
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-800" />

        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="mb-4 text-3xl font-semibold text-gray-900 dark:text-gray-50">
            Welcome to Your Investment Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Select a portfolio or analysis tool from the sidebar to get started.
          </p>
        </div>

        {/* Available Portfolios */}
        <div className="mb-12">
          <h3 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Available Portfolios:
          </h3>
          <ul className="space-y-3">
            <li className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold">📊 Persistent Value</span> - Value-focused investment strategy with long-term growth potential
            </li>
            <li className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold">🌱 Olivia Growth</span> - Growth-focused investment strategy
            </li>
            <li className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold">⚡ Pure Alpha</span> - Alpha-generating investment strategy
            </li>
          </ul>
        </div>

        {/* Analysis Tools */}
        <div className="mb-12">
          <h3 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Analysis Tools:
          </h3>
          <ul className="space-y-3">
            <li className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold">📈 Stock Analysis</span> - Individual stock research and analysis
            </li>
            <li className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold">🌍 Market Analysis</span> - Broad market trends and sector analysis
            </li>
            <li className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold">🛡️ Risk Management</span> - Portfolio risk assessment and management
            </li>
          </ul>
        </div>

        {/* About */}
        <div className="mb-12">
          <h3 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            About:
          </h3>
          <ul className="space-y-3">
            <li className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold">ℹ️ About</span> - Learn more about JCN Financial services
            </li>
          </ul>
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-800" />

        {/* Feature Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-blue-50 p-6 dark:bg-blue-950">
            <h4 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
              Real-time Data
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              All portfolio data is updated in real-time using market feeds
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 p-6 dark:bg-blue-950">
            <h4 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
              Comprehensive Analysis
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Detailed performance metrics and risk assessments
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 p-6 dark:bg-blue-950">
            <h4 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
              Multi-Portfolio
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Track multiple investment strategies simultaneously
            </p>
          </div>
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-800" />

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          JCN Financial & Tax Advisory Group, LLC - Built with Next.js
        </p>
      </div>
    </div>
  )
}
