import { postgres, supabase } from '../../config/supabase.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Schema Automation Service
 * Handles automatic creation and deletion of company database schemas
 */

/**
 * Validate schema name against PostgreSQL identifier rules
 * @param {string} schemaName - Schema name to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateSchemaName(schemaName) {
  if (!schemaName || typeof schemaName !== 'string') {
    return { valid: false, error: 'Schema name is required and must be a string' };
  }

  // Check length (PostgreSQL max identifier length is 63)
  if (schemaName.length > 63) {
    return { valid: false, error: 'Schema name cannot exceed 63 characters' };
  }

  // Check format: must start with letter or underscore, contain only alphanumeric and underscore
  const validPattern = /^[a-z_][a-z0-9_]*$/;
  if (!validPattern.test(schemaName)) {
    return {
      valid: false,
      error: 'Schema name must start with a letter or underscore and contain only lowercase letters, numbers, and underscores'
    };
  }

  // Check against PostgreSQL reserved words
  const reservedWords = ['public', 'information_schema', 'pg_catalog', 'pg_toast'];
  if (reservedWords.includes(schemaName.toLowerCase())) {
    return { valid: false, error: `Schema name "${schemaName}" is a reserved PostgreSQL keyword` };
  }

  return { valid: true };
}

/**
 * Check if schema already exists in the database
 * @param {string} schemaName - Schema name to check
 * @returns {Promise<boolean>} - True if schema exists
 */
export async function schemaExists(schemaName) {
  if (!postgres) {
    throw new Error('PostgreSQL connection not available. Check SUPABASE_DB_PASSWORD in environment variables.');
  }

  const query = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.schemata
      WHERE schema_name = $1
    ) as exists;
  `;

  const result = await postgres.query(query, [schemaName]);
  return result.rows[0].exists;
}

/**
 * Log schema activity to database
 * @param {Object} logData - Activity log data
 * @returns {Promise<Object>} - Inserted log record
 */
export async function logSchemaActivity(logData) {
  const {
    action,
    schema_name,
    company_id,
    admin_user,
    status,
    error_message = null,
    metadata = {}
  } = logData;

  const { data, error } = await supabase
    .from('schema_activity_logs')
    .insert({
      action,
      schema_name,
      company_id,
      admin_user,
      status,
      error_message,
      metadata
    })
    .select()
    .single();

  if (error) {
    console.error('[SchemaAutomation] Error logging activity:', error);
    throw error;
  }

  return data;
}

/**
 * Update schema activity log status
 * @param {string} logId - Log record ID
 * @param {string} status - New status
 * @param {string} errorMessage - Optional error message
 * @returns {Promise<Object>} - Updated log record
 */
export async function updateSchemaActivityLog(logId, status, errorMessage = null) {
  const updateData = {
    status,
    completed_at: new Date().toISOString()
  };

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { data, error } = await supabase
    .from('schema_activity_logs')
    .update(updateData)
    .eq('id', logId)
    .select()
    .single();

  if (error) {
    console.error('[SchemaAutomation] Error updating activity log:', error);
    throw error;
  }

  return data;
}

/**
 * Load and process schema template
 * @param {string} schemaName - Schema name to replace in template
 * @returns {Promise<string>} - Processed SQL with schema name substituted
 */
export async function loadSchemaTemplate(schemaName) {
  const templatePath = path.join(__dirname, '../../config/company-schema-template.sql');

  try {
    const templateContent = await fs.readFile(templatePath, 'utf-8');

    // Replace all instances of {{SCHEMA_NAME}} with actual schema name
    const processedSQL = templateContent.replace(/\{\{SCHEMA_NAME\}\}/g, schemaName);

    console.log(`[SchemaAutomation] Template loaded and processed for schema: ${schemaName}`);
    return processedSQL;
  } catch (error) {
    console.error('[SchemaAutomation] Error loading template:', error);
    throw new Error(`Failed to load schema template: ${error.message}`);
  }
}

/**
 * Execute SQL via PostgreSQL direct connection
 * @param {string} sql - SQL to execute
 * @returns {Promise<void>}
 */
export async function executeSQL(sql) {
  if (!postgres) {
    throw new Error('PostgreSQL connection not available. Check SUPABASE_DB_PASSWORD in environment variables.');
  }

  try {
    await postgres.query(sql);
    console.log('[SchemaAutomation] SQL executed successfully');
  } catch (error) {
    console.error('[SchemaAutomation] SQL execution error:', error);
    throw error;
  }
}

/**
 * Expose schema to PostgREST API by updating db_api_schemas
 * This makes the schema accessible via Supabase client
 * @param {string} schemaName - Schema name to expose
 * @returns {Promise<void>}
 */
export async function exposeSchemaToAPI(schemaName) {
  if (!postgres) {
    throw new Error('PostgreSQL connection not available');
  }

  try {
    // Grant usage on schema to anon and authenticated roles
    await postgres.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO anon, authenticated, service_role;`);

    // Grant privileges on all tables in the schema
    await postgres.query(`GRANT ALL ON ALL TABLES IN SCHEMA "${schemaName}" TO anon, authenticated, service_role;`);

    // Grant privileges on all sequences
    await postgres.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO anon, authenticated, service_role;`);

    // Grant privileges on all functions
    await postgres.query(`GRANT ALL ON ALL FUNCTIONS IN SCHEMA "${schemaName}" TO anon, authenticated, service_role;`);

    // Alter default privileges for future objects
    await postgres.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}"
      GRANT ALL ON TABLES TO anon, authenticated, service_role;
    `);

    await postgres.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}"
      GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    `);

    await postgres.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}"
      GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    `);

    // Reload PostgREST schema cache
    await postgres.query(`NOTIFY pgrst, 'reload schema';`);

    console.log(`[SchemaAutomation] Schema ${schemaName} exposed to PostgREST API successfully`);
  } catch (error) {
    console.error('[SchemaAutomation] Error exposing schema to API:', error);
    throw error;
  }
}

