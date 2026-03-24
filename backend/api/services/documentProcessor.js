import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { generateEmbeddingsBatch } from './openai.js';
import { extractPdfWithVision } from './visionExtractor.js';
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
const APPROX_CHARS_PER_TOKEN = 4;

// Supported file extensions
const SUPPORTED_FORMATS = ['.pdf', '.docx', '.txt', '.csv'];

/**
 * Generate SHA-256 hash of a file for duplicate detection
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function generateFileHash(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Detect file format from extension
 * @param {string} filePath
 * @returns {string} Format identifier: 'pdf' | 'docx' | 'txt' | 'csv'
 */
export function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  if (ext === '.txt') return 'txt';
  if (ext === '.csv') return 'csv';
  return 'unknown';
}

/**
 * Extract text and metadata from PDF file
 * Uses vision model for content extraction, pdf-parse only for metadata
 * @param {string} filePath - Path to PDF file
 * @param {Function} onProgress - Progress callback for vision extraction
 * @returns {Promise<Object>} - {text, pageCount, title, metadata, extractionMethod}
 */
export async function extractPDFContent(filePath, onProgress = null) {
  const dataBuffer = await fs.readFile(filePath);

  // Use pdf-parse only for metadata (title, page count, author)
  const data = await pdf(dataBuffer);

  const title = data.info?.Title ||
    filePath.split(/[/\\]/).pop().replace('.pdf', '') ||
    'Untitled Document';

  const baseMetadata = {
    author: data.info?.Author,
    subject: data.info?.Subject,
    keywords: data.info?.Keywords,
    creationDate: data.info?.CreationDate,
  };

  const pageCount = data.numpages || 1;
  console.log(`[DocumentProcessor] PDF: ${pageCount} pages, title="${title.trim()}"`);

  // Always use vision model for PDF content extraction
  console.log(`[DocumentProcessor] Using vision extraction for all ${pageCount} pages...`);
  const visionResult = await extractPdfWithVision(dataBuffer, pageCount, onProgress);

  if (visionResult && visionResult.text.trim().length > 0) {
    console.log(`[DocumentProcessor] Vision extraction succeeded: ${visionResult.text.length} chars from ${visionResult.pagesProcessed} pages`);
    return {
      text: visionResult.text,
      pageCount,
      title: title.trim(),
      metadata: baseMetadata,
      extractionMethod: 'vision',
    };
  }

  // Fallback to pdf-parse text if vision fails (e.g. pdf-to-img not installed)
  console.warn(`[DocumentProcessor] Vision extraction failed, falling back to pdf-parse text`);
  return {
    text: data.text,
    pageCount,
    title: title.trim(),
    metadata: baseMetadata,
    extractionMethod: 'text',
  };
}

/**
 * Extract text from .docx file using mammoth
 * @param {string} filePath
 * @returns {Promise<Object>} - {text, title, metadata}
 */
export async function extractDocxContent(filePath) {
  try {
    const mammoth = await import('mammoth');
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || '';
    const title = path.basename(filePath, '.docx');

    return {
      text,
      pageCount: Math.max(1, Math.ceil(text.length / 3000)),
      title,
      metadata: {},
      extractionMethod: 'docx',
    };
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('mammoth package not installed. Run: npm install mammoth');
    }
    throw new Error(`Failed to extract DOCX: ${error.message}`);
  }
}

/**
 * Extract text from .txt or .csv file
 * @param {string} filePath
 * @returns {Promise<Object>} - {text, title, metadata}
 */
export async function extractTextContent(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  const title = path.basename(filePath, ext);

  return {
    text,
    pageCount: Math.max(1, Math.ceil(text.length / 3000)),
    title,
    metadata: {},
    extractionMethod: ext === '.csv' ? 'csv' : 'text',
  };
}

/**
 * Route to the correct extractor based on file format
 * @param {string} filePath
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Extraction result
 */
export async function extractContent(filePath, onProgress = null) {
  const format = detectFormat(filePath);

  switch (format) {
    case 'pdf':
      return extractPDFContent(filePath, onProgress);
    case 'docx':
      return extractDocxContent(filePath);
    case 'txt':
    case 'csv':
      return extractTextContent(filePath);
    default:
      throw new Error(`Unsupported file format: ${path.extname(filePath)}`);
  }
}

