#!/usr/bin/env node

import { accessSync, constants, existsSync, readFileSync } from 'node:fs';

const requiredPackages = new Map([
  ['apps/web/package.json', '@hi/web'],
  ['packages/domain/package.json', '@hi/domain'],
  ['packages/ui/package.json', '@hi/ui'],
  ['packages/config/package.json', '@hi/config'],
]);

const missingPaths = [
  'apps/web/src/app',
  'packages/domain/src',
  'packages/ui/src',
  'packages/config/typescript',
].filter((path) => !existsSync(path));

try {
  accessSync('pnpm-lock.yaml', constants.R_OK);
} catch {
  console.error('workspace-layout: pnpm-lock.yaml must be readable by the Docker build client');
  process.exitCode = 1;
}

if (existsSync('apps/mobile')) {
  console.error('workspace-layout: apps/mobile is not part of Foundation Milestone 1');
  process.exit(1);
}

for (const [path, packageName] of requiredPackages) {
  if (!existsSync(path)) {
    missingPaths.push(path);
    continue;
  }

  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.name !== packageName) {
    console.error(`workspace-layout: ${path} must declare name ${packageName}`);
    process.exitCode = 1;
  }
}

if (missingPaths.length > 0) {
  console.error(`workspace-layout: missing required paths: ${missingPaths.join(', ')}`);
  process.exitCode = 1;
}

if (process.exitCode) process.exit();
console.log('workspace-layout: required package layout is present');
