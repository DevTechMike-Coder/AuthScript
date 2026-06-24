#!/usr/bin/env node

/**
 * auth-test.js — Database-agnostic Signup & Signin Test Script
 *
 * Usage:
 * node auth-test.js [options]
 *
 * Options:
 * --url          Base URL of your API          (default: http://localhost:3000)
 * --signup       Signup endpoint path          (default: /auth/signup)
 * --signin       Signin endpoint path          (default: /auth/signin)
 * --delete       Delete user endpoint path     (default: omitted, skips cleanup)
 * --email-field  Email key in request body     (default: email)
 * --pass-field   Password key in request body  (default: password)
 * --token-field  Token key in signin response  (default: token)
 * --help         Show this help message
 *
 * Examples:
 * node auth-test.js
 * node auth-test.js --url http://localhost:5000 --signup /api/register --signin /api/login
 * node auth-test.js --delete /api/user/delete-self
 */

// ─── Node version guard ───────────────────────────────────────────────────────
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error('\n   ✘   Node.js 18+ required (uses built-in fetch).\n');
  process.exit(1);
}

// ─── Help ─────────────────────────────────────────────────────────────────────
if (process.argv.includes('--help')) {
  console.log(`
  auth-test.js — Signup & Signin Test Script

  Usage:
    node auth-test.js [options]

  Options:
    --url           Base URL of your API          (default: http://localhost:3000)
    --signup        Signup endpoint path          (default: /auth/signup)
    --signin        Signin endpoint path          (default: /auth/signin)
    --delete        Delete user endpoint path     (default: omitted, skips cleanup)
    --email-field   Email key in request body     (default: email)
    --pass-field    Password key in request body  (default: password)
    --token-field   Token key in signin response  (default: token)
    --help          Show this help message

  Examples:
    node auth-test.js
    node auth-test.js --url http://localhost:5000 --signup /api/register --signin /api/login
    node auth-test.js --delete /api/user/delete-self
`);
  process.exit(0);
}

// ─── Config ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const CONFIG = {
  baseUrl:     getArg('--url',          'http://localhost:3000'),
  signupPath:  getArg('--signup',       '/auth/signup'),
  signinPath:  getArg('--signin',       '/auth/signin'),
  deletePath:  getArg('--delete',       null), // Optional cleanup path
  emailField:  getArg('--email-field',  'email'),
  passField:   getArg('--pass-field',   'password'),
  tokenField:  getArg('--token-field',  'token'),
};

// Unique test user per run so re-runs never collide
const TEST_EMAIL    = `testuser_${Date.now()}@auth-test.local`;
const TEST_PASSWORD = 'TestPass123!';
const WRONG_PASSWORD = 'WrongPassword999!';

// ─── ANSI color helpers ───────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
};

const log = {
  pass:    (msg)       => console.log(`  ${c.green}✔${c.reset}  ${msg}`),
  fail:    (msg)       => console.log(`  ${c.red}✘${c.reset}  ${msg}`),
  info:    (msg)       => console.log(`     ${c.grey}${msg}${c.reset}`),
  section: (msg)       => console.log(`\n${c.bold}${c.cyan}▶  ${msg}${c.reset}`),
  divider: ()          => console.log(`${c.grey}──────────────────────────────────────${c.reset}`),
};

