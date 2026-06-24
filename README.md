# auth-test.js

A lightweight CLI script to test signup and signin endpoints against any running HTTP API — no framework, no dependencies, no database setup required.

---

## Requirements

- Node.js **v18 or higher**

Check your version:
```bash
node --version
```

---

## Setup

No installation needed. Just grab the file and run it:

```bash
node auth-test.js
```

---

## Usage

```bash
node auth-test.js [options]
```

### Options

| Flag | Description | Default |
|---|---|---|
| `--url` | Base URL of your API | `http://localhost:3000` |
| `--signup` | Signup endpoint path | `/auth/signup` |
| `--signin` | Signin endpoint path | `/auth/signin` |
| `--email-field` | Email key in request body | `email` |
| `--pass-field` | Password key in request body | `password` |
| `--token-field` | Token key in signin response | `token` |
| `--help` | Show help message | — |

---

## Examples

**Default (localhost:3000)**
```bash
node auth-test.js
```

**Custom port and paths**
```bash
node auth-test.js --url http://localhost:5000 --signup /api/register --signin /api/login
```

**Custom field names**
```bash
node auth-test.js --email-field username --pass-field pwd --token-field accessToken
```

---

## What It Tests

### Signup
| Test | Expected |
|---|---|
| New user signup | `200` or `201` |
| Duplicate email | `400`, `409`, or `422` |
| Missing email | `400` or `422` |
| Missing password | `400` or `422` |
| Empty body | `400` or `422` |

### Signin
| Test | Expected |
|---|---|
| Correct credentials | `200` + token in response |
| Wrong password | `400`, `401`, or `403` |
| Non-existent email | `400`, `401`, or `404` |
| Missing password | `400` or `422` |
| Empty body | `400`, `401`, or `422` |

---

## Sample Output

```
  Auth Test Script
──────────────────────────────────────
  Base URL   : http://localhost:3000
  Signup path: /auth/signup
  Signin path: /auth/signin
  Test user  : testuser_1719999999@auth-test.local
──────────────────────────────────────

▶  Signup
  ✔  New user signup succeeds (200 or 201)
     201 · 43ms
  ✔  Duplicate signup is rejected (400, 409, or 422)
     409 · duplicate correctly rejected
  ✔  Signup with no email is rejected (400 or 422)
     400 · missing email correctly rejected
  ✔  Signup with no password is rejected (400 or 422)
     400 · missing password correctly rejected
  ✔  Signup with empty body is rejected (400 or 422)
     400 · empty body correctly rejected

▶  Signin
  ✔  Signin with correct credentials succeeds (200)
     200 · 38ms · token found at "accessToken"
  ✔  Signin with wrong password is rejected (400, 401, or 403)
     401 · wrong password correctly rejected
  ✔  Signin with non-existent email is rejected (400, 401, or 404)
     401 · unknown email correctly rejected
  ✔  Signin with no password is rejected (400 or 422)
     400 · missing password correctly rejected
  ✔  Signin with empty body is rejected (400 or 422)
     400 · empty body correctly rejected

──────────────────────────────────────
  Results: 10/10 passed
──────────────────────────────────────
```

---

## Notes

- A **unique email** is generated on every run (`testuser_<timestamp>@auth-test.local`) so re-runs never clash with leftover data.
- Token detection is automatic — checks `token`, `accessToken`, `access_token`, `jwt`, and `id_token` by default. Override with `--token-field`.
- Exits with code `0` if all tests pass, `1` if any fail — works in CI pipelines.
- Works with any database (PostgreSQL, MongoDB, SQLite, MySQL, etc.) since it only communicates over HTTP.
