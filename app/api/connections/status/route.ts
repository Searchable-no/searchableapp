import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Connection } from '.prisma/client'

export async function GET() {
  try {
    // Get the user's email from the sidebar (this should be replaced with proper auth)
    const userEmail = 'arne@searchable.no'

    // Get the user's connections from the database using case-insensitive search
    const user = await prisma.user.findFirst({
      where: {
        email: {
          mode: 'insensitive',
          equals: userEmail
        }
      },
      include: {
        connections: true
      }
    })

    console.log('User found:', user)

    if (!user) {
      console.log('No user found for email:', userEmail)
      return NextResponse.json({
        microsoft: false,
        google: false
      })
    }

    // Check for Microsoft and Google connections
    const microsoftConnection = user.connections.find((c: Connection) => c.provider === 'microsoft')
    const googleConnection = user.connections.find((c: Connection) => c.provider === 'google')

    console.log('Microsoft connection:', microsoftConnection)
    console.log('Google connection:', googleConnection)

    const response = {
      microsoft: !!microsoftConnection,
      google: !!googleConnection
    }
    console.log('Returning connection status:', response)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching connection status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connection status' },
      { status: 500 }
    )
  }
} 