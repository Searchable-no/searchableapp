'use client'

import { Button } from './ui/button'
import { signIn } from '@/lib/auth/microsoft'

export function SignInButton() {
  const handleSignIn = async () => {
    try {
      await signIn()
      window.location.reload()
    } catch (error) {
      console.error('Failed to sign in:', error)
    }
  }

  return (
    <Button
      onClick={handleSignIn}
      className="flex items-center gap-2"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 23 23"
        className="fill-current"
      >
        <path d="M11 11h12v12h-12v-12z" fill="#F25022" />
        <path d="M0 11h12v12h-12v-12z" fill="#00A4EF" />
        <path d="M11 0h12v12h-12v-12z" fill="#7FBA00" />
        <path d="M0 0h12v12h-12v-12z" fill="#FFB900" />
      </svg>
      Sign in with Microsoft
    </Button>
  )
} 