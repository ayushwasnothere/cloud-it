import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'CloudIt',
  description: 'A production-ready cloud IDE platform',
  generator: 'v0.app',
  openGraph: {
    title: 'CloudIt - Cloud IDE',
    description: 'A production-ready cloud IDE platform with pure black Vercel-inspired UI.',
    url: 'https://cloudit-ide.com',
    siteName: 'CloudIt',
    images: [
      {
        url: '/preview.png',
        width: 1200,
        height: 630,
        alt: 'CloudIt Interface Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CloudIt - Cloud IDE',
    description: 'A production-ready cloud IDE platform with pure black Vercel-inspired UI.',
    creator: '@yourhandle',
    images: ['/preview.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico' }
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-app-bg text-app-text">
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
