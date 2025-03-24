import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        description,
        workspace_id,
        sharepoint_site_id,
        team_id,
        created_at,
        updated_at,
        created_by,
        project_members!inner (
          role
        )
      `)
      .eq('project_members.user_id', session.user.id)

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Error in GET /api/projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, workspace_id, sharepoint_site_id, team_id, columns = [] } = body

    if (!name || !description || !workspace_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Start a transaction
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        workspace_id,
        sharepoint_site_id,
        team_id,
        created_by: session.user.id
      })
      .select('id')
      .single()

    if (projectError) {
      console.error('Error creating project:', projectError)
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }

    // Add the creator as an owner
    const { error: memberError } = await supabase
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: session.user.id,
        role: 'owner'
      })

    if (memberError) {
      console.error('Error adding project owner:', memberError)
      return NextResponse.json({ error: 'Failed to add project owner' }, { status: 500 })
    }

    // Add columns if provided
    if (columns.length > 0) {
      const columnsWithProjectId = columns.map((column: any, index: number) => ({
        ...column,
        project_id: project.id,
        order: index
      }))

      const { error: columnsError } = await supabase
        .from('project_columns')
        .insert(columnsWithProjectId)

      if (columnsError) {
        console.error('Error adding project columns:', columnsError)
        return NextResponse.json({ error: 'Project created but failed to add columns' }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      project_id: project.id 
    })
  } catch (error) {
    console.error('Error in POST /api/projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 