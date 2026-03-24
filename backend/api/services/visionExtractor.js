import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
const VISION_CONCURRENCY = parseInt(process.env.VISION_CONCURRENCY) || 3;
const VISION_MAX_PAGES = parseInt(process.env.VISION_MAX_PAGES) || 50;

/**
 * Extract and interpret text from a single page image using vision model.
 * Converts tables/charts into natural language. Uses [SECTION: Title] markers.
 * @param {Buffer} imageBuffer - PNG image buffer
 * @param {number} pageNum - Page number (for logging)
 * @returns {Promise<string>} Extracted and interpreted text
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
          text: `Extract and INTERPRET all text from this document page into clear, readable natural language.

RULES:
1. SECTION MARKERS: When you encounter a heading, title, or new topic section, output it on its own line as: [SECTION: Exact Title Here]
2. NO MARKDOWN: Do not use #, ##, **, ***, ---, or | table syntax. Output plain text only.
3. TABLES TO SENTENCES: Convert every table into natural language sentences that preserve ALL exact figures, amounts, and column relationships. Example: "For Plan A, the annual limit is $500 and the co-payment is 20%."
4. CHARTS AND DIAGRAMS: Describe what the chart or diagram shows using specific data points and figures from it.
5. LISTS: Use simple "- " prefix for list items. Keep them as individual lines.
6. PRESERVE FACTS: Keep exact dollar amounts, percentages, dates, policy names, coverage limits, medical terms, and proper nouns verbatim. Do not round, paraphrase, or approximate any number.
7. READING ORDER: Process content top to bottom, left to right.
8. NO COMMENTARY: Do not add summaries, opinions, interpretations beyond what is written, or descriptions of logos/images/decorative elements.
9. SELF-CONTAINED: Write each paragraph so it can be understood on its own without needing context from other pages.
10. CONTINUATIONS: If a section clearly continues from a previous page (no new heading at the top), begin the output directly with the content — do not invent a section marker.`
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
 * Stream-process PDF pages: render → extract → discard one batch at a time.
 * Never holds more than VISION_CONCURRENCY page images in memory.
 *
 * @param {Buffer} pdfBuffer - Raw PDF buffer
 * @param {number} pageCount - Total page count (from metadata)
 * @param {Function} onProgress - Progress callback (pagesProcessed, totalPages)
 * @returns {Promise<{text: string, method: string, pagesProcessed: number}|null>}
 */
export async function extractPdfWithVision(pdfBuffer, pageCount, onProgress = null) {
  const maxPages = Math.min(pageCount, VISION_MAX_PAGES);

  if (maxPages < pageCount) {
    console.warn(`[VisionExtractor] PDF has ${pageCount} pages, processing first ${maxPages} only`);
  }

  let pdfModule;
  try {
    pdfModule = await import('pdf-to-img');
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('[VisionExtractor] pdf-to-img not installed. Run: npm install pdf-to-img');
      return null;
    }
    throw error;
  }

  console.log(`[VisionExtractor] Streaming ${maxPages} pages (concurrency=${VISION_CONCURRENCY}) using ${VISION_MODEL}...`);

  const pageTexts = [];
  let batch = [];
  let pageIdx = 0;

  const doc = await pdfModule.pdf(pdfBuffer, { scale: 2 });

  for await (const imageBuffer of doc) {
    if (pageIdx >= maxPages) break;

    batch.push({ buffer: imageBuffer, pageNum: pageIdx + 1 });

    // When batch is full or we've reached the last page, extract the batch
    if (batch.length >= VISION_CONCURRENCY || pageIdx >= maxPages - 1) {
      const batchPromises = batch.map(({ buffer, pageNum }) =>
        extractPageWithVision(buffer, pageNum)
          .catch(err => {
            console.warn(`[VisionExtractor] Page ${pageNum} extraction failed:`, err.message);
            return `[Page ${pageNum}: extraction failed]`;
          })
      );

      const batchResults = await Promise.all(batchPromises);
      pageTexts.push(...batchResults);

      if (onProgress) onProgress(pageIdx + 1, maxPages);

      // Discard batch — free memory before next batch
      batch = [];

      // Small delay between batches to avoid rate limits
      if (pageIdx < maxPages - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    pageIdx++;
  }

  const combinedText = pageTexts
    .filter(t => t && t.trim().length > 0)
    .join('\n\n');

  console.log(`[VisionExtractor] Total extracted: ${combinedText.length} chars from ${pageIdx} pages`);

  return {
    text: combinedText,
    method: 'vision',
    pagesProcessed: pageIdx,
  };
}

export default {
  extractPdfWithVision,
};
