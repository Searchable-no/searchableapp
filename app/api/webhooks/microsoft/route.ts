import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { indexMicrosoftContent } from '@/lib/microsoft'

// Handle subscription validation
export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

// Handle change notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received webhook notification:', JSON.stringify(body, null, 2))

    // Process each notification in the batch
    for (const notification of body.value) {
      const { clientState, resource, changeType } = notification
      
      // Find the user based on clientState (which we'll set to userId when creating subscription)
      const user = await prisma.user.findUnique({
        where: { id: clientState },
        include: {
          connections: {
            where: { provider: 'microsoft' }
          }
        }
      })

      if (!user || !user.connections.length) {
        console.error(`No user or Microsoft connection found for clientState: ${clientState}`)
        continue
      }

      // Reindex content for the user
      await indexMicrosoftContent(user.id)
      console.log(`Reindexed content for user ${user.id} after ${changeType} change to ${resource}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
} 