/**
 * Create company schema from template
 * @param {Object} params - Creation parameters
 * @param {string} params.schemaName - Schema name to create
 * @param {string} params.companyId - Company ID from registry
 * @param {string} params.adminUser - Admin user performing the action
 * @returns {Promise<Object>} - Result with log ID and status
 */
export async function createCompanySchema({ schemaName, companyId, adminUser = 'system' }) {
  console.log(`[SchemaAutomation] Starting schema creation for: ${schemaName}`);

  // Step 1: Validate schema name
  const validation = validateSchemaName(schemaName);
  if (!validation.valid) {
    throw new Error(`Invalid schema name: ${validation.error}`);
  }

  // Step 2: Check if schema already exists
  const exists = await schemaExists(schemaName);
  if (exists) {
    throw new Error(`Schema "${schemaName}" already exists in the database`);
  }

  // Step 3: Create activity log (pending status)
  const log = await logSchemaActivity({
    action: 'create_schema',
    schema_name: schemaName,
    company_id: companyId,
    admin_user: adminUser,
    status: 'pending',
    metadata: { started_at: new Date().toISOString() }
  });

  try {
    // Step 4: Update log to in_progress
    await updateSchemaActivityLog(log.id, 'in_progress');

    // Step 5: Load and process template
    const schemaSQL = await loadSchemaTemplate(schemaName);

    // Step 6: Execute SQL
    const startTime = Date.now();
    await executeSQL(schemaSQL);
    const duration = Date.now() - startTime;

    // Step 7: Expose schema to PostgREST API
    console.log(`[SchemaAutomation] Exposing schema ${schemaName} to PostgREST API...`);
    await exposeSchemaToAPI(schemaName);

    // Step 8: Verify schema was created
    const created = await schemaExists(schemaName);
    if (!created) {
      throw new Error('Schema creation appeared to succeed but schema does not exist');
    }

    // Step 9: Update log to completed
    await updateSchemaActivityLog(log.id, 'completed', null);

    console.log(`[SchemaAutomation] Schema created successfully in ${duration}ms`);

    return {
      success: true,
      logId: log.id,
      schemaName,
      duration
    };
  } catch (error) {
    console.error('[SchemaAutomation] Schema creation failed:', error);

    // Update log with error
    await updateSchemaActivityLog(log.id, 'failed', error.message);

    throw error;
  }
}

/**
 * Rollback company creation (delete from registry)
 * Used when schema creation fails
 * @param {string} companyId - Company ID to delete
 * @returns {Promise<void>}
 */
