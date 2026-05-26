import type { Metadata, Viewport } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' })
const fontDisplay = Outfit({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'IMPÉRIO PASTÉIS — Sistema de Comandas',
  description: 'Sistema digital de comandas para o Império Pastéis — controle de mesas, pedidos, produção e caixa.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Império Pastéis',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f97316',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${fontSans.variable} ${fontDisplay.variable} font-sans antialiased bg-surface-bg text-text-main selection:bg-brand-accent selection:text-white`}>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
            style: { fontSize: '15px' },
          }}
        />
      </body>
    </html>
  )
}
