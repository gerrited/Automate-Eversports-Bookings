# ADR-002: Eversports as the Sole Identity Provider

**Date:** 2026-04-11  
**Status:** Accepted

## Context

The platform needs user authentication. Users already have Eversports accounts, and the booking system fundamentally requires valid Eversports credentials to operate. We considered three options:

1. Build a separate username/password system and store Eversports credentials independently.
2. Use Eversports as the identity provider — forward credentials to Eversports on login, issue our own JWT on success.
3. OAuth / SSO with a third-party provider (Google, etc.) — not viable since Eversports credentials are still required regardless.

## Decision

**Eversports is the only authentication anchor.** There is no separate password system.

Login flow:
1. User submits email + password via `POST /api/auth/login`.
2. Backend forwards credentials to the Eversports GraphQL mutation `LoginCredentialLogin`.
3. On failure: return `401` to the frontend.
4. On success: extract `user.id` from the Eversports response, upsert the user in our database, store the AES-256 encrypted password, and issue a 24-hour HS256 JWT.
5. The frontend stores the JWT in `localStorage` and sends it as `Authorization: Bearer <token>` on every subsequent request.

The encrypted password is stored so the **worker** can later perform bookings without requiring the user to be logged in at booking time.

On every login, the encrypted password in the database is refreshed. This means password changes on the Eversports side are automatically picked up at the next login.

## Consequences

- No password reset flow needed — users manage their password entirely on Eversports.
- If a user's Eversports password changes and they do not log in again, the worker will fail to book until the next login.
- The `ENCRYPTION_KEY` Kubernetes secret must be present in both the backend and the worker — it is the single point of failure for credential storage. Rotating it requires re-encryption of all stored passwords.
- JWT expiry is 24 hours. There is no refresh token mechanism; users re-authenticate by logging in again.