// ─── URL Sanitizer Utility ────────────────────────────────────────────────────
function buildUrl(base, path) {
  const cleanBase = base.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${cleanBase}/${cleanPath}`;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function post(path, body) {
  const url = buildUrl(CONFIG.baseUrl, path);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const duration = Date.now() - start;
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    return { ok: res.ok, status: res.status, data, duration, error: null };
  } catch (err) {
    return { ok: false, status: null, data: null, duration: null, error: err.message };
  }
}

async function del(path, token) {
  const url = buildUrl(CONFIG.baseUrl, path);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });
    const duration = Date.now() - start;
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    return { ok: res.ok, status: res.status, data, duration, error: null };
  } catch (err) {
    return { ok: false, status: null, data: null, duration: null, error: err.message };
  }
}

// ─── Test runner ──────────────────────────────────────────────────────────────
const results = [];

async function test(name, fn) {
  try {
    const detail = await fn();
    log.pass(name);
    if (detail) log.info(detail);
    results.push({ name, passed: true });
  } catch (err) {
    log.fail(name);
    log.info(err.message);
    results.push({ name, passed: false, reason: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── Token detection ─────────────────────────────────────────────────────────
function extractToken(data) {
  if (!data || typeof data !== 'object') return null;
  const keys = [CONFIG.tokenField, 'accessToken', 'access_token', 'jwt', 'id_token', 'authToken'];
  for (const key of keys) {
    if (data[key]) return { key, value: data[key] };
  }
  return null;
}

// ─── Test suite ───────────────────────────────────────────────────────────────
async function run() {
  let acquiredToken = null;

  console.log(`\n${c.bold}  Auth Test Script${c.reset}`);
  log.divider();
  console.log(`  ${c.grey}Base URL    :${c.reset} ${CONFIG.baseUrl}`);
  console.log(`  ${c.grey}Signup path :${c.reset} ${CONFIG.signupPath}`);
  console.log(`  ${c.grey}Signin path :${c.reset} ${CONFIG.signinPath}`);
  if (CONFIG.deletePath) console.log(`  ${c.grey}Delete path :${c.reset} ${CONFIG.deletePath}`);
  console.log(`  ${c.grey}Test user   :${c.reset} ${TEST_EMAIL}`);
  log.divider();

  // ── SIGNUP TESTS ────────────────────────────────────────────────────────────
  log.section('Signup');

  await test('New user signup succeeds (200 or 201)', async () => {
    const res = await post(CONFIG.signupPath, {
      [CONFIG.emailField]: TEST_EMAIL,
      [CONFIG.passField]:  TEST_PASSWORD,
    });
    assert(res.error === null, `Network error — is your server running? (${res.error})`);
    assert(
      res.ok || [200, 201].includes(res.status),
      `Expected 200 or 201, got ${res.status}. Response: ${JSON.stringify(res.data)}`
    );
    return `${res.status} · ${res.duration}ms`;
  });

  await test('Duplicate signup is rejected (400, 409, or 422)', async () => {
    const res = await post(CONFIG.signupPath, {
      [CONFIG.emailField]: TEST_EMAIL,
      [CONFIG.passField]:  TEST_PASSWORD,
    });
    assert(res.error === null, `Network error — ${res.error}`);
    assert(
      !res.ok && [400, 409, 422].includes(res.status),
      `Expected 400/409/422 for duplicate, got ${res.status}. Response: ${JSON.stringify(res.data)}`
    );
    return `${res.status} · duplicate correctly rejected`;
  });

  await test('Signup with no email is rejected (400 or 422)', async () => {
    const res = await post(CONFIG.signupPath, {
      [CONFIG.passField]: TEST_PASSWORD,
    });
    assert(res.error === null, `Network error — ${res.error}`);
    assert(
      !res.ok && [400, 422].includes(res.status),
      `Expected 400/422 for missing email, got ${res.status}`
    );
    return `${res.status} · missing email correctly rejected`;
  });

  await test('Signup with no password is rejected (400 or 422)', async () => {
    const res = await post(CONFIG.signupPath, {
      [CONFIG.emailField]: `nopw_${Date.now()}@auth-test.local`,
    });
    assert(res.error === null, `Network error — ${res.error}`);
    assert(
      !res.ok && [400, 422].includes(res.status),
      `Expected 400/422 for missing password, got ${res.status}`
    );
    return `${res.status} · missing password correctly rejected`;
  });

  await test('Signup with empty body is rejected (400 or 422)', async () => {
    const res = await post(CONFIG.signupPath, {});
    assert(res.error === null, `Network error — ${res.error}`);
    assert(
      !res.ok && [400, 422].includes(res.status),
      `Expected 400/422 for empty body, got ${res.status}`
    );
    return `${res.status} · empty body correctly rejected`;
  });

  // ── SIGNIN TESTS ────────────────────────────────────────────────────────────
  log.section('Signin');

  await test('Signin with correct credentials succeeds (200)', async () => {
    const res = await post(CONFIG.signinPath, {
      [CONFIG.emailField]: TEST_EMAIL,
      [CONFIG.passField]:  TEST_PASSWORD,
    });
    assert(res.error === null, `Network error — is your server running? (${res.error})`);
    assert(
      res.ok,
      `Expected 200, got ${res.status}. Response: ${JSON.stringify(res.data)}`
    );
    
    const token = extractToken(res.data);
    if (token) acquiredToken = token.value;

    const tokenNote = token
      ? `token found at "${token.key}"`
      : `⚠ no token field found — check --token-field (currently "${CONFIG.tokenField}")`;
    return `${res.status} · ${res.duration}ms · ${tokenNote}`;
  });

  await test('Signin with wrong password is rejected (400, 401, or 403)', async () => {
    const res = await post(CONFIG.signinPath, {
      [CONFIG.emailField]: TEST_EMAIL,
      [CONFIG.passField]:  WRONG_PASSWORD,
    });
    assert(res.error === null, `Network error — ${res.error}`);
    assert(
      !res.ok && [400, 401, 403].includes(res.status),
      `Expected 401 for wrong password, got ${res.status}. Response: ${JSON.stringify(res.data)}`
    );
    return `${res.status} · wrong password correctly rejected`;
  });

  await test('Signin with non-existent email is rejected (400, 401, or 404)', async () => {
    const res = await post(CONFIG.signinPath, {
      [CONFIG.emailField]: `ghost_${Date.now()}@nowhere.local`,
      [CONFIG.passField]:  TEST_PASSWORD,
    });
    assert(res.error === null, `Network error — ${res.error}`);
    assert(
      !res.ok && [400, 401, 404].includes(res.status),
      `Expected 401/404 for unknown user, got ${res.status}. Response: ${JSON.stringify(res.data)}`
    );
    return `${res.status} · unknown email correctly rejected`;
  });

  await test('Signin with no password is rejected (400 or 422)', async () => {
    const res = await post(CONFIG.signinPath, {
      [CONFIG.emailField]: TEST_EMAIL,
    });
    assert(res.error === null, `Network error — ${res.error}`);
    assert(
      !res.ok && [400, 401, 422].includes(res.status),
      `Expected 400/422 for missing password, got ${res.status}`
    );
    return `${res.status} · missing password correctly rejected`;
  });

  await test('Signin with empty body is rejected (400 or 422)', async () => {
    const res = await post(CONFIG.signinPath, {});
    assert(res.error === null, `Network error — ${res.error}`);
    assert(
      !res.ok && [400, 401, 422].includes(res.status),
      `Expected 400/401/422 for empty body, got ${res.status}`
    );
    return `${res.status} · empty body correctly rejected`;
  });

  // ── CLEANUP PROCESS ──────────────────────────────────────────────────────────
  if (CONFIG.deletePath) {
    log.section('Cleanup');
    if (!acquiredToken) {
      log.fail('Skipping data cleanup — No authorization token was acquired.');
      results.push({ name: 'Cleanup user architecture', passed: false, reason: 'Missing auth token' });
    } else {
      await test('Test user deletion succeeds', async () => {
        const res = await del(CONFIG.deletePath, acquiredToken);
        assert(res.error === null, `Network error during cleanup — ${res.error}`);
        assert(res.ok || [200, 204].includes(res.status), `Expected 200 or 204 for user deletion, got ${res.status}`);
        return `${res.status} · Test artifact scrubbed from database.`;
      });
    }
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  const passed    = results.filter((r) => r.passed).length;
  const failed    = results.filter((r) => !r.passed).length;
  const total     = results.length;
  const allPassed = failed === 0;

  console.log(`\n`);
  log.divider();
  console.log(
    `  ${c.bold}Results: ${allPassed ? c.green : c.red}${passed}/${total} passed${c.reset}`
  );

  if (!allPassed) {
    console.log(`\n  ${c.red}${c.bold}Failed:${c.reset}`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`\n  ${c.red}✘${c.reset} ${r.name}`);
        console.log(`    ${c.grey}${r.reason}${c.reset}`);
      });
  }

  log.divider();
  console.log('');
  process.exit(allPassed ? 0 : 1);
}

run();
