import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readJson, siteFile } from './helpers.js';

const html = readFileSync(siteFile('../index.html'), 'utf8');
const links = [...html.matchAll(/<a href="([^"]*)" data-game="([^"]*)">([\s\S]*?)<\/a>/g)].map(([, href, id, body]) => ({ href, id, body }));

test('the page lists exactly the games in games.json, in order, each linking to its folder', () => {
  assert.deepEqual(links.map((l) => l.id), readJson('games.json').games.map((g) => g.id));
  for (const { href, id } of links) {
    assert.equal(href, `./${id}/`);
    assert.ok(existsSync(siteFile(`../${id}/index.html`)), `${id}/index.html exists`);
  }
});

test('each link carries the words for its sign: a name, a blurb and the controls', () => {
  for (const { id, body } of links) {
    assert.match(body, /^<strong>[^<]+<\/strong> <span class="blurb">[^<]+<\/span> <span class="controls">[^<]+<\/span>$/, id);
  }
});

test('the page starts the scene as a module, and keeps the plain list as the fallback', () => {
  assert.match(html, /<canvas id="scene" aria-hidden="true"><\/canvas>/);
  assert.match(html, /<script type="module" src="\.\/site\/main\.js"><\/script>/);
  assert.match(html, /<script nomodule>document\.documentElement\.classList\.remove\('js'\);<\/script>/);
  assert.match(html, /document\.documentElement\.classList\.add\('js'\);/);
});
