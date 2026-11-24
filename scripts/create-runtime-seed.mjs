import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'data');
const target = path.join(root, '.runtime-seed', 'data');

if (!fs.existsSync(source)) {
  throw new Error('Tracked data directory is missing; cannot prepare the runtime seed.');
}

fs.rmSync(path.dirname(target), { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true, force: true });

const countFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (total, entry) =>
      total + (entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1),
    0
  );

console.log(`Prepared ${countFiles(target)} seed files for the persistent runtime data disk.`);
