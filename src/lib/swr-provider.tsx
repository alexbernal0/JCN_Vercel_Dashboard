"use client";

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

// Default fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url);
  
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  
  return res.json();
};

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // Keep data fresh but show cached data instantly
        revalidateOnFocus: false, // Don't refetch when window regains focus
        revalidateOnReconnect: false, // Don't refetch when reconnecting
        dedupingInterval: 60000, // Dedupe requests within 60 seconds
        focusThrottleInterval: 300000, // Throttle focus revalidation to 5 minutes
        // Cache data for 24 hours to match server-side cache
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        // Show cached data immediately, revalidate in background
        suspense: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
