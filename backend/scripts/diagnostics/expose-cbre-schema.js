/**
 * Script to manually expose CBRE schema to PostgREST API
 * Run this once to fix the existing CBRE schema
 */

import { postgres } from '../config/supabase.js';

async function exposeSchema(schemaName) {
  console.log(`\n[Expose Schema] Starting for: ${schemaName}`);

  try {
    // Grant usage on schema to anon and authenticated roles
    console.log(`[1/8] Granting USAGE on schema...`);
    await postgres.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO anon, authenticated, service_role;`);

    // Grant privileges on all tables in the schema
    console.log(`[2/8] Granting privileges on all tables...`);
    await postgres.query(`GRANT ALL ON ALL TABLES IN SCHEMA "${schemaName}" TO anon, authenticated, service_role;`);

    // Grant privileges on all sequences
    console.log(`[3/8] Granting privileges on all sequences...`);
    await postgres.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO anon, authenticated, service_role;`);

    // Grant privileges on all functions
    console.log(`[4/8] Granting privileges on all functions...`);
    await postgres.query(`GRANT ALL ON ALL FUNCTIONS IN SCHEMA "${schemaName}" TO anon, authenticated, service_role;`);

    // Alter default privileges for future objects - tables
    console.log(`[5/8] Setting default privileges for tables...`);
    await postgres.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}"
      GRANT ALL ON TABLES TO anon, authenticated, service_role;
    `);

    // Alter default privileges for future objects - sequences
    console.log(`[6/8] Setting default privileges for sequences...`);
    await postgres.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}"
      GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    `);

    // Alter default privileges for future objects - functions
    console.log(`[7/8] Setting default privileges for functions...`);
    await postgres.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}"
      GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    `);

    // Reload PostgREST schema cache
    console.log(`[8/8] Reloading PostgREST schema cache...`);
    await postgres.query(`NOTIFY pgrst, 'reload schema';`);

    console.log(`\n✅ SUCCESS: Schema "${schemaName}" has been exposed to PostgREST API`);
    console.log(`You can now use it with Supabase client!\n`);
  } catch (error) {
    console.error(`\n❌ ERROR: Failed to expose schema "${schemaName}":`, error.message);
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  const schemaName = process.argv[2] || 'cbre';

  console.log(`==========================================`);
  console.log(`  Expose Schema to PostgREST API`);
  console.log(`==========================================`);
  console.log(`Schema: ${schemaName}`);

  await exposeSchema(schemaName);

  // Close postgres connection
  await postgres.end();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
