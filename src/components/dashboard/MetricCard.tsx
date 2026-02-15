interface MetricCardProps {
  title: string
  value: string
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function MetricCard({ title, value, trend = 'neutral', className = '' }: MetricCardProps) {
  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-900 dark:text-gray-50',
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
      <p className={`mt-2 text-3xl font-semibold ${trendColors[trend]}`}>{value}</p>
    </div>
  )
}
