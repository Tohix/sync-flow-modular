# PRD — Auth Module (Stage 1)

## Project

Data Synchronization Platform

Backend-heavy modular monolith platform for:

- event processing
- integrations
- synchronization between external systems
- jobs/workers
- audit logs
- notifications

Current stage:

Stage 1 — Modular Monolith

---

# Tech Stack

- NestJS
- PostgreSQL
- Drizzle ORM
- Docker
- JWT Authentication

---

# Goal

Implement a minimal, clean, and production-oriented authentication module.

The goal is NOT to build a complete enterprise auth system immediately.

The goal is to establish:

- proper modular boundaries;
- authentication flow;
- typed persistence layer;
- scalable architectural foundation.

Additional features will be implemented incrementally in future stages.

---

# Architecture Principles

## 1. Modular Monolith

The project follows modular monolith architecture.

Each domain must remain isolated and self-contained.

Future modules:

- auth
- events
- integrations
- jobs
- notifications
- audit logs

The auth module should expose only required public interfaces.

Avoid tight coupling between modules.

---

## 2. Incremental Complexity

Do NOT implement advanced auth functionality yet.

Current implementation should intentionally remain small and simple.

Do NOT implement:

- refresh tokens
- RBAC
- OAuth providers
- API keys
- email verification
- password reset
- sessions
- multi-tenancy
- social login

Those features will be added later.

---

## 3. SQL-First Approach

Use Drizzle ORM with explicit SQL-oriented architecture.

Avoid excessive abstractions.

Prefer:

- explicit schemas;
- typed queries;
- clear migrations;
- transparent database interactions.

---

## 4. UUID v7 Strategy

The system should use UUID v7 identifiers across all modules.

Reasoning:

- better PostgreSQL index locality;
- improved insert performance;
- reduced B-Tree fragmentation;
- chronological ordering;
- better scalability for append-heavy workloads.

This is important because the platform will eventually contain:

- events;
- audit logs;
- jobs;
- retries;
- webhook deliveries;
- integration executions.

UUID v7 should be generated at the application level.

Do NOT use auto-increment IDs.

---

# Current Scope

The auth module should support:

- user registration;
- user login;
- JWT access token generation;
- password hashing;
- authenticated endpoint example;
- PostgreSQL persistence.

---

# Directory Structure

Recommended structure:

```txt
src/
  database/
    schema/
    migrations/
    drizzle/

  modules/
    auth/
      controllers/
      services/
      dto/
      guards/
      strategies/
      interfaces/
      types/
      auth.module.ts

  common/
    config/
    decorators/
    utils/
```

---

# Database

## Users Table

Create users table using Drizzle ORM.

Fields:

- id (UUID v7 primary key)
- email (unique)
- password (hashed password)
- created_at
- updated_at

Requirements:

- email must be unique;
- password must never be returned from API responses;
- timestamps should be generated automatically;
- UUIDs should be generated in application layer using UUID v7.

---

# UUID Generation

Use UUID v7 package support.

Recommended package:

```bash
npm install uuid
```

Example:

```ts
import { v7 as uuidv7 } from 'uuid';

const id = uuidv7();
```

All future modules should consistently use UUID v7.

---

# Drizzle ORM

Use Drizzle ORM with PostgreSQL.

Requirements:

- schema-first approach;
- generated migrations;
- migration scripts;
- typed queries.

Avoid repository pattern for now unless truly necessary.

Direct database access through services is acceptable at this stage.

---

# Authentication Flow

## Registration

Endpoint:

POST /auth/register

Input:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Behavior:

- validate request;
- check existing user;
- hash password using bcrypt;
- generate UUID v7;
- persist user;
- return created user without password.

---

## Login

Endpoint:

POST /auth/login

Input:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Behavior:

- validate credentials;
- compare password hash;
- generate JWT access token;
- return access token response.

Example response:

```json
{
  "accessToken": "jwt-token"
}
```

---

# JWT

Use JWT access tokens only.

Requirements:

- configurable secret through environment variables;
- token expiration support;
- JWT strategy;
- route protection using guards.

Do NOT implement refresh tokens yet.

---

# Protected Endpoint

Add example protected endpoint:

GET /auth/me

Behavior:

- requires valid JWT token;
- returns authenticated user;
- demonstrates auth guard usage.

---

# Validation

Use DTO validation.

Requirements:

- email validation;
- minimum password length;
- proper HTTP validation errors.

Use NestJS ValidationPipe.

---

# Security Requirements

Requirements:

- passwords must be hashed using bcrypt;
- never store plain passwords;
- never expose password field;
- use environment variables for secrets;
- validate JWT tokens properly.

---

# Error Handling

Provide proper errors for:

- duplicate email;
- invalid credentials;
- unauthorized access;
- invalid JWT token.

Use NestJS exceptions.

---

# Environment Variables

Required environment variables:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sync_platform

JWT_SECRET=your_secret

JWT_EXPIRES_IN=1h
```

---

# Non-Goals

Do NOT implement:

- RBAC;
- permissions;
- OAuth;
- refresh tokens;
- rate limiting;
- account activation;
- email sending;
- password reset;
- API keys;
- session storage;
- audit logging.

Keep implementation intentionally small.

---

# Future Extensions (Not Now)

Architecture should support future implementation of:

- RBAC;
- OAuth providers;
- API keys;
- service accounts;
- refresh tokens;
- audit logging;
- multi-tenant auth;
- session tracking;
- SSO integrations.

Do NOT implement them now.

---

# Expected Outcome

At the end of this stage the project should have:

- working modular auth system;
- PostgreSQL persistence;
- Drizzle ORM integration;
- UUID v7 identifiers;
- JWT authentication;
- protected routes;
- migration system;
- clean modular boundaries;
- scalable production-oriented foundation.
