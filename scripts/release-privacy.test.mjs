import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectFile, auditDirectory } from './release-privacy.mjs';

test('rejects private filenames and source maps, including nested dotfiles', () => {
  for (const file of ['.env.production', '.git/config', 'assets/upload.p12', 'assets/index.js.map', 'release/testers.json']) {
    assert.ok(inspectFile(file, Buffer.from('')).some(x => x.category === 'private artifact'));
  }
});
test('finds Windows slash variants and native binary home paths without printing values', () => {
  for (const privatePath of ['C:\\Users\\synthetic-person\\file', 'C:/Users/synthetic-person/file', '/Users/synthetic-person/build', '/home/synthetic-person/build']) {
    const result = inspectFile('native-binary', Buffer.from('\0' + privatePath + '\0'));
    assert.equal(result[0].category, 'local filesystem path');
    assert.ok(!JSON.stringify(result).includes('synthetic-person'));
  }
});
test('rejects credential-shaped content and inline source map references', () => {
  assert.ok(inspectFile('bundle.js', Buffer.from('github_pat_' + 'a'.repeat(40))).length);
  assert.ok(inspectFile('bundle.js', Buffer.from('//# sourceMappingURL=data:application/json;base64,e30=')).length);
});
test('keeps intended support contact, business disclosure and dependency copyright', () => {
  assert.deepEqual(inspectFile('index.html', Buffer.from('support@example.com BYTECH, LLC Copyright author@example.com')), []);
});
test('scans actual output and fails empty or missing output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'privacy-test-'));
  try {
    assert.equal(auditDirectory(dir).findings[0].category, 'empty release output');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'bundle.js'), '// sourceMappingURL=bundle.js.map');
    assert.equal(auditDirectory(dir).findings[0].file, 'assets/bundle.js');
    assert.throws(() => auditDirectory(join(dir, 'missing')));
  } finally { rmSync(dir, { recursive: true }); }
});

test('attribution checks actual author and committer without changing Git configuration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'attribution-test-'));
  const script = fileURLToPath(new URL('./check-release-attribution.mjs', import.meta.url));
  const identity = { ...process.env, GIT_AUTHOR_NAME: 'Synthetic Author', GIT_AUTHOR_EMAIL: 'synthetic@example.test', GIT_COMMITTER_NAME: 'Synthetic Author', GIT_COMMITTER_EMAIL: 'synthetic@example.test' };
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: dir });
    execFileSync('git', ['-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'fixture'], { cwd: dir, env: identity });
    const env = { ...process.env, RELEASE_APPROVED_GIT_NAME: 'Synthetic Author', RELEASE_APPROVED_GIT_EMAIL: 'synthetic@example.test' };
    assert.equal(spawnSync(process.execPath, [script, 'HEAD'], { cwd: dir, env }).status, 0);
    env.RELEASE_APPROVED_GIT_EMAIL = 'other@example.test';
    const rejected = spawnSync(process.execPath, [script, 'HEAD'], { cwd: dir, env, encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.ok(!rejected.stderr.includes('synthetic@example.test'));
    assert.ok(!rejected.stderr.includes('Synthetic Author'));
  } finally { rmSync(dir, { recursive: true }); }
});

test('rejects root and nested directory links without following them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'privacy-links-'));
  try {
    const target = join(dir, 'target'), linked = join(dir, 'linked'), output = join(dir, 'output');
    mkdirSync(target); mkdirSync(output);
    writeFileSync(join(target, 'safe.html'), 'safe');
    symlinkSync(target, linked, process.platform === 'win32' ? 'junction' : 'dir');
    symlinkSync(target, join(output, 'nested'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.deepEqual(auditDirectory(linked), { files: 0, findings: [{ file: '.', category: 'symlink in release output' }] });
    assert.ok(auditDirectory(output).findings.some(x => x.category === 'symlink in release output'));
    assert.equal(auditDirectory(output).files, 0);
    assert.equal(auditDirectory(target).files, 1);
  } finally { rmSync(dir, { recursive: true }); }
});
test('rejects empty private directories even when other public files exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'privacy-empty-private-'));
  try {
    mkdirSync(join(dir, '.git'));
    writeFileSync(join(dir, 'index.html'), 'safe');
    assert.ok(auditDirectory(dir).findings.some(x => x.file === '.git' && x.category === 'private artifact'));
  } finally { rmSync(dir, { recursive: true }); }
});
