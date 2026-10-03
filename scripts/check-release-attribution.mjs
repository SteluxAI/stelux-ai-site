import { execFileSync } from 'node:child_process';

// Run for the exact new commits before pushing. Configure only after the owner
// approves a real brand or GitHub-provided no-reply identity. Never echo it.
const email = process.env.RELEASE_APPROVED_GIT_EMAIL;
const name = process.env.RELEASE_APPROVED_GIT_NAME;
const range = process.argv[2] || 'HEAD';
if (!email || !name || range.startsWith('-')) {
  console.error('attribution: supply approved name/email environment variables and a commit or range');
  process.exit(1);
}
try {
  const limit = range.includes('..') ? [] : ['-1'];
  const rows = execFileSync('git', ['log', ...limit, '--format=%h%x09%an%x09%ae%x09%cn%x09%ce', range, '--'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  if (!rows.length) throw new Error('empty range');
  let failed = false;
  for (const row of rows) {
    const [sha, authorName, authorEmail, committerName, committerEmail] = row.split('\t');
    if (authorName !== name || authorEmail.toLowerCase() !== email.toLowerCase() || committerName !== name || committerEmail.toLowerCase() !== email.toLowerCase()) {
      console.error(`attribution: ${sha} has an unapproved author or committer identity`);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
  else console.log(`attribution: ${rows.length} commits match the approved identity`);
} catch { console.error('attribution: could not verify the requested commit range'); process.exitCode = 1; }
