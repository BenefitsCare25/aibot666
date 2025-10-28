import { readFileSync } from 'fs';
import { getSchemaClient } from '../config/supabase.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Populate knowledge base for a specific company schema
 */
async function populateKnowledgeBase(schemaName) {
  console.log(`\n🔄 Populating knowledge base for schema: ${schemaName}`);

  // Read FAQ data
  const faqData = JSON.parse(
    readFileSync('C:\\Users\\huien\\aibot\\faq_sections.json', 'utf-8')
  );

  const client = getSchemaClient(schemaName);

  let totalInserted = 0;
  let totalErrors = 0;

  // Process each section
  for (const [sectionName, questions] of Object.entries(faqData)) {
    console.log(`\n📂 Processing section: ${sectionName} (${questions.length} items)`);

    for (const item of questions) {
      const { question, answer, number } = item;

      // Skip if answer is empty
      if (!answer || answer.trim() === '') {
        console.log(`   ⚠️  Skipping Q${number}: No answer provided`);
        continue;
      }

      try {
        // Combine question and answer for embedding
        const combinedText = `Question: ${question}\n\nAnswer: ${answer}`;

        // Generate embedding
        console.log(`   🔍 Generating embedding for Q${number}...`);
        const embedding = await generateEmbedding(combinedText);

        // Prepare metadata
        const metadata = {
          section: sectionName,
          question_number: number,
          has_detailed_answer: answer.length > 100
        };

        // Map section names to categories and subcategories
        let category, subcategory;

        switch (sectionName) {
          case 'Benefit Coverage':
            category = 'benefits';
            subcategory = 'coverage';
            break;
          case 'Letter of Guarantee (LOG)':
            category = 'log';
            subcategory = 'requests';
            break;
          case 'Portal Matters':
            category = 'portal';
            subcategory = 'access';
            break;
          case 'Claims Status':
            category = 'claims';
            subcategory = 'status';
            break;
          default:
            category = 'general';
            subcategory = 'faq';
        }

        // Insert into knowledge base
        const { data, error } = await client.from('knowledge_base').insert({
          title: question,
          content: answer,
          category: category,
          subcategory: subcategory,
          embedding: JSON.stringify(embedding),
          metadata: metadata,
          source: 'Helpdesk FAQ Excel',
          confidence_score: 1.0,
          is_active: true
        });

        if (error) {
          console.error(`   ❌ Error inserting Q${number}:`, error.message);
          totalErrors++;
        } else {
          console.log(`   ✅ Inserted Q${number}: ${question.substring(0, 60)}...`);
          totalInserted++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`   ❌ Error processing Q${number}:`, error.message);
        totalErrors++;
      }
    }
  }

  console.log(`\n📊 Summary for ${schemaName}:`);
  console.log(`   ✅ Successfully inserted: ${totalInserted}`);
  console.log(`   ❌ Errors: ${totalErrors}`);
  console.log(`   📝 Total processed: ${totalInserted + totalErrors}`);

  return { totalInserted, totalErrors };
}

/**
 * Main execution
 */
async function main() {
  console.log('📚 FAQ Knowledge Base Population Script');
  console.log('=' .repeat(50));

  // Get schema name from command line or use default
  const schemaName = process.argv[2] || 'company_a';

  console.log(`\nTarget schema: ${schemaName}`);
  console.log(`FAQ source: faq_sections.json`);

  try {
    const result = await populateKnowledgeBase(schemaName);

    console.log('\n✨ Knowledge base population completed!');
    console.log('\nNext steps:');
    console.log('1. Test the chatbot with the new questions');
    console.log('2. Verify answers are being retrieved correctly');
    console.log('3. Adjust confidence scores if needed');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();
