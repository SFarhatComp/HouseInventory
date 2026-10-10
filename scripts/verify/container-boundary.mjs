#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

const forbiddenSecret = /(?:^|_)(?:BWS|BW|SUPABASE|HI_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)|DATABASE_URL|POSTGRES_PASSWORD)/i;
const allowedHostNetwork = new Set(['e2e', 'supabase-tools']);
const requiredServices = ['tools', 'workspace', 'supabase-tools', 'web', 'e2e', 'runner'];
const errors = [];

function readComposeConfig() {
  const input = readFileSync(0, 'utf8').trim();
  if (input) return JSON.parse(input);

  if (!existsSync('compose.yaml')) throw new Error('compose.yaml is missing');
  const source = readFileSync('compose.yaml', 'utf8');
  return import('yaml').then(({ parse }) => parse(source));
}

function volumeSource(volume) {
  return typeof volume === 'string' ? volume.split(':')[0] : volume?.source;
}

function volumeTarget(volume) {
  return typeof volume === 'string' ? volume.split(':')[1] : volume?.target;
}

try {
  const compose = await readComposeConfig();
  const services = compose.services;
  if (!services || typeof services !== 'object') throw new Error('Compose services are missing');

  for (const name of requiredServices) {
    if (!services[name]) errors.push(`required service ${name} is missing`);
  }

  for (const [name, service] of Object.entries(services)) {
    const mounts = service.volumes ?? [];
    const hasDockerSocket = mounts.some((mount) =>
      [volumeSource(mount), volumeTarget(mount)].some((path) =>
        typeof path === 'string' && path.includes('/var/run/docker.sock'),
      ),
    );

    if (hasDockerSocket && name !== 'supabase-tools') {
      errors.push(`${name} mounts the Docker socket`);
    }
    if (name === 'supabase-tools') {
      if (!hasDockerSocket) errors.push('supabase-tools must be the sole Docker-socket service');
      const environment = service.environment ?? {};
      const names = Array.isArray(environment)
        ? environment.map((entry) => entry.split('=')[0])
        : Object.keys(environment);
      const leaked = names.filter((key) => forbiddenSecret.test(key));
      if (leaked.length) errors.push(`supabase-tools receives sensitive environment names: ${leaked.join(', ')}`);
      if (service.logging?.driver !== 'none') errors.push('supabase-tools logging driver must be none');
    }

    if (service.privileged === true) errors.push(`${name} must not run privileged`);
    if (service.network_mode === 'host' && !allowedHostNetwork.has(name)) {
      errors.push(`${name} uses unapproved host networking`);
    }
    if (allowedHostNetwork.has(name) && service.network_mode !== 'host') {
      errors.push(`${name} must use Linux host networking`);
    }
    if (name === 'e2e' && (service.ports ?? []).length > 0) {
      errors.push('e2e must not publish host ports');
    }
  }

  const webPorts = services.web?.ports ?? [];
  const loopbackOnly = webPorts.length === 1 && webPorts.every((port) => {
    if (typeof port === 'string') return port === '${WEB_BIND:-127.0.0.1}:3000:3000';
    return port.host_ip === '127.0.0.1'
      && String(port.target) === '3000'
      && String(port.published) === '3000';
  });
  if (!loopbackOnly) errors.push('web must publish only 127.0.0.1:3000 by default');

  const localNetwork = compose.networks?.['hi-supabase'];
  if (localNetwork?.external !== true) errors.push('hi-supabase must be an external network');
  for (const name of ['tools', 'workspace', 'web']) {
    const declared = services[name]?.networks;
    const attached = Array.isArray(declared)
      ? declared.includes('hi-supabase')
      : Object.hasOwn(declared ?? {}, 'hi-supabase');
    if (!attached) errors.push(`${name} must attach to hi-supabase`);
  }

  if (!services.runner) errors.push('runner service is required');
  else if (!services.runner.user || ['0', 'root', '0:0', 'root:root'].includes(String(services.runner.user))) {
    errors.push('runner must declare a non-root user');
  }
} catch (error) {
  errors.push(`cannot inspect Compose configuration: ${error.message}`);
}

if (errors.length) {
  for (const error of errors) console.error(`container-boundary: ${error}`);
  process.exit(1);
}

console.log('container-boundary: Docker socket, privilege, networking, logging, and runner checks passed');
