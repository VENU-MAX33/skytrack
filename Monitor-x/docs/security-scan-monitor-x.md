# MonitorX vulnerability scan and remediation

## Scope

The backend, admin frontend, driver frontend, and employee frontend were
scanned with the `vulnerability-scanner` skill. Dependency advisories and the
affected source paths were then validated manually.

## Findings and resolution

### Resolved — vulnerable `ws` dependency chain

All four npm lockfiles now resolve `ws@8.21.0`, enforced with an npm override
in each service package. `npm audit --audit-level=high` reports zero
vulnerabilities in backend, admin, driver, and employee packages.

### Resolved — vulnerable `xlsx@0.18.5`

The admin frontend no longer depends on `xlsx`. Workbook parsing uses
`read-excel-file` and workbook generation uses `write-excel-file`. Browser
imports reject non-`.xlsx` files over 10 MB and stop after 5,000 data rows;
the API also caps bulk employee imports at 5,000 rows.

### Resolved — predictable seeded credentials

The seed and local runner accept optional `SEED_ADMIN_PASSWORD`,
`SEED_STAFF_PASSWORD`, and `DEFAULT_EMPLOYEE_PASSWORD` values. If they are
absent in development, cryptographically random passwords are generated and
printed once for local testing. Destructive demo seeding refuses to run when
`NODE_ENV=production`, and the old fixed passwords are no longer present.

### Resolved — upload/resource exhaustion controls

Employee document uploads retain the 3 MB per-file limit and MIME/signature
checks. They now also have an authenticated-principal rate limit of 30 uploads
per 15 minutes, a maximum of 20 documents per employee, and a 200 MB encoded
document quota per company. The API keeps the 5 MB JSON body limit.

Moving binary storage to approved object storage with malware scanning remains
the recommended deployment improvement for internet-facing production.

## Validation

- Backend TypeScript build: passed.
- Admin, driver, and employee production builds: passed.
- `npm audit --audit-level=high` in all four packages: zero vulnerabilities.
- Focused regression suite covering documents, bulk imports, authorization:
  25/25 passed.
- Vulnerability-scanner code-pattern scan: no dangerous patterns.

## Scanner false positives

- The automated scanner reports missing Yarn and pnpm locks; MonitorX uses npm
  lockfiles in each service.
- Test-only values in `backend/tests/setup.ts` and
  `backend/tests/hardening.test.ts` are local fixtures, not production
  credentials.
- The scanner reports missing security-header configuration because it only
  checks certain config filenames; Helmet is configured in
  `backend/src/app.ts`.
