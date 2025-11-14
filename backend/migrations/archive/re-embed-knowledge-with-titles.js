/**
 * Migration Script: Re-embed Knowledge Base Entries with Titles
 *
 * Purpose: Update all existing knowledge base entries to include title in embeddings
 *
 * This script:
 * 1. Fetches all knowledge base entries from all company schemas
 * 2. Regenerates embeddings using title + content (instead of content only)
 * 3. Updates the embedding field in the database
 *
 * Usage:
 *   node migrations/re-embed-knowledge-with-titles.js [--dry-run] [--schema=SCHEMA_NAME]
 *
 * Options:
 *   --dry-run: Preview changes without updating database
 *   --schema: Only process specific company schema (default: all schemas)
 *
 * Example:
 *   node migrations/re-embed-knowledge-with-titles.js --dry-run
 *   node migrations/re-embed-knowledge-with-titles.js --schema=company_inspro
 */

import supabase from '../config/supabase.js';
import { generateEmbeddingsBatch } from '../api/services/openai.js';
import dotenv from 'dotenv';

dotenv.config();

const BATCH_SIZE = 50; // Process 50 entries at a time to avoid rate limits

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const schemaArg = args.find(arg => arg.startsWith('--schema='));
const targetSchema = schemaArg ? schemaArg.split('=')[1] : null;

console.log('=== Knowledge Base Re-embedding Migration ===');
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`);
console.log(`Target: ${targetSchema || 'All company schemas'}`);
console.log('');

/**
 * Get all company schemas from the database
 */
async function getCompanySchemas() {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('schema_name, name')
      .eq('is_active', true);

    if (error) throw error;

    // Filter by target schema if specified
    if (targetSchema) {
      return data.filter(c => c.schema_name === targetSchema);
    }

    return data;
  } catch (error) {
    console.error('Error fetching company schemas:', error);
    throw error;
  }
}

/**
 * Get all knowledge base entries for a schema
 */
async function getKnowledgeEntries(schemaName) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT id, title, content, category, subcategory
        FROM ${schemaName}.knowledge_base
        WHERE is_active = true
        ORDER BY created_at ASC
      `
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`Error fetching knowledge entries for ${schemaName}:`, error);
    throw error;
  }
}

/**
 * Process entries in batches and update embeddings
 */
async function processSchema(company) {
  const { schema_name, name } = company;

  console.log(`\n📁 Processing: ${name} (${schema_name})`);
  console.log('─'.repeat(60));

  try {
    // Fetch all entries
    const entries = await getKnowledgeEntries(schema_name);

    if (entries.length === 0) {
      console.log('  ℹ️  No knowledge base entries found');
      return { processed: 0, updated: 0, errors: 0 };
    }

    console.log(`  Found ${entries.length} entries to process`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

      console.log(`  📦 Batch ${batchNum}/${totalBatches} (${batch.length} entries)`);

      try {
        // Generate embeddings for title + content
        const embeddingTexts = batch.map(entry =>
          entry.title ? `${entry.title}\n\n${entry.content}` : entry.content
        );

        const embeddings = await generateEmbeddingsBatch(embeddingTexts);

        if (!isDryRun) {
          // Update each entry in database
          for (let j = 0; j < batch.length; j++) {
            const entry = batch[j];
            const embedding = embeddings[j];

            try {
              const { error: updateError } = await supabase.rpc('exec_sql', {
                sql_query: `
                  UPDATE ${schema_name}.knowledge_base
                  SET embedding = $1::vector,
                      updated_at = NOW()
                  WHERE id = $2
                `,
                params: [embedding, entry.id]
              });

              if (updateError) {
                console.error(`    ❌ Error updating entry ${entry.id}:`, updateError);
                errors++;
              } else {
                updated++;
              }
            } catch (err) {
              console.error(`    ❌ Error updating entry ${entry.id}:`, err);
              errors++;
            }
          }
        } else {
          // Dry run - just count
          updated += batch.length;
        }

        processed += batch.length;

        // Show progress
        console.log(`    ✅ Processed ${processed}/${entries.length} entries`);

        // Rate limiting: wait 1 second between batches
        if (i + BATCH_SIZE < entries.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (batchError) {
        console.error(`    ❌ Error processing batch ${batchNum}:`, batchError);
        errors += batch.length;
        processed += batch.length;
      }
    }

    console.log(`  ✅ Completed: ${updated} updated, ${errors} errors`);

    return { processed, updated, errors };

  } catch (error) {
    console.error(`  ❌ Error processing schema ${schema_name}:`, error);
    return { processed: 0, updated: 0, errors: 1 };
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  try {
    // Get all company schemas
    const companies = await getCompanySchemas();

    if (companies.length === 0) {
      console.log('❌ No company schemas found');
      process.exit(1);
    }

    console.log(`Found ${companies.length} company schema(s) to process:\n`);
    companies.forEach(c => console.log(`  - ${c.name} (${c.schema_name})`));

    // Confirm if not dry run
    if (!isDryRun) {
      console.log('\n⚠️  WARNING: This will update embeddings in the database!');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Process each schema
    let totalStats = {
      processed: 0,
      updated: 0,
      errors: 0
    };

    for (const company of companies) {
      const stats = await processSchema(company);
      totalStats.processed += stats.processed;
      totalStats.updated += stats.updated;
      totalStats.errors += stats.errors;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Companies processed: ${companies.length}`);
    console.log(`Total entries processed: ${totalStats.processed}`);
    console.log(`Total entries updated: ${totalStats.updated}`);
    console.log(`Total errors: ${totalStats.errors}`);

    if (isDryRun) {
      console.log('\n✅ DRY RUN COMPLETE - No changes made to database');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ MIGRATION COMPLETE');
      console.log('   All knowledge base entries have been re-embedded with titles');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
