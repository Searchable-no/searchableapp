import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res: response })

  // Refresh session if expired
  await supabase.auth.getSession()

  // Get the current path
  const path = request.nextUrl.pathname

  // Get the session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // List of paths that don't require authentication
  const publicPaths = ['/login', '/auth/callback', '/api/reindex', '/icon-192x192.png', '/icon-512x512.png', '/manifest.json']

  // Check if the path is public
  const isPublicPath = publicPaths.some(publicPath => path.startsWith(publicPath))

  // If the user is not signed in and the path is not public, redirect to login
  if (!session && !isPublicPath) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', path)
    return NextResponse.redirect(redirectUrl)
  }

  // If the user is signed in and trying to access login, redirect to search
  if (session && path === '/login') {
    return NextResponse.redirect(new URL('/search', request.url))
  }

  // Set cache control headers for dashboard
  if (path === '/dashboard') {
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
} 