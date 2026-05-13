const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const htmlPath = path.resolve(__dirname, 'architecture.html');
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });

  // Wait for Mermaid to render
  await page.waitForTimeout(4000);

  // Get all diagram sections
  const sections = await page.$$('.diagram-section');
  console.log(`Found ${sections.length} diagrams`);

  const outDir = __dirname;

  for (let i = 0; i < sections.length; i++) {
    const el = sections[i];
    const title = await el.$eval('.diagram-title', t => t.textContent.trim());
    const filename = `${String(i + 1).padStart(2, '0')}-${title.replace(/[\/\s]/g, '_')}.png`;

    // Add padding for screenshot
    await el.screenshot({
      path: path.join(outDir, filename),
      padding: { top: 20, bottom: 20, left: 20, right: 20 },
    });
    console.log(`Saved: ${filename}`);
  }

  // Also take a full-page shot
  await page.screenshot({
    path: path.join(outDir, 'all-diagrams.png'),
    fullPage: true,
  });
  console.log('Saved: all-diagrams.png');

  await browser.close();
  console.log('Done!');
})();
