# Multi-tenant Arkitektur for Searchable

Dette dokumentet beskriver hvordan Searchable-applikasjonen har blitt omstrukturert for å støtte en multi-tenant arkitektur med organisasjoner, brukere og rollebasert tilgangskontroll (RBAC).

## Hovedfunksjoner

1. **Organisasjonsstruktur**:

   - Brukere kan tilhøre flere organisasjoner
   - Hver organisasjon har sine egne isolerte data
   - Organisasjoner kan kobles til en Microsoft tenant

2. **Rollebasert tilgangskontroll**:

   - Roller: `owner`, `admin`, `member`, `guest`
   - Hver rolle har spesifikke tillatelser
   - Tillatelser kontrollerer tilgang til funksjoner og data

3. **Data-isolasjon**:
   - Row-Level Security (RLS) sikrer at brukere bare ser data fra sine organisasjoner
   - Ressurser (e-poster, filer, prosjekter) er knyttet til organisasjoner

## Installasjon og Migrering

### Alternativer for migrering

1. **Supabase CLI (anbefalt hvis du bruker Supabase)**:

   ```bash
   npm run migrate-to-multi-tenant
   ```

   Velg alternativ 1 i migrasjonsskriptet.

2. **Manuell SQL-migrering (for andre databaser)**:

   ```bash
   npm run migrate-to-multi-tenant
   ```

   Velg alternativ 2, og kjør den genererte SQL-filen manuelt.

3. **Bare komponentinstallasjon (ingen databaseendringer)**:
   ```bash
   npm run migrate-to-multi-tenant
   ```
   Velg alternativ 3 hvis du bare ønsker å installere brukergrensesnittet.

## Brukergrensesnitt

1. **OrganizationSelector**:

   - Lagt til i sidebaren for enkel tilgang til organisasjoner
   - Tillater brukere å bytte mellom organisasjoner de er medlem av

2. **Organisasjonsinnstillinger**:

   - Tilgjengelig på `/settings/organizations`
   - Opprette, redigere og slette organisasjoner
   - Administrere medlemskap og roller

3. **Microsoft-integrasjon**:
   - Koble organisasjoner til Microsoft tenant
   - Tilgangskontroll basert på Microsoft-roller

## Databasestruktur

Nye tabeller:

- `organizations`: Lagrer organisasjonsdata
- `organization_members`: Kobler brukere til organisasjoner med roller

Oppdaterte tabeller:

- `workspaces`: Inkluderer nå `organization_id`
- `projects`: Inkluderer nå `organization_id`

## Teknisk implementasjon

1. **Row-Level Security**:

   - Supabase RLS-policies for å sikre datatilgang
   - Alle forespørsler filtreres basert på brukerens organisasjonstilgang

2. **Rollebasert tilgangskontroll**:

   ```typescript
   // Sjekke tillatelser
   hasPermission(userId, organizationId, Permission.ReadWorkspace);
   ```

3. **Kontekst-provider**:
   ```typescript
   // Få tilgang til nåværende organisasjon
   const { currentOrganization } = useOrganization();
   ```

## Feilsøking

### Vanlige problemer

1. **Supabase CLI-problemer**:

   - Sørg for at Supabase CLI er installert: `npm install -g supabase`
   - Kjør `supabase init` hvis du ikke har et lokalt prosjekt

2. **Databasekobling**:

   - Kontroller at databasen er tilgjengelig og koblet
   - Sjekk at brukeren har tillatelser til å kjøre migreringer

3. **Brukergrensesnitt-problemer**:
   - Kjør `npm run dev` for å starte applikasjonen på nytt
   - Tøm nettleserens hurtiglager hvis du opplever uventede problemer

## Utvikling

For å utvide multi-tenant funksjonaliteten:

1. **Legge til nye tabeller**:

   - Alle nye tabeller bør inkludere `organization_id`
   - Implementer RLS-policies for å sikre datatilgang

2. **Tilpasse tillatelser**:

   - Utvid `Permission`-enum i `permissions.ts`
   - Definer hvilke roller som har disse tillatelsene

3. **Utvide brukergrensesnittet**:
   - Bruk `useOrganization`-hook for å få organisasjonskontekst
   - Sjekk brukerens rolle før du viser handlinger
