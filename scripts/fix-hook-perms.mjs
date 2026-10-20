// Asserts the husky hook wrappers are executable, repairing them if not.
//
// Git does not run a hook it cannot execute, and does not fail either: it
// prints one `hint:` line into the install noise and carries on. That is how
// this repo's only quality gate sat switched off - no prettier, no eslint, no
// typecheck, no suite, no 29-file cap - through commits and pushes that all
// looked green.
//
// husky itself writes these 0755 (measured), so nothing here is husky's doing.
// The bit gets stripped from OUTSIDE: this checkout is replicated between
// machines by a permission-ignoring sync, which recreates files with the
// default 0644. Anything that rewrites the tree without carrying modes - an
// archive restore, a copy off a FAT/exFAT volume - does the same.
//
// Scoped to `.husky/_` because that is the only directory whose execute bit git
// actually consults: `.husky/_/h` starts the real hook scripts through an
// explicit interpreter, so their own mode is irrelevant. `_` is also generated
// and gitignored, so writing to it can never dirty the tree - the hook scripts
// one level up are tracked and mostly recorded 0644, and flipping those would
// leave a permanently modified worktree wherever core.fileMode is true.
// Windows has no POSIX execute bit for this to repair or verify. Measured on
// Windows 11 / Node 24: every file under `.husky/_` stats as 0o666, so chmod
// is a no-op and the re-stat below can never pass - the script would fail
// every single `pnpm install` on that machine. Git for Windows does not
// consult the bit either (core.fileMode is false there) and runs the hooks
// through `sh` regardless; that was confirmed by executing `.husky/commit-msg`
// directly, which ran and exited 0. An install that always ends red is its own
// hazard: it trains everyone to ignore the one failure that would matter.
// The check still runs in full on macOS and Linux, which is where a 0644
// wrapper actually silences the gate.
import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const WRAPPER_DIR = path.resolve(import.meta.dirname, '..', '.husky', '_');
const HAS_EXECUTE_BIT = process.platform !== 'win32';

// Absent in the Docker builds: the images COPY package.json, so `prepare` runs,
// but never `.husky/` - and pnpm fails the entire install on a prepare that
// exits non-zero.
if (HAS_EXECUTE_BIT && existsSync(WRAPPER_DIR)) {
  const stillBroken = [];

  for (const entry of readdirSync(WRAPPER_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === '.gitignore') continue;
    const full = path.join(WRAPPER_DIR, entry.name);
    const mode = statSync(full).mode & 0o777;
    // Mirror the read bits into execute so a 0600 file stays private.
    chmodSync(full, mode | ((mode & 0o444) >> 2));
    // Re-stat rather than trust the call: on a read-only mount or a file owned
    // by someone else chmod reports success and changes nothing, which would
    // hand back exactly the silent dead gate this script exists to prevent.
    if ((statSync(full).mode & 0o111) === 0) stillBroken.push(entry.name);
  }

  if (stillBroken.length > 0) {
    console.error(
      `Could not make these git hooks executable: ${stillBroken.join(', ')}.\n` +
        `Git will SKIP them silently and every commit and push will run unchecked.\n` +
        `Fix the permissions under .husky/_ before committing.`,
    );
    process.exit(1);
  }
}