/**
 * Clean markdown artifacts from title text
 * @param {string} rawTitle - Raw title possibly containing markdown/markers
 * @returns {string} - Cleaned title
 */
export function cleanTitle(rawTitle) {
  if (!rawTitle) return '';
  let title = rawTitle
    .replace(/^\[SECTION:\s*/, '').replace(/\]$/, '')  // [SECTION: Title]
    .replace(/^#{1,6}\s*/, '')                          // ## Heading
    .replace(/\*{1,3}/g, '')                            // **bold**, *italic*
    .replace(/^\d+\.\d*\s+/, '')                        // 1. or 1.2
    .trim();
  return title.length >= 3 ? title : '';
}

/**
 * Clean markdown artifacts from body text (for non-vision or legacy content)
 * @param {string} text - Raw text with potential markdown
 * @returns {string} - Cleaned text
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s+/gm, '')                       // heading prefixes
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')           // bold/italic markers
    .replace(/^-{3,}$/gm, '')                           // horizontal rules
    .replace(/^\|[-:|\s]+\|$/gm, '')                    // table separator rows |---|---|
    .replace(/^\|(.+)\|$/gm, (_, row) =>                // table data rows → comma-separated
      row.split('|').map(c => c.trim()).filter(Boolean).join(', ')
    )
    .replace(/\n{3,}/g, '\n\n')                         // collapse multiple blank lines
    .trim();
}

/**
 * Detect section headings in text.
 * Strategy A: [SECTION: Title] markers from vision prompt (preferred).
 * Strategy B: Fallback regex patterns for legacy/non-vision text.
 * @param {string} text - Full document text
 * @returns {Array<Object>} - Detected sections with {heading, cleanHeading, startIndex, lineIndex}
 */
function detectSections(text) {
  const lines = text.split('\n');

  // Strategy A: [SECTION: Title] markers from the new vision prompt
  const sectionMarkerRegex = /^\[SECTION:\s*(.+?)\]$/;
  const markerSections = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(sectionMarkerRegex);
    if (match) {
      const precedingText = lines.slice(0, i).join('\n');
      markerSections.push({
        heading: lines[i].trim(),
        cleanHeading: match[1].trim(),
        startIndex: precedingText.length + (precedingText.length > 0 ? 1 : 0),
        lineIndex: i,
      });
    }
  }

  if (markerSections.length >= 2) {
    return markerSections;
  }

  // Strategy B: Fallback regex for legacy content (removed over-broad pattern 4)
  const sections = [];
  const headingPatterns = [
    /^[A-Z][A-Z\s]{3,}$/,                          // ALL CAPS headings
    /^\d+\.\s+[A-Z][^.!?]+$/,                      // "1. Section Name"
    /^(Section|Chapter|Part)\s+\d+[:\.]?/i,         // "Section 1:"
    /^#{1,6}\s+.+$/,                                // Markdown ## headings (legacy)
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isHeading = headingPatterns.some(pattern => pattern.test(line));

    if (isHeading && line.length > 3 && line.length < 100) {
      const precedingText = lines.slice(0, i).join('\n');
      sections.push({
        heading: line,
        cleanHeading: cleanTitle(line),
        startIndex: precedingText.length + (precedingText.length > 0 ? 1 : 0),
        lineIndex: i,
      });
    }
  }

  return sections;
}

// Minimum content chars for a chunk to be useful for RAG
const MIN_CONTENT_CHARS = 50;

/**
 * Structure-aware text chunking with quality filters.
 * Separates heading from content body, filters empty chunks, merges duplicates.
 * @param {string} text - Full document text
 * @param {string} title - Document title
 * @returns {Array<Object>} - Array of chunks with metadata
 */
