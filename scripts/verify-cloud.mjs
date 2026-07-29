#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFileInto } from './lib/env-file.mjs';
import { fail, ok, step, warn } from './lib/log.mjs';

const REQUIRED_VARS = [
  'CLOUD_API_URL',
  'CLOUD_WEB_URL',
  'CLOUD_TEST_EMAIL',
  'CLOUD_TEST_PASSWORD',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];

function loadOptionalLocalCloudEnv() {
  const cloudLocalPath = resolve(process.cwd(), '.env.cloud.local');
  if (existsSync(cloudLocalPath)) loadEnvFileInto(cloudLocalPath);
}

function assertRequiredVars() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    fail(`Missing required cloud verification variables: ${missing.join(', ')}`);
    fail(
      'These must be provided as environment variables (e.g. GitHub Secrets in cloud-smoke.yml, or a local .env.cloud.local) — never hard-coded.',
    );
    process.exit(1);
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { response, json };
}

async function main() {
  loadOptionalLocalCloudEnv();
  assertRequiredVars();

  const apiUrl = process.env.CLOUD_API_URL.replace(/\/$/, '');
  const webUrl = process.env.CLOUD_WEB_URL.replace(/\/$/, '');
  const supabaseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  let accessToken;
  let createdChildId;
  let createdAssetId;

  try {
    step('Checking cloud API liveness');
    const live = await fetchJson(`${apiUrl}/api/health/live`);
    if (!live.response.ok) throw new Error(`live health check failed (${live.response.status})`);
    ok('Live health OK');

    step('Checking cloud API readiness');
    const ready = await fetchJson(`${apiUrl}/api/health/ready`);
    if (!ready.response.ok || ready.json?.status !== 'ok') {
      throw new Error(`ready health check failed (${ready.response.status})`);
    }
    ok('Ready health OK');

    step('Checking deployment version');
    const version = await fetchJson(`${apiUrl}/api/meta/version`);
    if (!version.response.ok) throw new Error(`version check failed (${version.response.status})`);
    ok(
      `Deployed version: appProfile=${version.json?.appProfile} commit=${version.json?.commitSha}`,
    );

    step('Signing in with the Supabase test user');
    const signIn = await fetchJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.CLOUD_TEST_EMAIL,
        password: process.env.CLOUD_TEST_PASSWORD,
      }),
    });
    if (!signIn.response.ok || !signIn.json?.access_token) {
      throw new Error(`Supabase sign-in failed (${signIn.response.status})`);
    }
    accessToken = signIn.json.access_token;
    ok('Supabase Auth sign-in succeeded');

    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    step('Calling /api/me');
    const me = await fetchJson(`${apiUrl}/api/me`, { headers: authHeaders });
    if (!me.response.ok) throw new Error(`/api/me failed (${me.response.status})`);
    const parentId = me.json.parent.id;
    ok(`/api/me OK (parentId=${parentId})`);

    step('Creating a temporary child profile');
    const createChild = await fetchJson(`${apiUrl}/api/children`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ displayName: `cloud-smoke-${Date.now()}`, avatarKey: 'fox' }),
    });
    if (!createChild.response.ok)
      throw new Error(`create child failed (${createChild.response.status})`);
    createdChildId = createChild.json.id;
    ok(`Child profile created: ${createdChildId}`);

    step('Requesting a signed upload URL');
    const uploadUrlResp = await fetchJson(`${apiUrl}/api/assets/upload-url`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        ownerKind: 'parent',
        ownerId: parentId,
        mimeType: 'text/plain',
        sizeBytes: 11,
        fileName: 'smoke.txt',
      }),
    });
    if (!uploadUrlResp.response.ok) {
      throw new Error(`upload-url failed (${uploadUrlResp.response.status})`);
    }
    createdAssetId = uploadUrlResp.json.assetId;
    ok(`Upload URL issued for asset ${createdAssetId}`);

    step('Uploading a small test file');
    const uploadResp = await fetch(uploadUrlResp.json.uploadUrl, {
      method: uploadUrlResp.json.method,
      headers: uploadUrlResp.json.headers,
      body: 'hello world',
    });
    if (!uploadResp.ok) throw new Error(`file upload failed (${uploadResp.status})`);
    ok('File uploaded');

    step('Completing the upload');
    const completeResp = await fetchJson(`${apiUrl}/api/assets/complete`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ assetId: createdAssetId }),
    });
    if (!completeResp.response.ok)
      throw new Error(`complete upload failed (${completeResp.response.status})`);
    ok('Upload marked complete');

    step('Requesting a signed read URL');
    const readUrlResp = await fetchJson(`${apiUrl}/api/assets/${createdAssetId}/read-url`, {
      headers: authHeaders,
    });
    if (!readUrlResp.response.ok)
      throw new Error(`read-url failed (${readUrlResp.response.status})`);
    const readResp = await fetch(readUrlResp.json.readUrl);
    if (!readResp.ok) throw new Error(`reading the asset failed (${readResp.status})`);
    ok('Signed read URL works');

    step('Checking Cloudflare Pages frontend availability');
    const webResp = await fetch(webUrl);
    if (!webResp.ok) throw new Error(`frontend not reachable (${webResp.status})`);
    ok('Frontend reachable');

    step('Checking CORS configuration');
    const corsResp = await fetch(`${apiUrl}/api/health/live`, { headers: { Origin: webUrl } });
    const allowOrigin = corsResp.headers.get('access-control-allow-origin');
    if (allowOrigin === '*') {
      throw new Error(
        'CORS is configured with a wildcard origin, which is forbidden for authorized requests',
      );
    }
    ok(`CORS allow-origin: ${allowOrigin ?? '(none on this route)'}`);

    console.log('\nverify:cloud completed successfully.');
  } finally {
    if (accessToken && createdAssetId) {
      step('Cleaning up: deleting the temporary asset');
      await fetch(`${apiUrl}/api/assets/${createdAssetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => warn('Failed to delete temporary asset — manual cleanup may be required'));
    }
    if (accessToken && createdChildId) {
      step(
        'Cleaning up: temporary child profile left in place (no delete endpoint by design; see docs)',
      );
    }
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
