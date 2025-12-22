import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, '..', 'public');
const WIDGET_JS = join(PUBLIC_DIR, 'widget.iife.js');
const WIDGET_CSS = join(PUBLIC_DIR, 'widget.css');
const OUTPUT_FILE = join(PUBLIC_DIR, 'embed-code.html');
const JSON_OUTPUT = join(PUBLIC_DIR, 'sri-hashes.json');

function generateSRI(filePath) {
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }

  const content = readFileSync(filePath);
  const hash = createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

function main() {
  console.log('Generating SRI hashes...\n');

  const jsHash = generateSRI(WIDGET_JS);
  const cssHash = generateSRI(WIDGET_CSS);

  if (!jsHash) {
    console.error('Failed to generate JS hash');
    process.exit(1);
  }

  console.log(`widget.iife.js: ${jsHash}`);
  if (cssHash) {
    console.log(`widget.css: ${cssHash}`);
  }

  // Get base URL from environment or use default
  const baseUrl = process.env.WIDGET_BASE_URL || 'https://aibot666.onrender.com';

  // Generate embed code HTML
  let embedCode = `<!-- Secure Widget Embed Code with SRI -->
<!-- Generated: ${new Date().toISOString()} -->

<script
  src="${baseUrl}/widget.iife.js"
  integrity="${jsHash}"
  crossorigin="anonymous">
</script>`;

  if (cssHash) {
    embedCode += `
<link
  rel="stylesheet"
  href="${baseUrl}/widget.css"
  integrity="${cssHash}"
  crossorigin="anonymous">`;
  }

  embedCode += `

<!--
  SRI (Subresource Integrity) ensures that the loaded files
  have not been tampered with. If the file content changes,
  the browser will refuse to execute it.

  IMPORTANT: These hashes must be regenerated after every
  widget build. Run: npm run generate-sri
-->
`;

  writeFileSync(OUTPUT_FILE, embedCode);
  console.log(`\nEmbed code written to: ${OUTPUT_FILE}`);

  // Also write JSON for API usage
  const hashes = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    files: {
      'widget.iife.js': jsHash,
      ...(cssHash && { 'widget.css': cssHash })
    }
  };

  writeFileSync(JSON_OUTPUT, JSON.stringify(hashes, null, 2));
  console.log(`SRI hashes JSON written to: ${JSON_OUTPUT}`);

  console.log('\n--- Embed Code ---');
  console.log(embedCode);
}

main();