export async function rollbackCompanyCreation(companyId) {
  console.log(`[SchemaAutomation] Rolling back company creation: ${companyId}`);

  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', companyId);

  if (error) {
    console.error('[SchemaAutomation] Rollback failed:', error);
    throw new Error(`Failed to rollback company creation: ${error.message}`);
  }

  console.log('[SchemaAutomation] Company rollback completed');
}

/**
 * Soft delete company (mark as inactive, preserve schema)
 * @param {string} companyId - Company ID to soft delete
 * @param {string} adminUser - Admin user performing the action
 * @returns {Promise<Object>} - Updated company record
 */
export async function softDeleteCompany(companyId, adminUser = 'system') {
  console.log(`[SchemaAutomation] Soft deleting company: ${companyId}`);

  // Get company details for logging
  const { data: company, error: fetchError } = await supabase
    .from('companies')
    .select('id, name, schema_name')
    .eq('id', companyId)
    .single();

  if (fetchError || !company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Update status to inactive
  const { data, error } = await supabase
    .from('companies')
    .update({ status: 'inactive' })
    .eq('id', companyId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to soft delete company: ${error.message}`);
  }

  // Log the soft deletion
  await logSchemaActivity({
    action: 'delete_schema',
    schema_name: company.schema_name,
    company_id: companyId,
    admin_user: adminUser,
    status: 'completed',
    metadata: {
      action_type: 'soft_delete',
      company_name: company.name,
      note: 'Schema preserved, company marked as inactive'
    }
  });

  console.log(`[SchemaAutomation] Company soft deleted: ${company.name}`);

  return data;
}

/**
 * Hard delete company (permanently delete schema and company record)
 * @param {string} companyId - Company ID to hard delete
 * @param {string} adminUser - Admin user performing the action
 * @returns {Promise<Object>} - Result with deletion details
 */
export async function hardDeleteCompany(companyId, adminUser = 'system') {
  console.log(`[SchemaAutomation] Hard deleting company: ${companyId}`);

  // Get company details for logging
  const { data: company, error: fetchError } = await supabase
    .from('companies')
    .select('id, name, schema_name')
    .eq('id', companyId)
    .single();

  if (fetchError || !company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Create activity log (pending status)
  const log = await logSchemaActivity({
    action: 'delete_schema',
    schema_name: company.schema_name,
    company_id: companyId,
    admin_user: adminUser,
    status: 'pending',
    metadata: {
      action_type: 'hard_delete',
      company_name: company.name,
      note: 'Permanent deletion of schema and all data'
    }
  });

  try {
    // Update log to in_progress
    await updateSchemaActivityLog(log.id, 'in_progress');

    // Drop the schema and all its objects
    await dropCompanySchema(company.schema_name);

    // Delete company record from registry
    const { error: deleteError } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (deleteError) {
      throw new Error(`Failed to delete company record: ${deleteError.message}`);
    }

    // Update log to completed
    await updateSchemaActivityLog(log.id, 'completed', null);

    console.log(`[SchemaAutomation] Company hard deleted: ${company.name}`);

    return {
      success: true,
      companyId,
      companyName: company.name,
      schemaName: company.schema_name,
      logId: log.id
    };
  } catch (error) {
    console.error('[SchemaAutomation] Hard delete failed:', error);

    // Update log with error
    await updateSchemaActivityLog(log.id, 'failed', error.message);

    throw error;
  }
}

/**
 * Drop database schema completely
 * @param {string} schemaName - Schema name to drop
 * @returns {Promise<void>}
 */
export async function dropCompanySchema(schemaName) {
  if (!postgres) {
    throw new Error('PostgreSQL connection not available. Check SUPABASE_DB_PASSWORD in environment variables.');
  }

  // Validate schema name to prevent SQL injection
  const validation = validateSchemaName(schemaName);
  if (!validation.valid) {
    throw new Error(`Invalid schema name: ${validation.error}`);
  }

  // Check if schema exists
  const exists = await schemaExists(schemaName);
  if (!exists) {
    console.warn(`[SchemaAutomation] Schema "${schemaName}" does not exist, skipping drop`);
    return;
  }

  // Drop schema cascade (removes all objects in the schema)
  const dropSQL = `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`;

  try {
    await postgres.query(dropSQL);
    console.log(`[SchemaAutomation] Schema "${schemaName}" dropped successfully`);
  } catch (error) {
    console.error('[SchemaAutomation] Schema drop error:', error);
    throw new Error(`Failed to drop schema "${schemaName}": ${error.message}`);
  }
}
