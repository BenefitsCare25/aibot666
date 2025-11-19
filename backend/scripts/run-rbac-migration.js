/**
 * RBAC Migration Runner
 * Executes the role-based access control migration
 */

import { postgres } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  RBAC System Migration');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  if (!postgres) {
    console.error('❌ Error: PostgreSQL connection not configured');
    console.error('');
    console.error('Please configure your database connection in .env file:');
    console.error('  - Option 1: Set SUPABASE_CONNECTION_STRING');
    console.error('  - Option 2: Set DATABASE_URL');
    console.error('  - Option 3: Set SUPABASE_DB_PASSWORD');
    console.error('');
    process.exit(1);
  }

  try {
    // Read migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/20250119_add_rbac_system.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✓ Migration file loaded');
    console.log('');

    // Execute migration
    console.log('🔄 Executing migration...');
    console.log('');

    const client = await postgres.connect();

    try {
      // Begin transaction
      await client.query('BEGIN');
      console.log('✓ Transaction started');

      // Execute migration SQL
      await client.query(migrationSQL);
      console.log('✓ Migration SQL executed');

      // Commit transaction
      await client.query('COMMIT');
      console.log('✓ Transaction committed');
      console.log('');

      // Verify results
      console.log('📊 Verification:');

      // Check permissions created
      const permResult = await client.query('SELECT COUNT(*) FROM public.permissions');
      console.log(`  - Permissions created: ${permResult.rows[0].count}`);

      // Check roles created
      const roleResult = await client.query('SELECT COUNT(*) FROM public.roles');
      console.log(`  - Roles created: ${roleResult.rows[0].count}`);

      // Check Super Admin role
      const superAdminResult = await client.query(
        "SELECT name, is_system FROM public.roles WHERE name = 'Super Admin'"
      );
      if (superAdminResult.rows.length > 0) {
        console.log(`  - Super Admin role: ✓ Created (system role: ${superAdminResult.rows[0].is_system})`);
      }

      // Check Super Admin permissions
      const superAdminPermCount = await client.query(`
        SELECT COUNT(*)
        FROM public.role_permissions
        WHERE role_id = (SELECT id FROM public.roles WHERE name = 'Super Admin')
      `);
      console.log(`  - Super Admin permissions: ${superAdminPermCount.rows[0].count}`);

      // Check admin users migrated
      const migratedUsers = await client.query(`
        SELECT COUNT(*)
        FROM public.admin_users
        WHERE role_id IS NOT NULL
      `);
      console.log(`  - Admin users migrated: ${migratedUsers.rows[0].count}`);

      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  ✅ Migration completed successfully!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Restart your backend server');
      console.log('  2. Access Admin panel as Super Admin');
      console.log('  3. Navigate to "Roles" page to create custom roles');
      console.log('  4. Assign roles to admin users');
      console.log('');

    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error('❌ Error during migration, transaction rolled back');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════');
    console.error('  ❌ Migration failed');
    console.error('═══════════════════════════════════════════════════════');
    console.error('');
    console.error('Error details:');
    console.error(error.message);
    console.error('');

    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }

    if (error.detail) {
      console.error(`Detail: ${error.detail}`);
    }

    if (error.hint) {
      console.error(`Hint: ${error.hint}`);
    }

    console.error('');
    console.error('If tables already exist, this is normal (migration already run).');
    console.error('To re-run migration, first execute the ROLLBACK PROCEDURE from the migration file.');
    console.error('');

    process.exit(1);
  }

  process.exit(0);
}

// Run migration
runMigration();
