# Bot protection and loading changes

Updated 30 October 2026.

## Authentication

Login requires email and password without CAPTCHA. Registration requires a six-character CAPTCHA from `GET /api/auth/captcha?purpose=register`. Send the returned ID and entered answer in `X-Captcha-Id` and `X-Captcha-Answer` headers. Registration checks these before multipart photo processing. Login attempt throttling remains enabled.

Codes are generated with cryptographic randomness, expire after five minutes, and are bound to the client IP and purpose. The first attempt consumes a code, including a wrong answer. The server stores an HMAC digest; responses contain only the ID, SVG image and expiration. Frontend refresh and failure handling discard the previous answer. Labels are available in Russian and Kyrgyz.

Limits per client IP:

| Endpoint | Limit |
| --- | --- |
| API | 240 requests/minute |
| CAPTCHA issuance | 30 requests/5 minutes |
| Login | 20 attempts/15 minutes |
| Registration | 5 attempts/hour |

HTTP 429 includes Retry-After. The public gateway replaces forwarding headers using Cloudflare's client IP; the backend trusts only loopback proxies. This assumes the gateway remains loopback-only and the public entry remains Cloudflare Tunnel. Restarting the backend clears limits and invalidates outstanding codes.

The stores are process-local. Multiple backend instances require shared challenge and limiter stores. This is basic spam/brute-force protection; image CAPTCHA can be attacked with OCR, and application throttling does not provide network DDoS protection. There is currently no audio CAPTCHA alternative.

## Loading

Secondary pages load in separate JavaScript chunks. The current initial main JS is 496,918 bytes (previously 565,155); gzip transfer measured at 130,963 bytes. The build reports 129.21 kB gzip, down 11.74 kB from its previous build baseline. Office dependencies remain in separate chunks.

The gateway compresses responses, caches hashed static assets for one year with immutable, revalidates HTML, and disables caching for authentication/CAPTCHA responses. Production debugging maps are disabled in `frontend/.env.production`.

## Validation

- `node --test verify-bot-protection.cjs`: three passing scenarios covering missing/wrong/expired/replayed/cross-IP/cross-form CAPTCHA, rate limiting and bounded storage.
- Frontend: all 15 tests in 11 suites pass; production build succeeds without warnings.
- `node verify-users.cjs`, `node verify-registration.cjs`, `node verify-workflow.cjs`: pass. Temporary database fixtures are removed by their cleanup handlers.
- The auth integration checks use `verification-auth.cjs`, a separate loopback-only fixture server with generated test challenges. The production API has no test bypass.
- Registration rejects missing CAPTCHA before photo handling. Login accepts credentials without CAPTCHA and retains attempt throttling.
- Gateway gzip/cache headers and the online mobile login/registration UI were checked; Kyrgyz labels render correctly.
