/**
 * Diagnostic Script: Check Knowledge Base Embeddings for Referral Query
 *
 * Usage: node backend/scripts/check-referral-embeddings.js [schema_name]
 * Example: node backend/scripts/check-referral-embeddings.js cbre
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

// Get schema name from command line args or default to cbre
const schemaName = process.argv[2] || 'cbre';

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
      console.log('   SOLUTION: Re-embed the knowledge base using the admin interface or migration script\n');
    } else if (parseInt(stats.missing_embedding) > 0) {
      console.log(`⚠️  WARNING: ${stats.missing_embedding} entries are missing embeddings`);
      console.log('   Consider re-embedding to fix these entries.\n');
    } else {
      console.log('✅ All entries have embeddings!\n');
    }

    // Check for referral-related content
    console.log('🔍 Searching for REFERRAL related entries:');
    const referralResult = await pool.query(`
      SELECT id, title, category, subcategory,
             SUBSTRING(content, 1, 200) as content_preview,
             CASE WHEN embedding IS NULL THEN 'NO' ELSE 'YES' END as has_embedding,
             CASE WHEN embedding IS NOT NULL THEN array_length(embedding::float[], 1) ELSE 0 END as embedding_dims,
             is_active
      FROM ${schemaName}.knowledge_base
      WHERE (title ILIKE '%referral%' OR content ILIKE '%referral%')
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (referralResult.rows.length === 0) {
      console.log('   ❌ No referral-related entries found');
      console.log('   This explains why the query "How long is my referral valid for?" returns no results.');
      console.log('   ACTION REQUIRED: Add referral-related Q&A to the knowledge base.\n');
    } else {
      console.log(`   ✅ Found ${referralResult.rows.length} referral-related entries:\n`);
      referralResult.rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. "${row.title || '(no title)'}"`);
        console.log(`      Category: ${row.category}${row.subcategory ? ' / ' + row.subcategory : ''}`);
        console.log(`      Has Embedding: ${row.has_embedding}${row.embedding_dims > 0 ? ` (${row.embedding_dims} dims)` : ''}`);
        console.log(`      Active: ${row.is_active}`);
        console.log(`      Content: ${row.content_preview}...`);

        if (row.has_embedding === 'NO') {
          console.log('      ⚠️  PROBLEM: Entry exists but has NO embedding!');
          console.log('      SOLUTION: Re-embed this entry using the admin interface.\n');
        } else if (row.embedding_dims !== 1536) {
          console.log(`      ⚠️  WARNING: Embedding dimension is ${row.embedding_dims}, expected 1536!`);
          console.log('      SOLUTION: Re-generate embedding for this entry.\n');
        } else {
          console.log('      ✅ Embedding looks good!\n');
        }
      });
    }

    // Check match_knowledge function exists
    console.log('🔧 Checking match_knowledge function:');
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
    console.log('DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));

    if (parseInt(stats.active_with_embedding) === 0) {
      console.log('🔴 CRITICAL: No embeddings found - knowledge search will fail');
    } else if (referralResult.rows.length === 0) {
      console.log('🔴 ISSUE: Referral Q&A missing from knowledge base');
    } else if (referralResult.rows.some(r => r.has_embedding === 'NO')) {
      console.log('🟡 WARNING: Some referral entries missing embeddings');
    } else {
      console.log('🟢 OK: Referral entries exist with embeddings');
      console.log('   If search still fails, check:');
      console.log('   1. Similarity threshold (may be too high)');
      console.log('   2. Policy type filtering (may be excluding results)');
      console.log('   3. Embedding quality (may need re-generation)');
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkEmbeddings();
