import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { renewSubscriptions } from '@/lib/microsoft'

// This endpoint should be called by a cron job every 24 hours
export async function POST() {
  try {
    // Get all Microsoft connections
    const connections = await prisma.connection.findMany({
      where: {
        provider: 'microsoft'
      },
      include: {
        user: true
      }
    })

    console.log(`Found ${connections.length} Microsoft connections to process`)

    // Process each connection
    const results = await Promise.all(
      connections.map(async (connection) => {
        try {
          await renewSubscriptions(connection.userId, connection.accessToken)
          return {
            userId: connection.userId,
            email: connection.user.email,
            status: 'success'
          }
        } catch (error) {
          console.error(`Error renewing subscriptions for user ${connection.userId}:`, error)
          return {
            userId: connection.userId,
            email: connection.user.email,
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    })
  } catch (error) {
    console.error('Error in subscription renewal job:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 