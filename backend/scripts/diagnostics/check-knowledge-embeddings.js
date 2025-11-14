/**
 * Diagnostic Script: Check Knowledge Base Embeddings
 *
 * Usage: node backend/scripts/check-knowledge-embeddings.js [schema_name]
 * Example: node backend/scripts/check-knowledge-embeddings.js company_a
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

// Get schema name from command line args or default to company_a
const schemaName = process.argv[2] || 'company_a';

// Create PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkEmbeddings() {
  try {
    console.log(`=== ${schemaName.toUpperCase()} Knowledge Base Embedding Diagnostic ===\n`);

    // Check if schema exists
    const schemaCheck = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = $1
    `, [schemaName]);

    if (schemaCheck.rows.length === 0) {
      console.log(`❌ ERROR: Schema "${schemaName}" does not exist!`);
      console.log('   Available schemas can be checked in your database.\n');
      return;
    }

    console.log(`✅ Schema "${schemaName}" exists\n`);

    // Check if knowledge base table exists
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = 'knowledge_base'
    `, [schemaName]);

    if (tableCheck.rows.length === 0) {
      console.log(`❌ ERROR: Table "knowledge_base" does not exist in schema "${schemaName}"!`);
      return;
    }

    console.log(`✅ Table "knowledge_base" exists\n`);

    // Check if knowledge base has entries
    const countResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(embedding) as with_embedding,
             COUNT(*) - COUNT(embedding) as missing_embedding,
             COUNT(CASE WHEN is_active = true THEN 1 END) as active_total,
             COUNT(CASE WHEN is_active = true AND embedding IS NOT NULL THEN 1 END) as active_with_embedding
      FROM ${schemaName}.knowledge_base
    `);

    const stats = countResult.rows[0];
    console.log('📊 Knowledge Base Statistics:');
    console.log(`   Total entries: ${stats.total}`);
    console.log(`   Active entries: ${stats.active_total}`);
    console.log(`   With embeddings (all): ${stats.with_embedding}`);
    console.log(`   With embeddings (active): ${stats.active_with_embedding}`);
    console.log(`   Missing embeddings: ${stats.missing_embedding}\n`);

    if (parseInt(stats.active_with_embedding) === 0) {
      console.log('❌ ISSUE FOUND: No active entries have embeddings!');
      console.log('   This explains why searches return 0 results.\n');
      console.log('   SOLUTION: Use the re-embedding interface:');
      console.log(`   1. Go to: http://your-domain/reembed.html`);
      console.log(`   2. Select schema: ${schemaName}`);
      console.log('   3. Click "Start Re-embedding"\n');
      console.log('   OR run the re-embedding migration:');
      console.log(`   node backend/migrations/re-embed-knowledge-with-titles.js --schema=${schemaName}\n`);
    } else if (parseInt(stats.missing_embedding) > 0) {
      console.log(`⚠️  WARNING: ${stats.missing_embedding} entries are missing embeddings`);
      console.log('   Consider re-embedding to fix these entries.\n');
    } else {
      console.log('✅ All entries have embeddings!\n');
    }

    // Check sample entries
    const sampleResult = await pool.query(`
      SELECT id, title,
             SUBSTRING(content, 1, 100) as content_preview,
             CASE WHEN embedding IS NULL THEN 'NO' ELSE 'YES' END as has_embedding,
             CASE WHEN embedding IS NOT NULL THEN array_length(embedding::float[], 1) ELSE 0 END as embedding_dims,
             category, subcategory, is_active
      FROM ${schemaName}.knowledge_base
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('📋 Sample Entries (Latest 10):');
    sampleResult.rows.forEach((row, idx) => {
      const status = row.is_active ? '🟢' : '⭕';
      const embStatus = row.has_embedding === 'YES' ? '✅' : '❌';
      console.log(`\n   ${idx + 1}. ${status} ${row.title || '(no title)'}`);
      console.log(`      Category: ${row.category}${row.subcategory ? ' / ' + row.subcategory : ''}`);
      console.log(`      Has Embedding: ${embStatus} ${row.has_embedding}${row.embedding_dims > 0 ? ` (${row.embedding_dims} dims)` : ''}`);
      console.log(`      Active: ${row.is_active}`);
      console.log(`      Content: ${row.content_preview}...`);
    });

    // Check for specific query-related content
    console.log('\n\n🔍 Searching for claim/coverage related entries:');
    const claimResult = await pool.query(`
      SELECT id, title, category, subcategory,
             CASE WHEN embedding IS NULL THEN 'NO' ELSE 'YES' END as has_embedding,
             is_active
      FROM ${schemaName}.knowledge_base
      WHERE (title ILIKE '%claim%' OR content ILIKE '%claim%'
            OR title ILIKE '%coverage%' OR content ILIKE '%coverage%'
            OR title ILIKE '%limit%' OR content ILIKE '%limit%')
        AND is_active = true
      LIMIT 5
    `);

    if (claimResult.rows.length === 0) {
      console.log('   ❌ No claim-related entries found');
      console.log('   This could explain why the query "Why is my claim up to $60 only?" returns no results.');
    } else {
      console.log(`   ✅ Found ${claimResult.rows.length} claim-related entries:`);
      claimResult.rows.forEach((row, idx) => {
        console.log(`\n   ${idx + 1}. "${row.title}"`);
        console.log(`      Category: ${row.category}${row.subcategory ? ' / ' + row.subcategory : ''}`);
        console.log(`      Has Embedding: ${row.has_embedding}`);
        console.log(`      Active: ${row.is_active}`);

        if (row.has_embedding === 'NO') {
          console.log('      ⚠️  PROBLEM: Entry exists but has NO embedding!');
        }
      });
    }

    // Check match_knowledge function exists
    console.log('\n\n🔧 Checking match_knowledge function:');
    const fnCheck = await pool.query(`
      SELECT routine_name, routine_schema
      FROM information_schema.routines
      WHERE routine_schema = $1 AND routine_name = 'match_knowledge'
    `, [schemaName]);

    if (fnCheck.rows.length === 0) {
      console.log(`   ❌ Function "match_knowledge" does not exist in schema "${schemaName}"!`);
      console.log('   SOLUTION: Run the schema template SQL to create the function.');
    } else {
      console.log(`   ✅ Function "match_knowledge" exists in schema "${schemaName}"`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostic complete');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkEmbeddings();
