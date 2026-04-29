const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'release');
const packageName = 'image-annotation-workshop';
const stageDir = path.join(buildDir, packageName);
const archivePath = path.join(buildDir, `${packageName}.tar.gz`);

const entries = [
  'default.html',
  'server.js',
  'package.json',
  'package-lock.json',
  'node_modules',
  'src',
  'static',
  'scripts',
  'docs',
  'deploy',
  '.gitignore'
];

function copyRecursive(src, dest) {
  const relative = path.relative(rootDir, src).split(path.sep).join('/');
  if (
    relative === 'release'
    || relative.endsWith('/__pycache__')
    || relative.includes('/__pycache__/')
    || relative.endsWith('.pyc')
    || /^scripts\/py\/.*\.xml$/i.test(relative)
  ) {
    return;
  }
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

for (const entry of entries) {
  const src = path.join(rootDir, entry);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(stageDir, entry));
  }
}

execFileSync('tar', ['-czf', archivePath, '-C', buildDir, packageName], {
  stdio: 'inherit'
});

console.log(`Created ${archivePath}`);
