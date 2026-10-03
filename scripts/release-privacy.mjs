import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Report categories and filenames only; never echo matching private values.
export function inspectFile(name, bytes) {
  const issues = [];
  const normalized = name.replaceAll('\\', '/');
  if (/(^|\/)(\.git|\.svn|node_modules|\.env(?:\.[^/]*)?|testers(?:\.local)?\.json)(\/|$)|\.(map|pem|key|p12|p8|jks|keystore|mobileprovision)$/i.test(normalized)) issues.push('private artifact');
  const body = bytes.toString('utf8');
  if (/(?:[A-Z]:[\\/](?:Users|AI)[\\/]|\/(?:Users|home)\/)[^\s/\\]+[\\/]/i.test(body)) issues.push('local filesystem path');
  if (/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{35}/.test(body)) issues.push('credential-shaped content');
  if (/sourceMappingURL\s*=/.test(body)) issues.push('source map reference');
  return issues.map(category => ({ file: normalized, category }));
}

export function auditDirectory(directory) {
  const root = resolve(directory), findings = [];
  let files = 0;
  const rootStat = lstatSync(root);
  if (rootStat.isSymbolicLink()) return { files, findings: [{ file: '.', category: 'symlink in release output' }] };
  if (!rootStat.isDirectory()) throw new Error('release output must be a directory');
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name), stat = lstatSync(full);
      const file = relative(root, full).replaceAll('\\', '/');
      if (stat.isSymbolicLink()) findings.push({ file, category: 'symlink in release output' });
      else if (stat.isDirectory()) {
        findings.push(...inspectFile(file, Buffer.alloc(0)));
        walk(full);
      }
      else if (stat.isFile()) { files++; findings.push(...inspectFile(file, readFileSync(full))); }
      else findings.push({ file, category: 'unsupported release entry' });
    }
  }
  walk(root);
  if (!files) findings.push({ file: '.', category: 'empty release output' });
  return { files, findings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = auditDirectory(process.argv[2] || 'dist');
    console.log(JSON.stringify(result, null, 2));
    if (result.findings.length) process.exitCode = 1;
  } catch { console.error('release-privacy: unable to read complete release output'); process.exitCode = 1; }
}