export function structureAwareChunk(text, title = '') {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const sections = detectSections(text);

  if (sections.length === 0) {
    return simpleChunk(cleanText(text), title);
  }

  const chunks = [];

  // Capture preamble text before the first section
  if (sections[0].startIndex > 0) {
    const preamble = cleanText(text.slice(0, sections[0].startIndex).trim());
    if (preamble.length >= MIN_CONTENT_CHARS) {
      chunks.push({
        content: preamble,
        heading: '',
        chunkIndex: 0,
        metadata: { hasHeading: false, sectionIndex: -1, estimatedTokens: Math.ceil(preamble.length / APPROX_CHARS_PER_TOKEN) },
      });
    }
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const nextSection = sections[i + 1];
    const sectionEnd = nextSection ? nextSection.startIndex : text.length;

    // Slice raw section text then strip the heading line from content body
    const rawSection = text.slice(section.startIndex, sectionEnd).trim();
    const headingLine = section.heading;
    const contentBody = cleanText(
      rawSection.startsWith(headingLine)
        ? rawSection.slice(headingLine.length).trim()
        : rawSection
    );

    const sectionHeading = section.cleanHeading || cleanTitle(headingLine);
    const estimatedTokens = Math.ceil(contentBody.length / APPROX_CHARS_PER_TOKEN);

    if (estimatedTokens <= MAX_CHUNK_TOKENS) {
      chunks.push({
        content: contentBody,
        heading: sectionHeading,
        chunkIndex: chunks.length,
        metadata: { hasHeading: true, sectionIndex: i, estimatedTokens },
      });
    } else {
      const subChunks = splitLargeSection(contentBody, sectionHeading);
      subChunks.forEach((sub, idx) => {
        chunks.push({
          content: sub.content,
          heading: sub.heading,
          chunkIndex: chunks.length,
          metadata: {
            hasHeading: true,
            sectionIndex: i,
            subChunkIndex: idx,
            estimatedTokens: Math.ceil(sub.content.length / APPROX_CHARS_PER_TOKEN),
          },
        });
      });
    }
  }

  // Merge consecutive chunks with identical headings where the first is short
  for (let i = chunks.length - 1; i > 0; i--) {
    const prev = chunks[i - 1];
    const curr = chunks[i];
    if (prev.heading && prev.heading === curr.heading && prev.content.length < 200) {
      curr.content = prev.content + '\n\n' + curr.content;
      curr.metadata.estimatedTokens = Math.ceil(curr.content.length / APPROX_CHARS_PER_TOKEN);
      chunks.splice(i - 1, 1);
    }
  }

  // Filter out near-empty chunks
  const filtered = chunks.filter(chunk => {
    if (chunk.content.trim().length < MIN_CONTENT_CHARS) {
      console.log(`[Chunker] Skipping near-empty chunk: "${chunk.heading}" (${chunk.content.trim().length} chars)`);
      return false;
    }
    return true;
  });

  return filtered.map((chunk, index) => ({
    ...chunk,
    title: chunk.heading || title,
    chunkIndex: index,
  }));
}

/**
 * Simple token-based chunking with overlap (fallback)
 */
function simpleChunk(text, title = '') {
  const chunks = [];
  const maxChunkChars = MAX_CHUNK_TOKENS * APPROX_CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;

  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + maxChunkChars, text.length);
    let chunk = text.slice(startIndex, endIndex);

    if (endIndex < text.length) {
      const lastPeriod = chunk.lastIndexOf('. ');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > maxChunkChars * 0.7) {
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

    startIndex += chunk.length - overlapChars;

    if (chunk.length === 0) {
      startIndex += maxChunkChars;
    }
  }

  return chunks;
}

/**
 * Split a large section's content body into smaller chunks.
 * Heading is tracked separately — NOT embedded into content.
 * @param {string} contentBody - Section content WITHOUT heading line
 * @param {string} heading - Clean heading text (tracked separately)
 * @returns {Array<{content: string, heading: string}>}
 */
function splitLargeSection(contentBody, heading) {
  const chunks = [];
  const maxChunkChars = MAX_CHUNK_TOKENS * APPROX_CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;

  let startIndex = 0;

  while (startIndex < contentBody.length) {
    const endIndex = Math.min(startIndex + maxChunkChars, contentBody.length);
    let chunkContent = contentBody.slice(startIndex, endIndex);

    if (endIndex < contentBody.length) {
      const lastPeriod = chunkContent.lastIndexOf('. ');
      const lastNewline = chunkContent.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > maxChunkChars * 0.7) {
        chunkContent = chunkContent.slice(0, breakPoint + 1);
      }
    }

    chunks.push({ content: chunkContent.trim(), heading });

    startIndex += chunkContent.length - overlapChars;

    if (chunkContent.length === 0) {
      startIndex += maxChunkChars;
    }
  }

  return chunks;
}

