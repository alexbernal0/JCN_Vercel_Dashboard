'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import useSWR from 'swr';

// Pastel color palette from Streamlit design
const PASTEL_COLORS = [
  '#B8D4E3', '#D4E3B8', '#E3D4B8', '#E3B8D4',
  '#B8E3D4', '#D4B8E3', '#E3B8B8', '#B8E3B8',
  '#C8D8E8', '#E8D8C8', '#D8C8E8', '#C8E8D8',
  '#E8C8D8', '#D8E8C8', '#C8C8E8', '#E8E8C8',
  '#A8C8D8', '#D8C8A8', '#C8A8D8', '#A8D8C8'
];

interface AllocationData {
  name: string;
  ticker?: string;
  value: number;
}

interface PortfolioAllocationData {
  company: AllocationData[];
  category: AllocationData[];
  sector: AllocationData[];
  industry: AllocationData[];
  last_updated: string;
}

interface PortfolioAllocationProps {
  portfolio: Array<{
    symbol: string;
    cost_basis: number;
    shares: number;
  }>;
}

const allocationFetcher = async (url: string, portfolio: any[]) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolio })
  });
  if (!response.ok) throw new Error('Failed to fetch allocation data');
  return response.json();
};

// Stable key so SWR doesn't refetch on every parent re-render (portfolio array ref changes)
function allocationKey(portfolio: PortfolioAllocationProps['portfolio']) {
  if (!portfolio?.length) return null;
  const symbols = portfolio.map(p => p.symbol).sort().join(',');
  return ['/api/portfolio/allocation', symbols] as const;
}

export default function PortfolioAllocation({ portfolio }: PortfolioAllocationProps) {
  const key = allocationKey(portfolio);
  const { data, error, isLoading } = useSWR<PortfolioAllocationData>(
    key,
    key ? ([url]) => allocationFetcher(url, portfolio) : null,
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3600000, // 1 hour
    }
  );

  const createPieOption = (
    title: string,
    data: AllocationData[],
    showLabel: boolean = true
  ) => {
    return {
      title: {
        text: title,
        left: 'center',
        top: 10,
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#1f2937'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const name = params.data.ticker || params.data.name;
          const value = params.data.value;
          const percent = params.percent;
          return `<b>${name}</b><br/>${value.toFixed(2)}% (${percent.toFixed(1)}%)`;
        }
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '60%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: showLabel,
            position: 'inside',
            formatter: (params: any) => {
              // Show ticker for company chart, label for others
              if (params.data.ticker) {
                return params.data.ticker;
              }
              // Only show label if percentage > 5%
              return params.percent > 5 ? params.data.name : '';
            },
            fontSize: 10,
            color: '#000'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          labelLine: {
            show: false
          },
          data: data.map((item, index) => ({
            name: item.name,
            ticker: item.ticker,
            value: item.value,
            itemStyle: {
              color: PASTEL_COLORS[index % PASTEL_COLORS.length]
            }
          }))
        }
      ]
    };
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Portfolio Allocation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-gray-400">Loading chart {i}...</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Portfolio Allocation
        </h2>
        <div className="text-red-500">
          Failed to load allocation data. Please try refreshing.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="text-2xl">📊</span>
        Portfolio Allocation
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Allocation */}
        <div className="bg-gray-50 rounded-lg p-4">
          <ReactECharts
            option={createPieOption('Company Allocation', data.company, true)}
            style={{ height: '350px' }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        {/* Category Style Allocation */}
        <div className="bg-gray-50 rounded-lg p-4">
          <ReactECharts
            option={createPieOption('Category Style Allocation', data.category, true)}
            style={{ height: '350px' }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        {/* Sector Allocation */}
        <div className="bg-gray-50 rounded-lg p-4">
          <ReactECharts
            option={createPieOption('Sector Allocation', data.sector, true)}
            style={{ height: '350px' }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        {/* Industry Allocation */}
        <div className="bg-gray-50 rounded-lg p-4">
          <ReactECharts
            option={createPieOption('Industry Allocation', data.industry, false)}
            style={{ height: '350px' }}
            opts={{ renderer: 'svg' }}
          />
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500 text-center">
        Last updated: {new Date(data.last_updated).toLocaleString()}
      </div>
    </div>
  );
}
