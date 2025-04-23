import { createClient } from '@supabase/supabase-js'

// Initialiser Supabase-klient med admin-rettigheter
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function migrateToMultiTenant() {
  console.log('Starter migrering til multi-tenant arkitektur...')

  try {
    // 1. Hent alle brukere
    console.log('Henter alle brukere...')
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()
    
    if (userError) {
      throw userError
    }
    
    console.log(`Fant ${users.users.length} brukere`)
    
    // 2. Opprett standard organisasjon
    console.log('Oppretter standard organisasjon...')
    const { data: defaultOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Standard Organisasjon',
        slug: 'standard-org',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
      
    if (orgError) {
      throw orgError
    }
    
    console.log('Standard organisasjon opprettet:', defaultOrg.id)
    
    // 3. Legg til alle brukere i standard organisasjon
    console.log('Legger til brukere i organisasjonen...')
    
    const orgMembers = users.users.map(user => ({
      organization_id: defaultOrg.id,
      user_id: user.id,
      role: 'member',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
    
    // Batch inserts for å unngå store forespørsler
    const batchSize = 100
    for (let i = 0; i < orgMembers.length; i += batchSize) {
      const batch = orgMembers.slice(i, i + batchSize)
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert(batch)
        
      if (memberError) {
        console.error('Feil ved oppretting av brukermedlemskap:', memberError)
      }
    }
    
    console.log(`${orgMembers.length} brukere lagt til i standard organisasjon`)
    
    // 4. Oppdater eksisterende workspaces til å tilhøre standardorganisasjonen
    console.log('Oppdaterer workspaces...')
    const { error: workspaceError } = await supabase
      .from('workspaces')
      .update({ organization_id: defaultOrg.id })
      .is('organization_id', null)
      
    if (workspaceError) {
      console.error('Feil ved oppdatering av workspaces:', workspaceError)
    }
    
    // 5. Oppdater prosjekter
    console.log('Oppdaterer prosjekter...')
    const { error: projectError } = await supabase
      .from('projects')
      .update({ organization_id: defaultOrg.id })
      .is('organization_id', null)
      
    if (projectError) {
      console.error('Feil ved oppdatering av prosjekter:', projectError)
    }
    
    console.log('Migrering fullført! Applikasjonen er nå multi-tenant.')
    
  } catch (error) {
    console.error('Feil under migrering:', error)
    process.exit(1)
  }
}

// Kjør migreringen hvis skriptet kjøres direkte
if (require.main === module) {
  migrateToMultiTenant()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Uventet feil:', error)
      process.exit(1)
    })
}

export { migrateToMultiTenant } 