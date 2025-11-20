/**
 * Make Role Column Nullable Migration Runner
 * Allows creating admin users with role_id only (RBAC system)
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
  console.log('  Make Role Column Nullable Migration');
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
    const migrationPath = path.join(__dirname, '../migrations/20250120_make_role_column_nullable.sql');
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

      // Check column is now nullable
      const columnCheck = await client.query(`
        SELECT column_name, is_nullable, data_type
        FROM information_schema.columns
        WHERE table_name = 'admin_users' AND column_name = 'role'
      `);

      if (columnCheck.rows.length > 0) {
        const isNullable = columnCheck.rows[0].is_nullable === 'YES';
        console.log(`  - Role column nullable: ${isNullable ? '✓ YES' : '✗ NO'}`);
      }

      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  ✅ Migration completed successfully!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Restart your backend server (if running)');
      console.log('  2. You can now create admin users with role_id only');
      console.log('  3. New RBAC users will have role = NULL');
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
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
runMigration();
