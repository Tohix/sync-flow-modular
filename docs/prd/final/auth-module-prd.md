# PRD — Auth Module (Stage 1) — FINAL

> Status: Final · Supersedes `docs/prd/draft/auth-module-draft-prd.md`
> Stage: 1 — Modular Monolith · Scope: Minimal, production-oriented authentication module

---

## Executive Summary

Implement a deliberately minimal, production-oriented **authentication module** for the Data Synchronization Platform (a NestJS modular monolith). It delivers email/password registration, login with a short-lived JWT access token, and one protected endpoint — built on PostgreSQL + Drizzle ORM with UUID v7 identifiers. The goal is to establish correct modular boundaries, a typed persistence layer, and a scalable foundation that future stages (RBAC, OAuth, refresh tokens, etc.) can extend without rework.

## Problem Statement

The platform currently has no authentication. Before building event processing, integrations, jobs, notifications, and audit modules, the system needs a trustworthy way to identify users and protect endpoints. Building a full enterprise auth system now would add complexity and rework risk. Instead, Stage 1 establishes a small, correct, and extensible auth core that the rest of the platform can build on.

## Goals

- Establish proper modular boundaries for the `auth` module within the monolith.
- Provide a working authentication flow: registration, login, JWT-protected routes.
- Establish a typed, SQL-first persistence layer (Drizzle + PostgreSQL) with a clear migration system.
- Standardize UUID v7 identifiers, generated at the application layer, across the platform.
- Provide a clean, narrow public interface other modules can consume to protect routes.

