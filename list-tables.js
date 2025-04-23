import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with connection details from the environment file
const supabaseUrl = 'https://hswomyklnknfhmnlivgj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd29teWtsbmtuZmhtbmxpdmdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODM1NzA0NCwiZXhwIjoyMDUzOTMzMDQ0f'

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

async function listTables() {
  try {
    // Query to get all tables from the information_schema
    const { data, error } = await supabase
      .rpc('get_tables')
      .select()

    if (error) {
      console.error('Error fetching tables:', error)
      return
    }

    console.log('Tables in the database:')
    console.log(data)
  } catch (error) {
    console.error('Error:', error)
  }
}

// Alternative approach using raw SQL if RPC method doesn't exist
async function listTablesWithSQL() {
  try {
    const { data, error } = await supabase
      .from('pg_tables')
      .select('schemaname, tablename')
      .eq('schemaname', 'public')

    if (error) {
      console.error('Error fetching tables with SQL:', error)
      return
    }

    console.log('Tables in the database (SQL method):')
    console.log(data)
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run both methods to ensure we get results
listTables().then(() => {
  listTablesWithSQL()
}) 