# Blynta landing page

Next.js App Router marketing site, using the existing blue/slate theme and shadcn Base UI components.

## Run

```sh
npm install
npm run dev -- --port 3002
```

The main frontend runs separately on port 3000. Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_SITE_URL`: production marketing origin (defaults to https://blynta.com).
- `NEXT_PUBLIC_APP_URL`: main app origin (local default http://localhost:3000). Every conversion CTA links to `/login`, as requested. Set this to the real deployed app origin before building for production.

## Verify

```sh
npm run lint
npm run build
npm run start -- --port 3002
```

The page and layout are server components, prerendered as HTML. Only the FAQ uses a client component; the mobile navigation is a native disclosure. The product illustration is explicitly labeled as a workflow preview, not fabricated customer results.

SEO includes canonical metadata, Open Graph and Twitter image routes, Organization/WebSite/SoftwareApplication/FAQPage JSON-LD, sitemap.xml, robots.txt, and a branded SVG icon. The sitemap includes only the real page, not section hashes. No invented testimonials, customer logos, ratings, or performance statistics are used. Add deployment-specific crawler restrictions for preview deployments at the hosting layer.

## Content sources

- Design reference: https://www.reflexai.com/, https://www.reflexai.com/products/prepare, https://www.reflexai.com/pricing — spacious editorial headings, modular product visuals, alternating pale sections and clear conversion paths, adapted to Blynta's existing colors.
- Category research: https://www.opus.pro/ and https://www.descript.com/clips — highlight discovery, captions, and repurposing workflows. Copy is original; Blynta capability claims come from this repository.
- Product evidence: `../backend/src/jobs/dto/create-job.dto.ts`, `../backend/src/jobs/jobs.service.ts`, `../backend/src/media/style-presets.ts`, `../backend/src/youtube/`, and `../frontend/features/billing/components/BillingPage.tsx`.
- Prices are the existing frontend display prices ($0/$12/$39), not independently verified Paddle prices. Confirm against live billing before launch. Update the centralized plan definitions in `lib/site.ts` when billing changes.

No frontend authentication or backend behavior was changed. No third-party analytics or cookies were added. Legal policy pages should only be published once approved product-specific policies are supplied.
