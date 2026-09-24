// Test helpers: files in site/, read without any dependencies.
import { readFileSync } from 'node:fs';

export const SITE = new URL('../', import.meta.url);
export const siteFile = (rel) => new URL(rel, SITE);
export const readJson = (rel) => JSON.parse(readFileSync(siteFile(rel), 'utf8'));

// A PNG's width and height, from its IHDR chunk.
export function pngSize(rel) {
  const b = readFileSync(siteFile(rel));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
