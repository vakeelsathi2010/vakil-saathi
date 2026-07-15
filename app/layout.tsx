import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import { cookies } from 'next/headers'
import { LanguageProvider } from '@/components/LanguageProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'VakilSaathi — Digital Practice Companion for Advocates',
  description: 'Free case management and court hearing reminder application for advocates.',
  other: { google: 'notranslate' },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const language = (await cookies()).get('vakil_language_v3')?.value === 'hi' ? 'hi' : 'en'
  return (
    <html lang={language} translate="no" className="h-full notranslate">
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
