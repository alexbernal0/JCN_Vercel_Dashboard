'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class PortfolioTrendsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PortfolioTrends]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Portfolio Trends</h3>
          <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Trends charts are temporarily unavailable.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
