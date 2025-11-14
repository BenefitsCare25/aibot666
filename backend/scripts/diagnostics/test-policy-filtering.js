/**
 * Test script for policy type filtering
 * Tests the searchKnowledgeBase function with different policy types
 */

import { searchKnowledgeBase } from '../api/services/vectorDB.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Create company-specific client for Company A
const companyAClient = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'company_a' },
  auth: { persistSession: false }
});

async function testPolicyFiltering() {
  console.log('=== Testing Policy Type Filtering ===\n');

  const testQuery = 'What is my dental benefit limit?';

  try {
    // Test 1: Premium policy search
    console.log('Test 1: Premium Policy Employee');
    console.log('Query:', testQuery);
    const premiumResults = await searchKnowledgeBase(
      testQuery,
      companyAClient,
      5,
      0.7,
      null,
      'Premium'
    );
    console.log(`Results: ${premiumResults.length} items`);
    premiumResults.forEach((item, idx) => {
      console.log(`  [${idx + 1}] Category: ${item.category}, Subcategory: ${item.subcategory || 'N/A'}`);
      console.log(`      Title: ${item.title}`);
      console.log(`      Similarity: ${item.similarity?.toFixed(3)}`);
    });
    console.log('');

    // Test 2: Standard policy search
    console.log('Test 2: Standard Policy Employee');
    console.log('Query:', testQuery);
    const standardResults = await searchKnowledgeBase(
      testQuery,
      companyAClient,
      5,
      0.7,
      null,
      'Standard'
    );
    console.log(`Results: ${standardResults.length} items`);
    standardResults.forEach((item, idx) => {
      console.log(`  [${idx + 1}] Category: ${item.category}, Subcategory: ${item.subcategory || 'N/A'}`);
      console.log(`      Title: ${item.title}`);
      console.log(`      Similarity: ${item.similarity?.toFixed(3)}`);
    });
    console.log('');

    // Test 3: No policy filter (original behavior)
    console.log('Test 3: No Policy Filter (Original Behavior)');
    console.log('Query:', testQuery);
    const noFilterResults = await searchKnowledgeBase(
      testQuery,
      companyAClient,
      5,
      0.7,
      null,
      null
    );
    console.log(`Results: ${noFilterResults.length} items`);
    noFilterResults.forEach((item, idx) => {
      console.log(`  [${idx + 1}] Category: ${item.category}, Subcategory: ${item.subcategory || 'N/A'}`);
      console.log(`      Title: ${item.title}`);
      console.log(`      Similarity: ${item.similarity?.toFixed(3)}`);
    });
    console.log('');

    // Analyze filtering effectiveness
    console.log('=== Analysis ===');
    console.log(`Premium results: ${premiumResults.length} items`);
    console.log(`Standard results: ${standardResults.length} items`);
    console.log(`Unfiltered results: ${noFilterResults.length} items`);

    const premiumOnlyItems = premiumResults.filter(r =>
      r.subcategory && r.subcategory.toLowerCase() === 'premium'
    );
    const standardOnlyItems = standardResults.filter(r =>
      r.subcategory && r.subcategory.toLowerCase() === 'standard'
    );

    console.log(`\nPolicy-specific items in Premium results: ${premiumOnlyItems.length}`);
    console.log(`Policy-specific items in Standard results: ${standardOnlyItems.length}`);

    // Check if wrong policy types are filtered out
    const wrongPolicyInPremium = premiumResults.filter(r =>
      r.subcategory && r.subcategory.toLowerCase() === 'standard'
    );
    const wrongPolicyInStandard = standardResults.filter(r =>
      r.subcategory && r.subcategory.toLowerCase() === 'premium'
    );

    console.log(`\n✓ Wrong policies filtered from Premium: ${wrongPolicyInPremium.length === 0 ? 'YES' : 'NO'}`);
    console.log(`✓ Wrong policies filtered from Standard: ${wrongPolicyInStandard.length === 0 ? 'YES' : 'NO'}`);

    if (wrongPolicyInPremium.length === 0 && wrongPolicyInStandard.length === 0) {
      console.log('\n✅ Policy filtering is working correctly!');
    } else {
      console.log('\n❌ Policy filtering has issues');
    }

  } catch (error) {
    console.error('Error during testing:', error);
    process.exit(1);
  }
}

// Run the test
testPolicyFiltering()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
