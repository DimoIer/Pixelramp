import { chromium } from 'playwright-core';
import fs from 'node:fs';
import pngToIco from 'png-to-ico';

const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
fs.mkdirSync('build/icons', { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const paths = [];
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden}
    svg{display:block;width:100%;height:100%}
  </style></head><body>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1b1e16"/>
          <stop offset="1" stop-color="#0d0f0b"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.45"/>
        </filter>
        <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#9ac0e0"/><stop offset="1" stop-color="#6f9cc4"/>
        </linearGradient>
        <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#bacba2"/><stop offset="1" stop-color="#8ca076"/>
        </linearGradient>
        <linearGradient id="c" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7c8a64"/><stop offset="1" stop-color="#58654a"/>
        </linearGradient>
        <linearGradient id="d" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#efd3a2"/><stop offset="1" stop-color="#d3ac78"/>
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)" stroke="#3b4131" stroke-width="3"/>
      <g filter="url(#shadow)">
        <rect x="88" y="88" width="146" height="146" rx="22" fill="url(#a)"/>
        <rect x="278" y="88" width="146" height="146" rx="22" fill="url(#b)"/>
        <rect x="88" y="278" width="146" height="146" rx="22" fill="url(#c)"/>
        <rect x="278" y="278" width="146" height="146" rx="22" fill="url(#d)"/>
      </g>
      <path d="M88 434 H424" stroke="#d7f36b" stroke-opacity=".35" stroke-width="2"/>
    </svg>
  </body></html>`);
  const buffer = await page.screenshot({ omitBackground: true });
  const file = `build/icons/icon-${size}.png`;
  fs.writeFileSync(file, buffer);
  paths.push(file);
  await page.close();
}
const ico = await pngToIco(paths.filter((p) => !p.includes('512')));
fs.writeFileSync('build/icon.ico', ico);
fs.copyFileSync('build/icons/icon-512.png', 'build/icon.png');
console.log('icon.ico bytes:', fs.statSync('build/icon.ico').size);
console.log('icon.png bytes:', fs.statSync('build/icon.png').size);
await browser.close();