/**
 * Detect document category using AI analysis
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
      .slice(0, 2000);

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

    if (validCategories.length > 0) {
      const matchedCategory = validCategories.find(
        cat => cat.toLowerCase() === detectedCategory.toLowerCase()
      );
      return matchedCategory || 'General';
    }

    return detectedCategory || 'General';
  } catch (error) {
    console.error('Error detecting category:', error);
    return 'General';
  }
}

/**
 * Generate embeddings for chunks in batches
 * @param {Array<Object>} chunks - Array of chunk objects
 * @returns {Promise<Array<Object>>} - Chunks with embeddings added
 */
export async function batchGenerateEmbeddings(chunks) {
  const BATCH_SIZE = 100;
  const chunksWithEmbeddings = [];

  try {
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      // Prepend heading to content for embedding (matches Q&A entry format for consistent similarity)
      const texts = batch.map(chunk => {
        const heading = cleanTitle(chunk.heading || chunk.title || '');
        const content = chunk.content;
        // Safety: prevent double-heading if content already starts with the heading
        const alreadyHasHeading = heading && content.trimStart().toLowerCase().startsWith(heading.toLowerCase());
        return alreadyHasHeading ? content : (heading ? `${heading}\n\n${content}` : content);
      });

      console.log(`Generating embeddings for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);

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
            const delay = Math.pow(2, retries) * 1000;
            console.log(`Rate limit hit, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error;
          }
        }
      }

      batch.forEach((chunk, index) => {
        if (embeddings[index] === null) {
          console.warn(`Skipping chunk "${chunk.heading || chunk.title || index}" — empty content, no embedding generated`);
          return;
        }
        chunksWithEmbeddings.push({
          ...chunk,
          embedding: embeddings[index],
        });
      });

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
 * Complete document processing pipeline (supports all formats)
 * @param {string} filePath - Path to document file
 * @param {Array<string>} validCategories - Optional list of valid categories
 * @param {Function} onStepProgress - Callback: (step, detail) for step-level progress
 * @returns {Promise<Object>} - {chunks, metadata, category}
 */
export async function processDocument(filePath, validCategories = [], onStepProgress = null) {
  try {
    const format = detectFormat(filePath);
    const step = (name, detail) => {
      console.log(`[${name}] ${detail}`);
      if (onStepProgress) onStepProgress(name, detail);
    };

    step('extracting', `Extracting content from ${format.toUpperCase()} file...`);
    const { text, pageCount, title, metadata, extractionMethod } = await extractContent(filePath, (done, total) => {
      step('extracting', `Vision processing page ${done}/${total}`);
    });

    if (!text || text.trim().length === 0) {
      throw new Error('No text content could be extracted from the document');
    }

    step('chunking', 'Splitting document into chunks...');
    const chunks = structureAwareChunk(text, title);
    step('chunking', `Created ${chunks.length} chunks from ${pageCount || 1} pages`);

    step('categorizing', 'Detecting document category...');
    const sampleChunks = chunks.slice(0, 2);
    const category = await detectCategory(title, sampleChunks, validCategories);
    step('categorizing', `Category: ${category}`);

    step('embedding', 'Generating embeddings...');
    const chunksWithEmbeddings = await batchGenerateEmbeddings(chunks);
    step('embedding', `Embedded ${chunksWithEmbeddings.length} chunks`);

    return {
      chunks: chunksWithEmbeddings,
      metadata: {
        title,
        pageCount: pageCount || 1,
        chunkCount: chunks.length,
        category,
        extractionMethod: extractionMethod || format,
        ...metadata,
      },
    };
  } catch (error) {
    console.error('Error in document processing pipeline:', error);
    throw error;
  }
}

export { SUPPORTED_FORMATS };

export default {
  extractPDFContent,
  extractDocxContent,
  extractTextContent,
  extractContent,
  structureAwareChunk,
  detectCategory,
  batchGenerateEmbeddings,
  processDocument,
  generateFileHash,
  detectFormat,
  cleanTitle,
  SUPPORTED_FORMATS,
};
