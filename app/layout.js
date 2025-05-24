import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata = {
  title: 'AI-Суфлёр | Your Personal Public Speaking Coach',
  description: 'AI-powered public speaking coach that analyzes your presentations and provides constructive feedback',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <h1 className="text-3xl font-bold text-gray-900">AI-Суфлёр</h1>
              <p className="mt-1 text-sm text-gray-500">Your Personal Public Speaking Coach</p>
            </div>
          </header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
