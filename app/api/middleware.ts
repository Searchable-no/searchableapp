import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res: response })

  // Get the session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If no session, return unauthorized
  if (!session) {
    return new NextResponse(
      JSON.stringify({
        error: 'Unauthorized',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }

  return response
}

export const config = {
  matcher: [
    '/api/search/:path*',
    '/api/connections/:path*',
  ],
} 