import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'
import PWAInstall from '@/components/PWAInstall'
import LiveSyncProvider from '@/components/providers/LiveSyncProvider'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: 'FreshLink Vita Fresh — Distribution Fruits & Légumes',
  description: 'Gestion commerciale, logistique et suivi de distribution pour fruits et légumes au Maroc. Powered by Vita tech.',
  keywords: ['freshlink', 'vitafresh', 'distribution', 'fruits', 'légumes', 'gestion commerciale', 'logistique', 'maroc'],
  authors: [{ name: 'Vita tech' }],
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    title: 'FreshLink Vita Fresh',
    statusBarStyle: 'black-translucent',
    startupImage: [
      { url: '/icon-512.png' },
    ],
  },
  applicationName: 'FreshLink Vita Fresh',
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
    url: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1a4f2a' },
    { media: '(prefers-color-scheme: dark)',  color: '#0d2218' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${inter.variable} ${geistMono.variable}`}>
      <head>
        {/* PWA / Mobile */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FreshLink Pro" />

        {/* iOS home-screen icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Android / Chrome */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="shortcut icon" href="/icon-192.png" />

        {/* Microsoft */}
        <meta name="msapplication-TileColor" content="#1a4f2a" />
        <meta name="msapplication-TileImage" content="/icon-192.png" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <LiveSyncProvider>
          {children}
          <PWAInstall />
        </LiveSyncProvider>
      </body>
    </html>
  )
}
