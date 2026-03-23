import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
const VISION_CONCURRENCY = parseInt(process.env.VISION_CONCURRENCY) || 3;
const VISION_MAX_PAGES = parseInt(process.env.VISION_MAX_PAGES) || 50;

/**
 * Convert PDF pages to PNG image buffers using pdf-to-img v5
 * @param {Buffer} pdfBuffer - Raw PDF file buffer
 * @param {Object} options
 * @param {number} options.scale - Render scale (default 2 for good quality)
 * @param {number} options.maxPages - Max pages to convert
 * @returns {Promise<Buffer[]>} Array of PNG buffers
 */
export async function convertPdfToImages(pdfBuffer, { scale = 2, maxPages = VISION_MAX_PAGES } = {}) {
  try {
    const { pdf } = await import('pdf-to-img');

    const images = [];
    const doc = await pdf(pdfBuffer, { scale });

    for await (const image of doc) {
      images.push(image);
      if (images.length >= maxPages) break;
    }

    console.log(`[VisionExtractor] Converted ${images.length} pages to PNG images`);
    return images;
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('[VisionExtractor] pdf-to-img not installed. Run: npm install pdf-to-img');
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

  const text = response.choices[0].message.content || '';
  console.log(`[VisionExtractor] Page ${pageNum}: extracted ${text.length} chars`);
  return text;
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
 * Full vision extraction pipeline for PDF
 * @param {Buffer} pdfBuffer - Raw PDF buffer
 * @param {number} pageCount - Total page count
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{text: string, method: string, pagesProcessed: number}|null>}
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

  console.log(`[VisionExtractor] Total extracted: ${combinedText.length} chars from ${images.length} pages`);

  return {
    text: combinedText,
    method: 'vision',
    pagesProcessed: images.length,
  };
}

export default {
  convertPdfToImages,
  extractPdfWithVision,
};
