import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Menyiapkan skema database uji sekali sebelum seluruh berkas test dijalankan. */
export async function setup(): Promise<void> {
  execFileSync('npx', ['prisma', 'db', 'push', '--force-reset', '--skip-generate'], {
    cwd: serverRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test.db',
    },
  });
}
