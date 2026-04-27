import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RFP Studio',
  description: 'Internal RFP Response Platform — OCIO Financial Services',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
