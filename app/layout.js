import './globals.css'
import { Providers } from './providers'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'Gymtain — Multi-Gym SaaS',
  description: 'Production-ready multi-tenant gym management platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}
