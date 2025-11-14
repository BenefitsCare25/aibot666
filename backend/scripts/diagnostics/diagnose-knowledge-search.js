import { getSchemaClient } from '../config/supabase.js';
import { generateEmbedding } from '../api/services/openai.js';
import dotenv from 'dotenv';

dotenv.config();

const SCHEMA_NAME = process.env.SCHEMA_NAME || 'cbre';

async function diagnoseKnowledgeSearch() {
  console.log('='.repeat(60));
  console.log('Knowledge Base Search Diagnostic Tool');
  console.log('='.repeat(60));
  console.log('');

  const client = getSchemaClient(SCHEMA_NAME);

  // Step 1: Check if knowledge base has any data
  console.log('Step 1: Checking knowledge base data...');
  const { data: allKnowledge, error: countError } = await client
    .from('knowledge_base')
    .select('id, title, category, subcategory, is_active, embedding')
    .limit(10);

  if (countError) {
    console.error('❌ Error querying knowledge base:', countError);
    return;
  }

  console.log(`✅ Found ${allKnowledge?.length || 0} knowledge base entries`);

  if (allKnowledge && allKnowledge.length > 0) {
    console.log('\nSample entries:');
    allKnowledge.forEach((kb, idx) => {
      console.log(`  ${idx + 1}. ${kb.title || '(no title)'}`);
      console.log(`     Category: ${kb.category}, Subcategory: ${kb.subcategory || 'none'}`);
      console.log(`     Active: ${kb.is_active}`);
      console.log(`     Embedding: ${kb.embedding ? `✅ Present (${kb.embedding.length} dims)` : '❌ NULL'}`);
    });
  }

  // Step 2: Check for NULL embeddings
  console.log('\n' + '-'.repeat(60));
  console.log('Step 2: Checking for NULL embeddings...');
  const { data: nullEmbeddings, error: nullError } = await client
    .from('knowledge_base')
    .select('id, title, content')
    .is('embedding', null);

  if (nullError) {
    console.error('❌ Error checking NULL embeddings:', nullError);
  } else if (nullEmbeddings && nullEmbeddings.length > 0) {
    console.error(`❌ Found ${nullEmbeddings.length} entries with NULL embeddings!`);
    console.log('Entries with NULL embeddings:');
    nullEmbeddings.slice(0, 5).forEach((kb, idx) => {
      console.log(`  ${idx + 1}. ${kb.title || '(no title)'}`);
      console.log(`     Content: ${kb.content?.substring(0, 100)}...`);
    });
    console.log('\n⚠️  This is likely the problem! Run re-embedding to fix.');
  } else {
    console.log('✅ No NULL embeddings found');
  }

  // Step 3: Test embedding generation
  console.log('\n' + '-'.repeat(60));
  console.log('Step 3: Testing embedding generation...');
  const testQuery = "How long is my referral valid for?";
  console.log(`Query: "${testQuery}"`);

  try {
    const queryEmbedding = await generateEmbedding(testQuery);
    console.log(`✅ Generated embedding with ${queryEmbedding.length} dimensions`);

    // Step 4: Test match_knowledge function with very low threshold
    console.log('\n' + '-'.repeat(60));
    console.log('Step 4: Testing match_knowledge function...');

    // Test with threshold 0.1 (very low - should match anything if data exists)
    console.log('\nTest 4a: Very low threshold (0.1)...');
    const { data: lowThresholdResults, error: lowError } = await client.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: 5
    });

    if (lowError) {
      console.error('❌ RPC Error (threshold 0.1):', lowError);
    } else {
      console.log(`✅ Found ${lowThresholdResults?.length || 0} matches with threshold 0.1`);
      if (lowThresholdResults && lowThresholdResults.length > 0) {
        lowThresholdResults.forEach((result, idx) => {
          console.log(`  ${idx + 1}. Similarity: ${result.similarity.toFixed(4)} - ${result.title || result.content?.substring(0, 50)}`);
        });
      } else {
        console.log('  ⚠️  No matches even with very low threshold!');
        console.log('  This suggests embeddings are NULL or match_knowledge function has issues.');
      }
    }

    // Test with normal threshold 0.7
    console.log('\nTest 4b: Normal threshold (0.7)...');
    const { data: normalResults, error: normalError } = await client.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5
    });

    if (normalError) {
      console.error('❌ RPC Error (threshold 0.7):', normalError);
    } else {
      console.log(`Found ${normalResults?.length || 0} matches with threshold 0.7`);
      if (normalResults && normalResults.length > 0) {
        normalResults.forEach((result, idx) => {
          console.log(`  ${idx + 1}. Similarity: ${result.similarity.toFixed(4)} - ${result.title || result.content?.substring(0, 50)}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error during embedding test:', error);
  }

  // Step 5: Check match_knowledge function exists
  console.log('\n' + '-'.repeat(60));
  console.log('Step 5: Verifying match_knowledge function exists...');

  try {
    // Try to call with dummy data to see if function exists
    const dummyEmbedding = new Array(1536).fill(0);
    const { error: fnError } = await client.rpc('match_knowledge', {
      query_embedding: dummyEmbedding,
      match_threshold: 0.9,
      match_count: 1
    });

    if (fnError) {
      if (fnError.message.includes('function') && fnError.message.includes('does not exist')) {
        console.error('❌ match_knowledge function does not exist in schema!');
        console.log('  Run the schema template SQL to create the function.');
      } else {
        console.log('✅ match_knowledge function exists');
      }
    } else {
      console.log('✅ match_knowledge function exists and is callable');
    }
  } catch (error) {
    console.error('Error checking function:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Diagnosis Complete');
  console.log('='.repeat(60));
}

// Run diagnosis
diagnoseKnowledgeSearch()
  .then(() => {
    console.log('\nDiagnosis finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nDiagnosis failed:', error);
    process.exit(1);
  });
