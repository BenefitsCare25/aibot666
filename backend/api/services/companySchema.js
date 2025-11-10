import supabase from '../../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a new company schema with all required tables
 * @param {string} schemaName - Name of the schema to create
 * @returns {Promise<Object>} - Result of schema creation
 */
export async function createCompanySchema(schemaName) {
  try {
    // Validate schema name
    if (!isValidSchemaName(schemaName)) {
      throw new Error('Invalid schema name. Must start with letter/underscore and contain only alphanumeric/underscore characters.');
    }

    // Read the template SQL file
    const templatePath = path.join(__dirname, '../../config/company-schema-template.sql');
    let templateSQL = fs.readFileSync(templatePath, 'utf8');

    // Replace all occurrences of {{SCHEMA_NAME}} with actual schema name
    const schemaSQL = templateSQL.replace(/\{\{SCHEMA_NAME\}\}/g, schemaName);

    // Execute the SQL to create schema
    // Note: Supabase doesn't support raw SQL execution via JS client for DDL
    // This would need to be executed directly in Supabase SQL editor or via admin API
    // For now, we'll return the SQL to be executed manually or via admin endpoint

    console.log(`Schema SQL generated for: ${schemaName}`);

    return {
      success: true,
      schemaName,
      sql: schemaSQL,
      message: 'Schema SQL generated successfully. Execute this SQL in Supabase SQL editor.'
    };
  } catch (error) {
    console.error('Error creating company schema:', error);
    throw error;
  }
}

/**
 * Validate schema name according to PostgreSQL rules
 * @param {string} schemaName - Schema name to validate
 * @returns {boolean} - Whether schema name is valid
 */
export function isValidSchemaName(schemaName) {
  // Must start with letter or underscore
  // Can contain letters, numbers, underscores
  // Max 63 characters
  const regex = /^[a-z_][a-z0-9_]*$/i;
  return regex.test(schemaName) && schemaName.length <= 63;
}

/**
 * Generate schema name from company name
 * @param {string} companyName - Company name
 * @returns {string} - Valid schema name
 */
export function generateSchemaName(companyName) {
  // Convert to lowercase, replace spaces/special chars with underscores
  let schemaName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z_]/, '_') // Ensure starts with letter or underscore
    .substring(0, 63); // Max length

  // Remove trailing underscores
  schemaName = schemaName.replace(/_+$/, '');

  // Prefix with 'company_' if not already
  if (!schemaName.startsWith('company_')) {
    schemaName = `company_${schemaName}`;
  }

  return schemaName;
}

/**
 * Check if schema exists
 * @param {string} schemaName - Schema name to check
 * @returns {Promise<boolean>} - Whether schema exists
 */
export async function schemaExists(schemaName) {
  try {
    const { data, error } = await supabase.rpc('schema_exists', {
      schema_name: schemaName
    });

    if (error) {
      // If function doesn't exist, create it via SQL
      // For now, we'll use a workaround by querying information_schema
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.schemata')
        .select('schema_name')
        .eq('schema_name', schemaName)
        .single();

      return !schemaError && schemaData !== null;
    }

    return data;
  } catch (error) {
    console.error('Error checking schema existence:', error);
    return false;
  }
}

/**
 * Register a new company in the registry
 * @param {Object} companyData - Company information
 * @returns {Promise<Object>} - Created company record
 */
export async function registerCompany(companyData) {
  try {
    const { name, domain, additionalDomains = [], settings = {} } = companyData;

    if (!name || !domain) {
      throw new Error('Company name and domain are required');
    }

    // Generate schema name from company name
    const schemaName = generateSchemaName(name);

    // Check if domain already exists
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id, domain')
      .eq('domain', domain)
      .single();

    if (existingCompany) {
      throw new Error(`Domain ${domain} is already registered to another company`);
    }

    // Insert company record
    const { data: company, error } = await supabase
      .from('companies')
      .insert([{
        name,
        domain,
        additional_domains: additionalDomains,
        schema_name: schemaName,
        status: 'active',
        settings
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`Company registered: ${name} (${domain}) -> ${schemaName}`);

    return {
      success: true,
      company,
      schemaSQL: await createCompanySchema(schemaName)
    };
  } catch (error) {
    console.error('Error registering company:', error);
    throw error;
  }
}

/**
 * Get company by domain
 * @param {string} domain - Domain to lookup
 * @returns {Promise<Object|null>} - Company record or null
 */
export async function getCompanyByDomain(domain) {
  try {
    if (!domain) {
      return null;
    }

    // Normalize domain (remove protocol, www, trailing slash)
    const normalizedDomain = normalizeDomain(domain);

    // First check main domain
    let { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('domain', normalizedDomain)
      .eq('status', 'active')
      .single();

    // If not found, check additional_domains
    if (error || !company) {
      const { data: companies } = await supabase
        .from('companies')
        .select('*')
        .eq('status', 'active')
        .contains('additional_domains', [normalizedDomain]);

      company = companies && companies.length > 0 ? companies[0] : null;
    }

    return company;
  } catch (error) {
    console.error('Error getting company by domain:', error);
    return null;
  }
}

/**
 * Normalize domain for consistent lookup
 * @param {string} domain - Raw domain
 * @returns {string} - Normalized domain
 */
export function normalizeDomain(domain) {
  if (!domain) return '';

  let normalized = domain.toLowerCase().trim();

  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');

  // Remove www
  normalized = normalized.replace(/^www\./, '');

  // Remove port and path - only keep the base domain
  // Split by : to remove port, then split by / to remove path
  normalized = normalized.split(':')[0]; // Remove port
  normalized = normalized.split('/')[0]; // Remove path

  // Remove trailing slash and dots
  normalized = normalized.replace(/[\/\.]+$/, '');

  return normalized;
}

/**
 * Get all companies
 * @returns {Promise<Array>} - Array of companies
 */
export async function getAllCompanies() {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error getting all companies:', error);
    return [];
  }
}

/**
 * Get company by ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object|null>} - Company record or null
 */
export async function getCompanyById(companyId) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error getting company by ID:', error);
    return null;
  }
}

/**
 * Update company
 * @param {string} companyId - Company ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated company record
 */
export async function updateCompany(companyId, updates) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', companyId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error updating company:', error);
    throw error;
  }
}

/**
 * Delete company (soft delete by setting status to inactive)
 * @param {string} companyId - Company ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteCompany(companyId) {
  try {
    const { error } = await supabase
      .from('companies')
      .update({ status: 'inactive' })
      .eq('id', companyId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error deleting company:', error);
    throw error;
  }
}

/**
 * Generate SQL for schema creation (for manual execution or API)
 * @param {string} schemaName - Schema name
 * @returns {string} - SQL script
 */
export function generateSchemaSQL(schemaName) {
  const templatePath = path.join(__dirname, '../../config/company-schema-template.sql');
  let templateSQL = fs.readFileSync(templatePath, 'utf8');
  return templateSQL.replace(/\{\{SCHEMA_NAME\}\}/g, schemaName);
}

export default {
  createCompanySchema,
  isValidSchemaName,
  generateSchemaName,
  schemaExists,
  registerCompany,
  getCompanyByDomain,
  getCompanyById,
  normalizeDomain,
  getAllCompanies,
  updateCompany,
  deleteCompany,
  generateSchemaSQL
};
