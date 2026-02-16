import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { siteConfig } from "./siteConfig"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://jcn-tremor.vercel.app"),
  title: siteConfig.name,
  description: siteConfig.description,
  keywords: ["stock scanner", "financial dashboard", "portfolio tracker"],
  authors: [
    {
      name: "JCN Financial",
      url: "https://jcn-tremor.vercel.app",
    },
  ],
  creator: "JCN Financial",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased selection:bg-indigo-100 selection:text-indigo-700`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
