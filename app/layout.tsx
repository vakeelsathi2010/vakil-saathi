import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import { LanguageProvider } from '@/components/LanguageProvider'
import { cookies } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'VakilSaathi — Advocate Ka Digital Saathi',
  description: 'Advocates ke liye free case management aur court reminder app.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const language = (await cookies()).get('vakil_language')?.value === 'hi' ? 'hi' : 'en'

  return (
    <html lang="hi" className="h-full">
      <body className="h-full antialiased bg-gray-50">
        <LanguageProvider initialLanguage={language}>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { background: '#1e3a5f', color: '#fff', borderRadius: '8px' },
            }}
          />
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
