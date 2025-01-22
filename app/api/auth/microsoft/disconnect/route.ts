import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const userEmail = 'Arne@searchable.no' // This should be replaced with actual auth later

    console.log('Disconnecting Microsoft for user:', userEmail)

    // Find the user
    const user = await prisma.user.findFirst({
      where: {
        email: {
          mode: 'insensitive',
          equals: userEmail
        }
      }
    })

    if (!user) {
      console.log('User not found:', userEmail)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    console.log('Found user:', user.id)

    // Delete the connection
    const deletedConnection = await prisma.connection.deleteMany({
      where: {
        userId: user.id,
        provider: 'microsoft'
      }
    })

    console.log('Deleted connection:', deletedConnection)

    return NextResponse.json({ 
      success: true,
      deletedConnection: deletedConnection.count
    })
  } catch (error) {
    console.error('Error disconnecting Microsoft:', error)
    return NextResponse.json(
      { 
        error: 'Failed to disconnect from Microsoft',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 