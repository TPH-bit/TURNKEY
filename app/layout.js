import './globals.css'

export const metadata = {
  title: 'TURNKEY - Documents Sourcés',
  description: 'Génération de documents fiables avec sources vérifiées et citations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}