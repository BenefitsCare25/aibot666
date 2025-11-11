/**
 * Diagnostic Script: Check CBRE Knowledge Base Embeddings
 *
 * This script checks if knowledge base entries have embeddings
 * and whether they include titles in the embedded content.
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

// Create PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkCBREEmbeddings() {
  try {
    console.log('=== CBRE Knowledge Base Embedding Diagnostic ===\n');

    // Check if knowledge base has entries
    const countResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(embedding) as with_embedding,
             COUNT(*) - COUNT(embedding) as missing_embedding
      FROM cbre.knowledge_base
      WHERE is_active = true
    `);

    const stats = countResult.rows[0];
    console.log('📊 Knowledge Base Statistics:');
    console.log(`   Total entries: ${stats.total}`);
    console.log(`   With embeddings: ${stats.with_embedding}`);
    console.log(`   Missing embeddings: ${stats.missing_embedding}\n`);

    if (stats.with_embedding === '0') {
      console.log('❌ ISSUE FOUND: No embeddings exist in the knowledge base!');
      console.log('   This explains why searches return 0 results.\n');
      console.log('   SOLUTION: Run the re-embedding migration:');
      console.log('   node backend/migrations/re-embed-knowledge-with-titles.js --schema=cbre\n');
      return;
    }

    // Check sample entries
    const sampleResult = await pool.query(`
      SELECT id, title,
             SUBSTRING(content, 1, 100) as content_preview,
             CASE WHEN embedding IS NULL THEN 'NO' ELSE 'YES' END as has_embedding,
             category, subcategory
      FROM cbre.knowledge_base
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('📋 Sample Entries:');
    sampleResult.rows.forEach((row, idx) => {
      console.log(`\n   ${idx + 1}. Title: ${row.title}`);
      console.log(`      Category: ${row.category} / ${row.subcategory}`);
      console.log(`      Has Embedding: ${row.has_embedding}`);
      console.log(`      Content Preview: ${row.content_preview}...`);
    });

    // Check if we can find the specific entry from the screenshot
    const panelClinicResult = await pool.query(`
      SELECT id, title, category, subcategory,
             CASE WHEN embedding IS NULL THEN 'NO' ELSE 'YES' END as has_embedding
      FROM cbre.knowledge_base
      WHERE title ILIKE '%payment%panel%clinic%'
         OR title ILIKE '%Why do I have to make payment at Panel clinic%'
      ORDER BY created_at DESC
    `);

    console.log('\n\n🔍 Searching for "Panel clinic payment" entry:');
    if (panelClinicResult.rows.length === 0) {
      console.log('   ❌ Entry not found in database');
    } else {
      panelClinicResult.rows.forEach(row => {
        console.log(`   ✅ Found: "${row.title}"`);
        console.log(`      Category: ${row.category} / ${row.subcategory}`);
        console.log(`      Has Embedding: ${row.has_embedding}`);

        if (row.has_embedding === 'NO') {
          console.log('      ⚠️  PROBLEM: Entry exists but has NO embedding!');
        }
      });
    }

    console.log('\n✅ Diagnostic complete');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCBREEmbeddings();
