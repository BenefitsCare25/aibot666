import pdf from 'pdf-parse/lib/pdf-parse.js';
import fs from 'fs/promises';
import { generateEmbeddingsBatch } from './openai.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const CHAT_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

// Chunking configuration
const MAX_CHUNK_TOKENS = 800;
const CHUNK_OVERLAP_TOKENS = 100;
const APPROX_CHARS_PER_TOKEN = 4; // Rough estimate: 1 token ≈ 4 characters

/**
 * Extract text and metadata from PDF file
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<Object>} - {text, pageCount, title}
 */
export async function extractPDFContent(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);

    // Extract metadata
    const title = data.info?.Title ||
                  filePath.split(/[/\\]/).pop().replace('.pdf', '') ||
                  'Untitled Document';

    return {
      text: data.text,
      pageCount: data.numpages,
      title: title.trim(),
      metadata: {
        author: data.info?.Author,
        subject: data.info?.Subject,
        keywords: data.info?.Keywords,
        creationDate: data.info?.CreationDate,
      }
    };
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    throw new Error(`Failed to extract PDF: ${error.message}`);
  }
}

/**
 * Detect section headings in text
 * Returns array of {heading, startIndex, endIndex}
 * @param {string} text - Full document text
 * @returns {Array<Object>} - Detected sections
 */
function detectSections(text) {
  const sections = [];
  const lines = text.split('\n');
  let currentIndex = 0;

  // Patterns for detecting headings
  const headingPatterns = [
    /^[A-Z][A-Z\s]{3,}$/,                    // ALL CAPS HEADINGS
    /^\d+\.\s+[A-Z][^.!?]+$/,                // 1. Numbered Sections
    /^(Section|Chapter|Part)\s+\d+[:\.]?/i,  // Section 1:, Chapter 2.
    /^[A-Z][^.!?]{3,50}$/,                   // Title Case Headings (short lines)
    /^#{1,6}\s+.+$/,                         // Markdown-style headings
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isHeading = headingPatterns.some(pattern => pattern.test(line));

    if (isHeading && line.length > 3 && line.length < 100) {
      // Calculate character index for this line
      const precedingText = lines.slice(0, i).join('\n');
      sections.push({
        heading: line,
        startIndex: precedingText.length + (precedingText.length > 0 ? 1 : 0),
        lineIndex: i,
      });
    }
  }

  return sections;
}

/**
 * Structure-aware text chunking
 * Splits by sections first, then by token limits with overlap
 * @param {string} text - Full document text
 * @param {string} title - Document title
 * @returns {Array<Object>} - Array of chunks with metadata
 */
export function structureAwareChunk(text, title = '') {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks = [];
  const sections = detectSections(text);

  // If no sections detected, fall back to simple chunking
  if (sections.length === 0) {
    return simpleChunk(text, title);
  }

  // Process each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const nextSection = sections[i + 1];

    // Extract section content
    const sectionStart = section.startIndex;
    const sectionEnd = nextSection ? nextSection.startIndex : text.length;
    const sectionText = text.slice(sectionStart, sectionEnd).trim();

    // If section is small enough, keep it as one chunk
    const estimatedTokens = Math.ceil(sectionText.length / APPROX_CHARS_PER_TOKEN);

    if (estimatedTokens <= MAX_CHUNK_TOKENS) {
      chunks.push({
        content: sectionText,
        heading: section.heading,
        chunkIndex: chunks.length,
        metadata: {
          hasHeading: true,
          sectionIndex: i,
          estimatedTokens,
        }
      });
    } else {
      // Section is too large, split it with overlap while preserving heading
      const subChunks = splitLargeSection(sectionText, section.heading);
      subChunks.forEach((chunk, idx) => {
        chunks.push({
          content: chunk,
          heading: section.heading,
          chunkIndex: chunks.length,
          metadata: {
            hasHeading: true,
            sectionIndex: i,
            subChunkIndex: idx,
            estimatedTokens: Math.ceil(chunk.length / APPROX_CHARS_PER_TOKEN),
          }
        });
      });
    }
  }

  // Add document title context to each chunk
  return chunks.map((chunk, index) => ({
    ...chunk,
    title,
    chunkIndex: index,
  }));
}

/**
 * Simple token-based chunking with overlap (fallback)
 * @param {string} text - Text to chunk
 * @param {string} title - Document title
 * @returns {Array<Object>} - Array of chunks
 */
function simpleChunk(text, title = '') {
  const chunks = [];
  const maxChunkChars = MAX_CHUNK_TOKENS * APPROX_CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;

  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + maxChunkChars, text.length);
    let chunk = text.slice(startIndex, endIndex);

    // Try to break at sentence boundary if not at end
    if (endIndex < text.length) {
      const lastPeriod = chunk.lastIndexOf('. ');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > maxChunkChars * 0.7) { // Only break if we're at least 70% through
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }

    chunks.push({
      content: chunk.trim(),
      title,
      chunkIndex: chunks.length,
      metadata: {
        hasHeading: false,
        estimatedTokens: Math.ceil(chunk.length / APPROX_CHARS_PER_TOKEN),
      }
    });

    // Move start index forward with overlap
    startIndex += chunk.length - overlapChars;

    // Safety check to prevent infinite loops
    if (chunk.length === 0) {
      startIndex += maxChunkChars;
    }
  }

  return chunks;
}

/**
 * Split a large section into smaller chunks while keeping heading context
 * @param {string} sectionText - Section text
 * @param {string} heading - Section heading
 * @returns {Array<string>} - Array of chunk texts
 */
