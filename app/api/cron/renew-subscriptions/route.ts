import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { renewSubscriptions } from '@/lib/microsoft'

// This endpoint should be called by a cron job every 24 hours
export async function POST() {
  try {
    // Get all Microsoft connections
    const { data: connections, error: connectionsError } = await supabase
      .from('connections')
      .select('*, user:users(*)')
      .eq('provider', 'microsoft')

    if (connectionsError) {
      throw connectionsError
    }

    console.log(`Found ${connections.length} Microsoft connections to process`)

    // Process each connection
    const results = await Promise.all(
      connections.map(async (connection) => {
        try {
          await renewSubscriptions(connection.user_id, connection.access_token)
          return {
            userId: connection.user_id,
            email: connection.user.email,
            status: 'success'
          }
        } catch (error) {
          console.error(`Error renewing subscriptions for user ${connection.user_id}:`, error)
          return {
            userId: connection.user_id,
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