import OpenAI from 'openai';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
const VISION_CONCURRENCY = parseInt(process.env.VISION_CONCURRENCY) || 3;
const VISION_MAX_PAGES = parseInt(process.env.VISION_MAX_PAGES) || 50;
const SCANNED_THRESHOLD_CHARS_PER_PAGE = 100;

/**
 * Detect whether a PDF is likely scanned (image-based) rather than text-based
 * @param {string} text - Extracted text from pdf-parse
 * @param {number} pageCount - Number of pages
 * @returns {boolean}
 */
export function isLikelyScanned(text, pageCount) {
  if (!text || !pageCount || pageCount === 0) return true;
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const avgCharsPerPage = cleanText.length / pageCount;
  return avgCharsPerPage < SCANNED_THRESHOLD_CHARS_PER_PAGE;
}

/**
 * Convert PDF pages to PNG image buffers using pdf-to-img
 * Falls back gracefully if native canvas deps are missing
 * @param {Buffer} pdfBuffer - Raw PDF file buffer
 * @param {Object} options
 * @param {number} options.scale - Render scale (default 2 for good quality)
 * @param {number} options.maxPages - Max pages to convert
 * @returns {Promise<Buffer[]>} Array of PNG buffers
 */
export async function convertPdfToImages(pdfBuffer, { scale = 2, maxPages = VISION_MAX_PAGES } = {}) {
  try {
    const { convert } = await import('pdf-to-img');

    const images = [];
    const result = await convert(pdfBuffer, { scale });

    for await (const image of result) {
      images.push(image);
      if (images.length >= maxPages) break;
    }

    return images;
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message?.includes('canvas')) {
      console.warn('[VisionExtractor] pdf-to-img not available (missing canvas native deps). Skipping vision extraction.');
      console.warn('[VisionExtractor] To enable: npm install pdf-to-img canvas');
      return null;
    }
    throw error;
  }
}

/**
 * Extract text from a single page image using GPT-4o-mini vision
 * @param {Buffer} imageBuffer - PNG image buffer
 * @param {number} pageNum - Page number (for logging)
 * @returns {Promise<string>} Extracted text
 */
async function extractPageWithVision(imageBuffer, pageNum) {
  const base64 = imageBuffer.toString('base64');

  const response = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Extract ALL text from this document page. Rules:
- Preserve structure: headings, bullet points, numbered lists, paragraphs
- Reproduce tables as markdown tables with | separators
- Keep the original reading order (top to bottom, left to right)
- Do NOT add commentary, summaries, or descriptions of images/logos
- Return ONLY the extracted text content`
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64}`,
            detail: 'high'
          }
        }
      ]
    }],
    max_tokens: 4096,
    temperature: 0,
  });

  return response.choices[0].message.content || '';
}

/**
 * Process multiple pages in parallel batches
 * @param {Buffer[]} images - Array of PNG buffers
 * @param {number} concurrency - Max parallel requests
 * @param {Function} onProgress - Progress callback (pagesProcessed, totalPages)
 * @returns {Promise<string[]>} Array of extracted text per page
 */
async function batchExtractPages(images, concurrency = VISION_CONCURRENCY, onProgress = null) {
  const results = new Array(images.length);

  for (let i = 0; i < images.length; i += concurrency) {
    const batch = images.slice(i, i + concurrency);
    const batchPromises = batch.map((img, idx) =>
      extractPageWithVision(img, i + idx + 1)
        .catch(err => {
          console.warn(`[VisionExtractor] Page ${i + idx + 1} extraction failed:`, err.message);
          return `[Page ${i + idx + 1}: extraction failed]`;
        })
    );

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach((text, idx) => {
      results[i + idx] = text;
    });

    if (onProgress) onProgress(Math.min(i + concurrency, images.length), images.length);

    if (i + concurrency < images.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

/**
 * Full vision extraction pipeline for a scanned PDF
 * @param {Buffer} pdfBuffer - Raw PDF buffer
 * @param {number} pageCount - Total page count (from pdf-parse)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{text: string, method: string, pagesProcessed: number}|null>}
 *   Returns null if vision extraction is unavailable
 */
export async function extractPdfWithVision(pdfBuffer, pageCount, onProgress = null) {
  const pagesToProcess = Math.min(pageCount, VISION_MAX_PAGES);

  if (pagesToProcess < pageCount) {
    console.warn(`[VisionExtractor] PDF has ${pageCount} pages, processing first ${pagesToProcess} only`);
  }

  console.log(`[VisionExtractor] Converting ${pagesToProcess} pages to images...`);
  const images = await convertPdfToImages(pdfBuffer, { maxPages: pagesToProcess });

  if (!images) return null;

  console.log(`[VisionExtractor] Extracting text from ${images.length} pages using ${VISION_MODEL}...`);
  const pageTexts = await batchExtractPages(images, VISION_CONCURRENCY, onProgress);

  const combinedText = pageTexts
    .filter(t => t && t.trim().length > 0)
    .join('\n\n');

  console.log(`[VisionExtractor] Extracted ${combinedText.length} chars from ${images.length} pages`);

  return {
    text: combinedText,
    method: 'vision',
    pagesProcessed: images.length,
  };
}

export default {
  isLikelyScanned,
  convertPdfToImages,
  extractPdfWithVision,
};