function splitLargeSection(sectionText, heading) {
  const chunks = [];
  const maxChunkChars = MAX_CHUNK_TOKENS * APPROX_CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;

  // Remove heading from section text to avoid duplication
  const contentWithoutHeading = sectionText.replace(heading, '').trim();

  let startIndex = 0;

  while (startIndex < contentWithoutHeading.length) {
    const endIndex = Math.min(startIndex + maxChunkChars, contentWithoutHeading.length);
    let chunkContent = contentWithoutHeading.slice(startIndex, endIndex);

    // Try to break at sentence boundary
    if (endIndex < contentWithoutHeading.length) {
      const lastPeriod = chunkContent.lastIndexOf('. ');
      const lastNewline = chunkContent.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > maxChunkChars * 0.7) {
        chunkContent = chunkContent.slice(0, breakPoint + 1);
      }
    }

    // Prepend heading to maintain context
    const fullChunk = `${heading}\n\n${chunkContent.trim()}`;
    chunks.push(fullChunk);

    startIndex += chunkContent.length - overlapChars;

    if (chunkContent.length === 0) {
      startIndex += maxChunkChars;
    }
  }

  return chunks;
}

/**
 * Detect document category using AI analysis
 * Analyzes title and sample chunks to determine category
 * @param {string} title - Document title
 * @param {Array<Object>} sampleChunks - First 2 chunks
 * @param {Array<string>} validCategories - List of valid categories
 * @returns {Promise<string>} - Detected category
 */
export async function detectCategory(title, sampleChunks, validCategories = []) {
  try {
    const sampleText = sampleChunks
      .map(chunk => chunk.content)
      .join('\n\n')
      .slice(0, 2000); // Limit to ~500 tokens

    const categoryList = validCategories.length > 0
      ? validCategories.join(', ')
      : 'Company Policies, Leave Policies, Benefits, HR Guidelines, Employee Handbook, Training Materials, Safety Procedures, Code of Conduct';

    const prompt = `Analyze this document and classify it into ONE category.

Document Title: ${title}

Document Sample:
${sampleText}

Valid Categories: ${categoryList}

Instructions:
- Choose the MOST SPECIFIC category that fits
- Return ONLY the category name, nothing else
- If uncertain, return "General"
- Consider the title and content style

Category:`;

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a document classification expert. Return only the category name, nothing else.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 50,
    });

    const detectedCategory = response.choices[0].message.content.trim();

    // Validate against valid categories if provided
    if (validCategories.length > 0) {
      const matchedCategory = validCategories.find(
        cat => cat.toLowerCase() === detectedCategory.toLowerCase()
      );
      return matchedCategory || 'General';
    }

    return detectedCategory || 'General';
  } catch (error) {
    console.error('Error detecting category:', error);
    return 'General'; // Fallback category
  }
}

/**
 * Generate embeddings for chunks in batches
 * Processes 50-100 chunks per API call for efficiency
 * @param {Array<Object>} chunks - Array of chunk objects
 * @returns {Promise<Array<Object>>} - Chunks with embeddings added
 */
export async function batchGenerateEmbeddings(chunks) {
  const BATCH_SIZE = 100; // Process 100 chunks per API call
  const chunksWithEmbeddings = [];

  try {
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map(chunk => chunk.content);

      console.log(`Generating embeddings for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);

      // Retry logic for rate limits
      let embeddings;
      let retries = 0;
      const MAX_RETRIES = 3;

      while (retries < MAX_RETRIES) {
        try {
          embeddings = await generateEmbeddingsBatch(texts);
          break;
        } catch (error) {
          retries++;
          if (error.message.includes('rate_limit') && retries < MAX_RETRIES) {
            const delay = Math.pow(2, retries) * 1000; // Exponential backoff
            console.log(`Rate limit hit, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error;
          }
        }
      }

      // Add embeddings to chunks
      batch.forEach((chunk, index) => {
        chunksWithEmbeddings.push({
          ...chunk,
          embedding: embeddings[index],
        });
      });

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return chunksWithEmbeddings;
  } catch (error) {
    console.error('Error generating batch embeddings:', error);
    throw error;
  }
}

/**
 * Complete document processing pipeline
 * @param {string} filePath - Path to PDF file
 * @param {Array<string>} validCategories - Optional list of valid categories
 * @returns {Promise<Object>} - {chunks, metadata, category}
 */
export async function processDocument(filePath, validCategories = []) {
  try {
    console.log('Step 1: Extracting PDF content...');
    const { text, pageCount, title, metadata } = await extractPDFContent(filePath);

    console.log('Step 2: Chunking document with structure awareness...');
    const chunks = structureAwareChunk(text, title);

    console.log(`Created ${chunks.length} chunks from ${pageCount} pages`);

    console.log('Step 3: Detecting document category...');
    const sampleChunks = chunks.slice(0, 2);
    const category = await detectCategory(title, sampleChunks, validCategories);

    console.log(`Detected category: ${category}`);

    console.log('Step 4: Generating embeddings in batches...');
    const chunksWithEmbeddings = await batchGenerateEmbeddings(chunks);

    return {
      chunks: chunksWithEmbeddings,
      metadata: {
        title,
        pageCount,
        chunkCount: chunks.length,
        category,
        ...metadata,
      },
    };
  } catch (error) {
    console.error('Error in document processing pipeline:', error);
    throw error;
  }
}

export default {
  extractPDFContent,
  structureAwareChunk,
  detectCategory,
  batchGenerateEmbeddings,
  processDocument,
};
