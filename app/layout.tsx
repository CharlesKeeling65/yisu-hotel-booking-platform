import '../styles/globals.css'

export const metadata = {
  title: '易宿 - Hotel Booking',
  description: '易宿酒店预订平台 (MVP scaffold)'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="min-h-screen bg-gray-50 text-gray-900">{children}</main>
      </body>
    </html>
  )
}
