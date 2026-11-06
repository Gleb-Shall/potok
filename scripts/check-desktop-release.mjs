import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));
const pkg = readJson('package.json');
const config = readJson('src-tauri/tauri.conf.json');
const manifest = readFileSync(new URL('../src-tauri/Cargo.toml',import.meta.url),'utf8');
const tag = process.env.GITHUB_REF_NAME || `v${pkg.version}`;
assert.equal(tag,`v${pkg.version}`,'Release tag must match package.json');
assert.equal(config.version,pkg.version,'Tauri version must match package.json');
assert.equal(manifest.match(/^version\s*=\s*"([^"]+)"/m)?.[1],pkg.version,'Rust version must match package.json');
assert.ok(config.bundle.active,'Installers must be enabled');
assert.ok(!process.env.VITE_FIREBASE_CONFIG,'Public installers must not contain managed Firebase configuration');
assert.ok(readFileSync(new URL('../src-tauri/Cargo.lock',import.meta.url),'utf8').includes('name = "potok"'),'Rust dependencies must be locked');
assert.ok(readFileSync(new URL(`../docs/releases/${tag}.md`,import.meta.url),'utf8').trim(),'Release notes are required');
console.log(`Desktop release ${tag}: versions, local distribution and dependency lock checked.`);
