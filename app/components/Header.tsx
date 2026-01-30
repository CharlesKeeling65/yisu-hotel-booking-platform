"use client"
import React from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function Header() {
  const { data: session } = useSession()

  return (
    <header className="w-full bg-white border-b">
      <div className="max-w-4xl mx-auto flex items-center justify-between p-4">
        <Link href="/" className="font-bold text-lg">易宿</Link>
        <nav className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-700">首页</Link>
          {!session && (
            <Link href="/login" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">登录</Link>
          )}
          {session && (
            <>
              <Link href="/profile" className="text-sm text-gray-700">{session.user?.email}</Link>
              <button onClick={() => signOut({ callbackUrl: '/' })} className="px-3 py-1 bg-red-600 text-white rounded text-sm">登出</button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
