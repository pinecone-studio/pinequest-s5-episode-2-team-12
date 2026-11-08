#!/usr/bin/env bun
/**
 * Generate favicon PNGs and ICO from the SVG source.
 * Requires sharp: bun add -D sharp
 */

import { writeFileSync } from 'fs';
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <circle cx="16" cy="16" r="15" fill="#eef3ea"/>
  <path d="M8 14 L6 8 L10 12 Z M24 14 L26 8 L22 12 Z" fill="#141414"/>
  <circle cx="16" cy="16" r="10" fill="#141414"/>
  <path d="M9 13 L8 10 L10 12 Z M23 13 L24 10 L22 12 Z" fill="#2a2a2a"/>
  <circle cx="12" cy="15" r="2" fill="#16a34a"/>
  <circle cx="20" cy="15" r="2" fill="#16a34a"/>
  <circle cx="11" cy="14" r="0.6" fill="#6ee79a"/>
  <circle cx="19" cy="14" r="0.6" fill="#6ee79a"/>
  <ellipse cx="16" cy="18" rx="1.2" ry="0.8" fill="#2a2a2a"/>
  <g stroke="#5d5d58" stroke-width="1" stroke-linecap="round">
    <line x1="8" y1="17" x2="4" y2="16"/>
    <line x1="8" y1="18" x2="4" y2="18"/>
    <line x1="8" y1="19" x2="4" y2="20"/>
    <line x1="24" y1="17" x2="28" y2="16"/>
    <line x1="24" y1="18" x2="28" y2="18"/>
    <line x1="24" y1="19" x2="28" y2="20"/>
  </g>
  <path d="M16 19.5 Q16 21 14 21 M16 19.5 Q16 21 18 21" stroke="#5d5d58" stroke-width="1.2" fill="none" stroke-linecap="round"/>
</svg>`;

const sizes = [16, 32, 48, 64, 128, 180, 192, 512];

async function generate() {
  const pngBuffers: Buffer[] = [];

  for (const size of sizes) {
    const png = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer();

    writeFileSync(`public/favicon-${size}.png`, png);
    console.log(`Generated favicon-${size}.png`);
    pngBuffers.push(png);
  }

  // Generate ICO with multiple sizes (16, 32, 48)
  const icoSizes = [16, 32, 48];
  const icoBuffers = await Promise.all(
    icoSizes.map(size => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer())
  );

  // Simple ICO format writer
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type: ICO
  icoHeader.writeUInt16LE(icoSizes.length, 4); // Number of images

  const dirEntries = Buffer.alloc(icoSizes.length * 16);
  let imageOffset = 6 + icoSizes.length * 16;

  for (let i = 0; i < icoSizes.length; i++) {
    const size = icoSizes[i];
    const imgBuffer = icoBuffers[i];
    const offset = i * 16;

    dirEntries.writeUInt8(size === 256 ? 0 : size, offset);     // Width
    dirEntries.writeUInt8(size === 256 ? 0 : size, offset + 1); // Height
    dirEntries.writeUInt8(0, offset + 2);                        // Color count
    dirEntries.writeUInt8(0, offset + 3);                        // Reserved
    dirEntries.writeUInt16LE(1, offset + 4);                     // Color planes
    dirEntries.writeUInt16LE(32, offset + 6);                    // Bits per pixel
    dirEntries.writeUInt32LE(imgBuffer.length, offset + 8);      // Size of image data
    dirEntries.writeUInt32LE(imageOffset, offset + 12);          // Offset of image data

    imageOffset += imgBuffer.length;
  }

  const icoBuffer = Buffer.concat([icoHeader, dirEntries, ...icoBuffers]);
  writeFileSync('public/favicon.ico', icoBuffer);
  console.log('Generated favicon.ico');

  // Generate Apple touch icon
  const appleTouchIcon = await sharp(Buffer.from(svg))
    .resize(180, 180)
    .png()
    .toBuffer();
  writeFileSync('public/apple-touch-icon.png', appleTouchIcon);
  console.log('Generated apple-touch-icon.png');

  // Generate manifest icons for PWA
  const manifestIcons = [
    { src: '/favicon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/favicon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ];

  console.log('\nDone! Add these to your manifest or layout:');
  manifestIcons.forEach(icon => {
    console.log(`  ${JSON.stringify(icon)}`);
  });
}

generate().catch(console.error);