**Explicit non-goal:** This is NOT a complete enterprise auth system. Advanced features are deferred to later stages (see [Out of Scope](#out-of-scope)).

## Success Criteria

- A new user can register via `POST /auth/register` and is persisted with a hashed password and UUID v7 id.
- A registered user can authenticate via `POST /auth/login` and receive a valid HS256 JWT.
- `GET /auth/me` returns the authenticated user when given a valid token and rejects requests with a missing/invalid/expired token.
- Passwords are never stored in plaintext and never appear in any API response or log.
- Migrations generate from the Drizzle schema and apply cleanly to a fresh database.
- The app fails fast on startup if required environment variables are missing or invalid.
- Other modules can protect a route using the exported `JwtAuthGuard` and read the user via `@CurrentUser()`, without importing auth internals.

## Personas

- **Platform developer (primary):** Consumes the auth module to protect new module endpoints; needs a clear public interface and predictable contracts.
- **API client / end user:** Registers and logs in to obtain a token for authenticated API calls.

## Tech Stack

- **Runtime/Framework:** NestJS 11
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM (`drizzle-orm`) + Drizzle Kit (`drizzle-kit`) for migrations
- **Driver:** `pg`
- **Auth:** JWT (HS256) via `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`
- **Hashing:** `bcrypt`
- **IDs:** `uuid` (v7)
- **Config:** `@nestjs/config` with validated schema
- **Validation:** `class-validator` + `class-transformer` via global `ValidationPipe`
- **Containerization:** Docker

> Already installed: `@nestjs/*` core, `drizzle-orm`, `pg`, `dotenv`, `drizzle-kit`.
> To add: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `uuid`, `@nestjs/config`, `class-validator`, `class-transformer` (+ relevant `@types/*`).

---

## Architecture Principles

### 1. Modular Monolith
Each domain is isolated and self-contained. The `auth` module exposes only a narrow public interface (see [Public Interface](#public-interface)). Future modules (`events`, `integrations`, `jobs`, `notifications`, `audit logs`) must not reach into auth internals.

### 2. Incremental Complexity
Implementation stays intentionally small. None of the deferred features (refresh tokens, RBAC, OAuth, API keys, email verification, password reset, sessions, multi-tenancy, social login) are built in this stage. The architecture must, however, leave room to add them later.

### 3. SQL-First Approach
Use Drizzle with explicit, typed schemas and generated migrations. Avoid excessive abstraction. **No repository pattern** for now — services access the typed Drizzle client directly.

### 4. UUID v7 Strategy
All identifiers are UUID v7, generated at the **application layer** using `uuid`'s `v7()` (wired as the Drizzle column `$defaultFn`). No auto-increment IDs anywhere. Rationale: better index locality, improved insert performance, reduced B-Tree fragmentation, and chronological ordering — important for the append-heavy workloads coming later (events, audit logs, jobs, retries, webhook deliveries, integration executions).

---

## Current Scope

The auth module supports:

- User registration
- User login
- JWT access token generation (HS256)
- Password hashing (bcrypt)
- One authenticated endpoint (`GET /auth/me`)
- PostgreSQL persistence via Drizzle

---

## Functional Requirements

### Must Have (P0)

#### FR-1 — Registration · `POST /auth/register`
- **Request:** `{ "email": string, "password": string }`
- **Behavior:**
  1. Validate request (see [Validation](#validation)).
  2. Normalize email: **trim + lowercase**.
  3. Check for an existing user with that normalized email.
  4. Hash password with bcrypt (cost factor **12**).
  5. Generate UUID v7 (app-level via Drizzle `$defaultFn`).
  6. Persist the user.
  7. Return the created user **without** the password.
- **Success response:** `201 Created`
  ```json
  { "id": "uuid-v7", "email": "user@example.com", "createdAt": "ISO-8601", "updatedAt": "ISO-8601" }
  ```
- **Acceptance criteria:**
  - Duplicate (normalized) email returns `409 Conflict`.
  - Response never includes `password`.
  - Stored email is lowercased/trimmed.

#### FR-2 — Login · `POST /auth/login`
- **Request:** `{ "email": string, "password": string }`
- **Behavior:**
  1. Validate request.
  2. Normalize email (trim + lowercase) and look up the user.
  3. Compare password against the bcrypt hash.
  4. On success, sign an HS256 JWT.
- **JWT payload:** `{ "sub": <userId>, "email": <email> }`, signed with `JWT_SECRET`, expiry `JWT_EXPIRES_IN` (default `1h`).
- **Success response:** `200 OK`
  ```json
  { "accessToken": "jwt-token" }
  ```
- **Acceptance criteria:**
  - Unknown email **or** wrong password returns the same opaque `401 Unauthorized` with message `Invalid credentials` (no field-level disclosure).
  - Token verifies with `JWT_SECRET` and decodes to the expected payload.

#### FR-3 — Protected endpoint · `GET /auth/me`
- **Auth:** Requires a valid `Authorization: Bearer <token>` header, enforced by `JwtAuthGuard`.
- **Behavior:** Resolve the user from the token's `sub`; return the safe user object.
- **Success response:** `200 OK`
  ```json
  { "id": "uuid-v7", "email": "user@example.com", "createdAt": "ISO-8601", "updatedAt": "ISO-8601" }
  ```
- **Acceptance criteria:**
  - Missing/malformed/expired/invalid token returns `401 Unauthorized`.
  - Demonstrates the reusable guard + `@CurrentUser()` decorator pattern.

### Should Have (P1)
- Consistent, typed config access (no scattered `process.env` reads).
- Clear npm scripts for migration generate/apply.

### Out of Scope (this stage)
See [Out of Scope](#out-of-scope).

---

## Technical Architecture

### Directory Structure
```txt
src/
  config/
    env.validation.ts        # validated env schema (fail-fast)
  database/
    schema/
      users.schema.ts
    migrations/              # drizzle-kit output
    database.module.ts       # global module, exposes typed Drizzle client
    database.providers.ts    # pg Pool + drizzle() provider
    drizzle.config.ts        # (or root-level drizzle.config.ts)

  modules/
    auth/
      controllers/
        auth.controller.ts
      services/
        auth.service.ts
      dto/
        register.dto.ts
        login.dto.ts
      guards/
        jwt-auth.guard.ts
      strategies/
        jwt.strategy.ts
      decorators/
        current-user.decorator.ts
      interfaces/
        jwt-payload.interface.ts
      auth.module.ts

  common/
    config/
    decorators/
    utils/
```
> Note: this consolidates the draft's structure. `database/` is promoted to a **global module** so future modules reuse the same typed client.

### Data Model — `users` table
Defined with Drizzle.

| Column       | Type                        | Constraints                                              |
|--------------|-----------------------------|----------------------------------------------------------|
| `id`         | `uuid`                      | Primary key. App-generated UUID v7 via `$defaultFn`.     |
| `email`      | `varchar`/`text`            | `NOT NULL`, `UNIQUE`. Stored normalized (trim+lowercase).|
| `password`   | `varchar`/`text`            | `NOT NULL`. bcrypt hash. Never selected into API output. |
| `created_at` | `timestamptz`               | `NOT NULL`, default `now()`.                             |
| `updated_at` | `timestamptz`               | `NOT NULL`, default `now()` (app updates on write).      |

- Unique constraint on `email` enforces uniqueness at the DB level (belt-and-suspenders alongside the app check).
- The `password` column is excluded from all serialized responses (services return an explicit safe-user projection; never `SELECT *` into a response).

### Database Integration
- A **global `DatabaseModule`** provides a typed Drizzle client (over a `pg.Pool`) through Nest DI.
- Services inject the client and run typed queries directly — **no repository pattern**.

### Migrations
- Generated from the schema with `drizzle-kit generate`.
- Applied **manually** via an npm `migrate` script (run by developer/deploy step). **No auto-run on application boot.**
- Suggested scripts: `db:generate`, `db:migrate`.

### Configuration
- `@nestjs/config` loads env and is validated by a typed schema (`env.validation.ts`).
- App **fails fast** at startup if any required variable is missing or invalid.

### Validation
- Global `ValidationPipe` configured **strict**: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- `RegisterDto` / `LoginDto`:
  - `email`: valid email format (`@IsEmail`).
  - `password`: string, **min length 8, max length 72** (bcrypt's effective byte limit). No complexity rules this stage.
- Validation failures return `400 Bad Request` via Nest's standard error shape.

### JWT
- Algorithm: **HS256** (symmetric), secret from `JWT_SECRET`.
- Expiry: `JWT_EXPIRES_IN` (default `1h`).
- `JwtStrategy` (passport-jwt) extracts the bearer token, verifies signature/expiry, and populates the request user from the payload.
- `JwtAuthGuard` wraps the strategy for route protection.
- **No refresh tokens** this stage.

### Public Interface
The `auth` module exports exactly:
- `JwtAuthGuard` — for other modules to protect routes.
- `@CurrentUser()` decorator — to read the authenticated user (`{ sub, email }`) in handlers.

Everything else (`AuthService`, DTOs, strategy internals) remains private to the module.

### Error Handling
Uses NestJS exceptions; responses use Nest's default error JSON shape.

| Case                         | Status | Notes                                                      |
|------------------------------|--------|------------------------------------------------------------|
| Validation failure           | `400`  | Field-level messages from `class-validator`.               |
| Duplicate email (register)   | `409`  | `Email already registered` (or similar).                   |
| Invalid credentials (login)  | `401`  | Opaque `Invalid credentials` — no field disclosure.        |
| Missing/invalid/expired JWT  | `401`  | `Unauthorized`.                                            |

---

## Security Requirements

- Passwords hashed with **bcrypt (cost 12)**; plaintext is never stored.
- The `password` field is never returned in any response and never logged.
- All secrets (`JWT_SECRET`, `DATABASE_URL`) come from environment variables; none committed.
- JWTs validated for signature and expiry on every protected request.
- Login errors are opaque to avoid user enumeration.
- Email uniqueness enforced at both app and DB layers.

## Non-Functional Requirements

- **Performance:** Auth endpoints respond in well under typical web latency budgets; bcrypt cost tuned to 12 (acceptable per-login CPU cost).
- **Scalability:** UUID v7 PKs chosen for index locality and append-heavy future workloads.
- **Reliability:** Fail-fast config validation; migrations applied deliberately, not implicitly.
- **Maintainability:** SQL-first, minimal abstraction, isolated module boundaries.

## Environment Variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sync_platform
JWT_SECRET=your_secret
JWT_EXPIRES_IN=1h
```
All are **required** and validated at startup (`JWT_EXPIRES_IN` may default to `1h` if unset).

---

## Out of Scope

Not implemented in this stage (deferred to future stages):

- RBAC / permissions
- OAuth providers / social login / SSO
- API keys / service accounts
- Refresh tokens
- Email verification / account activation / email sending
- Password reset
- Sessions / session storage / session tracking
- Multi-tenant auth
- Rate limiting
- Audit logging
- Automated tests (unit/e2e) — explicitly deferred this stage

## Future Extensions (architecture must accommodate, not build now)

- RBAC, OAuth providers, API keys, service accounts, refresh tokens, audit logging, multi-tenant auth, session tracking, SSO integrations.

---

## Key Decisions Log

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | JWT payload + algorithm | `{ sub, email }`, HS256 | Simplest verifiable token for Stage 1; supports `/auth/me` resolution. |
| 2 | Password policy | min 8 / max 72, no complexity | Low friction, matches "intentionally small"; 72 = bcrypt limit. |
| 3 | Email handling | trim + lowercase before store/uniqueness | Prevents duplicate-by-case accounts. |
| 4 | `/auth/me` response | `{ id, email, createdAt, updatedAt }` | Useful safe projection; never password. |
| 5 | Config | `@nestjs/config` + validated schema | Production-oriented, fail-fast. |
| 6 | Drizzle wiring | Global `DatabaseModule` provider | Clean boundary reusable by future modules. |
| 7 | Migrations | Manual via npm scripts, no boot auto-run | Safest for production. |
| 8 | Public interface | `JwtAuthGuard` + `@CurrentUser()` | Minimum other modules need; keeps internals private. |
| 9 | Errors | Nest exceptions; opaque login 401 | Standard + avoids user enumeration. |
| 10 | UUID v7 | `uuid` `v7()` as Drizzle `$defaultFn` | App-level generation per draft; auto on insert. |
| 11 | ValidationPipe | Strict (whitelist + forbidNonWhitelisted + transform) | Tight DTO contract. |
| 12 | Tests | None this stage | Per stakeholder; deferred. |
| 13 | bcrypt cost | 12 | Production-oriented default. |

## Expected Outcome

At the end of this stage the project has:

- A working modular `auth` system (register / login / protected `/auth/me`).
- PostgreSQL persistence via Drizzle ORM with typed queries.
- UUID v7 identifiers generated at the application layer.
- HS256 JWT authentication with route protection via guard.
- A clear, manual migration system.
- Validated, fail-fast environment configuration.
- Clean modular boundaries with a narrow public interface.
- A scalable, production-oriented foundation for future modules.

## Open Questions for Implementation

- `varchar(length)` vs `text` for `email`/`password` columns (cosmetic; either works).
- Whether to keep `drizzle.config.ts` at repo root (drizzle-kit convention) vs under `src/database/`.
- Exact `pg.Pool` sizing/connection options (can use sensible defaults for Stage 1).

## Appendix: Discovery Notes

This Final PRD was produced from `docs/prd/draft/auth-module-draft-prd.md` via a structured discovery interview. The draft was strong on scope and non-goals but lacked precise contracts (JWT payload, password policy, error semantics, response shapes) and architectural decisions (config strategy, DB wiring, migration execution, module public interface). Those gaps were resolved with the stakeholder and are recorded in the [Key Decisions Log](#key-decisions-log).
