This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Follow Up Boss (FUB) Lead Sync

This project sends every newly captured lead to Follow Up Boss by default.

- Buyer pages are sent as `General Inquiry`
- Seller pages are sent as `Seller Inquiry`
- Dispatch happens after the lead is saved locally; failures do not block form submission

### Required environment variables

Add these to your `.env`:

```bash
FUB_ENABLED=true
FUB_API_KEY=your_fub_api_key
FUB_SYSTEM=your_registered_system_name
FUB_SYSTEM_KEY=your_registered_system_key
```

### Optional tuning variables

```bash
FUB_API_BASE_URL=https://api.followupboss.com
FUB_TIMEOUT_MS=8000
FUB_MAX_ATTEMPTS=3
FUB_INITIAL_BACKOFF_MS=750
FUB_INCLUDE_RAW_JSON=false
```

## Custom Domains (Vercel Multi-tenant)

This app can serve many custom domains from one deployment by resolving pages by `hostname + slug`.

### Required environment variables

```bash
PLATFORM_HOSTS=abc.com,www.abc.com
VERCEL_DOMAINS_ENABLED=true
VERCEL_TOKEN=your_vercel_api_token
VERCEL_PROJECT_ID=your_vercel_project_id
```

### Optional environment variables

```bash
VERCEL_TEAM_ID=your_vercel_team_id
VERCEL_API_BASE_URL=https://api.vercel.com
VERCEL_API_TIMEOUT_MS=8000
DEV_FALLBACK_HOSTNAME=bendhomes.us
PREVIEW_HOSTS=localhost,127.0.0.1
ALLOW_VERCEL_PREVIEW_HOSTS=true
DOMAIN_ROOT_DEFAULT_SLUG=home
```

### New admin endpoints

- `GET /api/admin/domains/{id}/status`
- `POST /api/admin/domains/{id}/verify`

Creating/updating/deleting domains through admin APIs now also adds/verifies/removes domains in Vercel.

### Test flow (step-by-step)

1. Set env vars above and restart your app.
2. Log in and create a domain in `Admin -> Domains`.
3. Call `GET /api/admin/domains/{id}/status` and read `recommendedDnsRecords` (and `verification` if present).
4. Add those DNS records at your registrar.
5. Call `POST /api/admin/domains/{id}/verify` until `verified=true`.
6. Create and publish at least one page for that domain.
7. Open `https://your-domain.com/<slug>` and confirm tenant page renders.
8. Open `https://your-domain.com/` and confirm it redirects to the tenant root slug.
9. Open `https://your-domain.com/admin` and confirm it is blocked/redirected.
10. Create same slug on another domain and confirm both domains work independently.

### Official Vercel docs

- Add domain to project: https://docs.vercel.com/docs/rest-api/reference/endpoints/projects/add-a-domain-to-a-project
- Get project domain: https://docs.vercel.com/docs/rest-api/reference/endpoints/projects/get-a-project-domain
- Verify project domain: https://docs.vercel.com/docs/rest-api/reference/endpoints/projects/verify-project-domain
- Get domain configuration: https://docs.vercel.com/docs/rest-api/reference/endpoints/domains/get-a-domains-configuration
- Domain setup guide (DNS + verification): https://vercel.com/docs/domains/working-with-domains/add-a-domain

## Email templates (Resend + React Email)

Lead notifications and document-delivery emails use [`@react-email/components`](https://react.email/) with HTML + plain-text rendering via `@react-email/render`. Templates live under `emails/`; rendering helpers are in `lib/email-render.tsx`.

Preview HTML locally (writes to `scripts/email-preview-output/`, gitignored):

```bash
npm run test:email
```

Optional: send two test messages through Resend (requires verified domain / sender):

```bash
set RESEND_API_KEY=re_...
set RESEND_FROM_EMAIL="Name <notifications@yourdomain.com>"
set EMAIL_TEST_TO=you@example.com
npm run test:email
```
