import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';

/** Project root (the folder with package.json), from both `server/` (tsx) and `dist-server/server/` (built). */
export function projectRoot(): string {
  let dir = import.meta.dirname;
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('package.json not found');
    dir = parent;
  }
  return dir;
}
