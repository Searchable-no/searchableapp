#!/usr/bin/env node
import { execSync } from 'child_process';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Oppretter readline interface for interaktiv input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Spør brukeren med en Promise
function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('\n🚀 Multi-tenant migrering for Searchable\n');
  
  try {
    // Sjekk at supabase er installert
    console.log('🔍 Sjekker Supabase CLI...');
    try {
      execSync('supabase --version', { stdio: 'ignore' });
      console.log('✅ Supabase CLI funnet');
    } catch {
      console.error('❌ Supabase CLI ikke funnet. Vennligst installer det med npm install -g supabase');
      process.exit(1);
    }
    
    // Sjekk at migrasjonen eksisterer
    const migrationPath = path.join(rootDir, 'supabase', 'migrations', '01_create_organizations.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migrasjonsfil ikke funnet: ${migrationPath}`);
      process.exit(1);
    }
    console.log('✅ Migrasjonsfil funnet');
    
    // Bekreft før migrering
    const confirm = await askQuestion('Dette vil migrere databasen til multi-tenant struktur. Vil du fortsette? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Migrering avbrutt');
      process.exit(0);
    }
    
    // Sjekk om Supabase er satt opp lokalt
    console.log('\n🔍 Sjekker om Supabase er satt opp lokalt...');
    let isSupabaseInitialized = false;
    
    try {
      // Sjekk om supabase/config.toml eksisterer, som indikerer at supabase er initiert
      if (fs.existsSync(path.join(rootDir, 'supabase', 'config.toml'))) {
        isSupabaseInitialized = true;
        console.log('✅ Supabase prosjekt funnet lokalt');
      }
    } catch (error) {
      console.log('⚠️ Kunne ikke sjekke Supabase status:', error.message);
    }
    
    // Hvis Supabase ikke er initiert, spør om å sette det opp
    if (!isSupabaseInitialized) {
      console.log('⚠️ Supabase prosjekt er ikke satt opp lokalt');
      const initSupabase = await askQuestion('Vil du sette opp et lokalt Supabase-prosjekt? (y/N): ');
      
      if (initSupabase.toLowerCase() === 'y') {
        console.log('\n📦 Setter opp et lokalt Supabase-prosjekt...');
        try {
          execSync('supabase init', { stdio: 'inherit', cwd: rootDir });
          console.log('✅ Supabase prosjekt opprettet lokalt');
        } catch (error) {
          console.error('❌ Kunne ikke sette opp Supabase lokalt:', error.message);
          console.log('⚠️ Vi fortsetter med manuell migrering av schema uten Supabase CLI');
        }
      } else {
        console.log('⚠️ Fortsetter uten lokal Supabase');
      }
    }
    
    // Spør om hvordan brukeren ønsker å fortsette
    console.log('\n📊 Velg hvordan du vil migrere:');
    console.log('1) Bruk supabase db push (krever Supabase-prosjekt)');
    console.log('2) Manuell SQL-migrering (anbefalt hvis du ikke har Supabase CLI satt opp)');
    console.log('3) Bare installer organisasjonskomponenter (ingen databaseendringer)');
    
    const migrationType = await askQuestion('Velg et alternativ (1/2/3): ');
    
    if (migrationType === '1') {
      // Kjør databasemigrering med Supabase CLI
      console.log('\n📦 Kjører Supabase database migrering...');
      
      try {
        execSync('supabase db push', { stdio: 'inherit', cwd: rootDir });
        console.log('✅ Database migrert');
      } catch (error) {
        console.error('❌ Kunne ikke migrere databasen med Supabase CLI:', error.message);
        console.log('⚠️ Du kan prøve å kjøre SQL-migrasjon manuelt i stedet');
        
        // Spør om å fortsette med manuell migrering
        const trySqlMigration = await askQuestion('Vil du fortsette med manuell SQL-migrering? (y/N): ');
        if (trySqlMigration.toLowerCase() !== 'y') {
          console.log('❌ Migrering avbrutt');
          process.exit(0);
        }
        
        // Fortsett med manuell SQL
        migrationType = '2';
      }
    }
    
    if (migrationType === '2') {
      // Hent SQL fra migrasjonsfilen
      console.log('\n📝 Forbereder SQL-migrasjon...');
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');
      
      // Skriv SQL til en fil som brukeren kan kjøre manuelt
      const outputSqlPath = path.join(rootDir, 'multi-tenant-migration.sql');
      fs.writeFileSync(outputSqlPath, sqlContent);
      
      console.log(`✅ SQL-migrasjonsskript lagret til: ${outputSqlPath}`);
      console.log('\n⚠️ Du må nå kjøre denne SQL-filen på din Supabase eller PostgreSQL database manuelt.');
      console.log('   Du kan bruke Supabase Dashboard, pgAdmin, eller psql for å kjøre skriptet.');
      console.log('\n⚙️ Tips:');
      console.log(' 1. Hvis du får feil om at tabeller allerede eksisterer, er det fordi de');
      console.log('    allerede har blitt opprettet. Dette er OK, og du kan fortsette.');
      console.log(' 2. SQL-skriptet inkluderer nå "IF NOT EXISTS" for å håndtere dette.');
      console.log(' 3. Policy-opprettelsen vil fortsatt prøve å opprette policies, men');
      console.log('    skriptet vil forsøke å fjerne eksisterende policies først.');
    }
    
    // Kjør data migrasjon hvis valgt
    if (migrationType === '1' || migrationType === '2') {
      const runDataMigration = await askQuestion('Vil du også migrere eksisterende data til multi-tenant modellen? (y/N): ');
      
      if (runDataMigration.toLowerCase() === 'y') {
        // Kjør TypeScript migrasjonsskript for data
        console.log('\n🔄 Kjører migreringsskript for data...');
        
        // Kompiler TypeScript migrasjonsskript
        console.log('🔨 Kompilerer migrasjonsskript...');
        const tempDir = path.join(rootDir, 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        execSync(`npx tsc ${path.join(rootDir, 'scripts', 'migrate-to-multi-tenant.ts')} --outDir ${tempDir} --esModuleInterop true --target es2020 --module commonjs`, { stdio: 'inherit' });
        
        // Kjør det kompilerte skriptet
        console.log('🏃 Kjører migrasjonsskript...');
        execSync(`node ${path.join(tempDir, 'migrate-to-multi-tenant.js')}`, { 
          stdio: 'inherit',
          env: { 
            ...process.env,
            NODE_ENV: 'development'
          },
          cwd: rootDir
        });
        
        // Rydder opp
        console.log('🧹 Rydder opp...');
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
    
    console.log('\n✨ Migrering fullført! Applikasjonen er nå klar for flere organisasjoner.');
    console.log('\n📝 Huskeliste:');
    console.log('  1. Restart applikasjonen med "npm run dev" for å laste inn de nye endringene');
    console.log('  2. Naviger til /settings/organizations for å administrere organisasjoner');
    console.log('  3. Bruk OrganizationSelector i sidebaren for å bytte mellom organisasjoner');
    
  } catch (error) {
    console.error('❌ Det oppstod en feil under migreringen:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main(); 