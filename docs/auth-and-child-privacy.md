# Authentication and child privacy

## Account model

- The primary account belongs to a parent or guardian and uses Better Auth email/password authentication.
- A child profile belongs to exactly one parent account. It uses a generated six-character profile code and a four-digit PIN, so the child does not need an email address.
- A successful child login creates an in-app notification for the parent account.
- Child sessions expire after 12 hours. Session tokens are random, stored only as SHA-256 hashes in the database, and sent in `HttpOnly`, `SameSite=Lax` cookies.
- Child PINs are salted and hashed with `scrypt`; plaintext PINs are never stored.

## Data boundary

The application schema stores only:

- Better Auth parent user, account, session and verification records;
- child display name, login code and hashed PIN;
- child login notifications;
- product image URL and explicitly entered product information.

There are no database columns, API endpoints or browser permission requests for a child's voice, face, biometric template, camera recording or microphone recording.

The product record endpoint accepts only `imageUrl` and an `input` JSON object. Ownership is always derived from the authenticated parent or child session rather than accepted from the client.

## Operational notes

- Set `BETTER_AUTH_SECRET` to a high-entropy value of at least 32 characters.
- Store `DATABASE_URL` as a secret environment variable in Render. Use Neon's pooled connection string for the running application; no Render persistent disk is needed.
- Schema migrations run automatically at server startup. For a larger production system, run migrations separately with a direct (non-pooled) Neon connection before deployment.
- Serve production over HTTPS so authentication cookies use the `Secure` attribute.
- This implementation provides technical data-minimization safeguards. Legal compliance also depends on the final privacy notice, parental-consent process, retention/deletion policy and the jurisdictions where the product is offered; those require product/legal review before a public launch.
