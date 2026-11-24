import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, '.runtime-seed', 'data');
const target = path.join(root, 'data');

if (!fs.existsSync(source)) {
  throw new Error('Runtime seed is missing. The Render build must run create-runtime-seed.mjs first.');
}

let copied = 0;

function copyMissingFiles(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyMissingFiles(sourcePath, targetPath);
    } else if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
      copied += 1;
    }
  }
}

copyMissingFiles(source, target);
console.log(
  copied > 0
    ? `Initialized ${copied} missing data files on persistent storage; existing user/runtime data was preserved.`
    : 'Persistent storage already initialized; existing data was preserved.'
);
