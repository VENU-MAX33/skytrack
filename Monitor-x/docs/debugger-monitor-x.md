# MonitorX debugger report

## Scope

All four services were checked: `frontend-vite`, `driver-web`, `employee-web`, and `backend`.

## Observed behavior

The production builds and frontend source lint passed. The backend test suite intermittently failed before assertions with `MongoMemoryServer: Instance failed to start within 10000ms`.

## Root cause

Each backend test file creates an independent in-memory MongoDB in its `before(startTestDb)` hook. Node's default test runner executes test files concurrently, which causes multiple MongoDB processes to start at once and occasionally exceed Windows startup/resource limits. A second environment-dependent failure came from the local `.env` adding extra localhost ports to `CORS_ORIGINS`, which made the production-origin test non-deterministic.

## Falsification experiments

- Running `session-revocation.test.ts` alone passed all 5 tests.
- Running the full suite serially passed 94 of 99 tests; the remaining 5 were only the first file's MongoDB startup failures.
- Running `authz.test.ts` alone passed all 15 tests.
- Supplying a test-isolated CORS list made the environment assertion pass.

## Prevention

`backend/package.json` now runs tests with `--test-concurrency=1`, and `backend/tests/setup.ts` supplies deterministic test defaults before application modules load. This removes shell-specific environment assignments and prevents local `.env` values from changing test behavior.

`backend/tests/helpers.ts` also raises MongoMemoryServer's launch timeout to 60 seconds for slower Windows first starts. The previously affected `authz.test.ts` and `session-revocation.test.ts` suites pass together after this change.
