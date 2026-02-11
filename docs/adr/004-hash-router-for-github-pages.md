# ADR-004: HashRouter for GitHub Pages Compatibility

**Status**: Accepted
**Date**: 2025-12-03
**Decision Makers**: Development Team

---

## Context

The application needs client-side routing for navigation between pages (Dashboard, Load Calculator, Circuit Design, etc.). React Router offers two main options:

1. **BrowserRouter** - Clean URLs using HTML5 History API (`/project/123/circuits`)
2. **HashRouter** - Hash-based URLs (`/#/project/123/circuits`)

**Deployment target**: Static hosting (GitHub Pages, Netlify, Vercel, etc.)

**Problem with BrowserRouter on static hosts**:
- User navigates to `/project/123/circuits`
- Server looks for file `/project/123/circuits/index.html`
- File doesn't exist → 404 error
- **Solution**: Server must rewrite all routes to `/index.html` (requires configuration)

---

## Decision

**Use HashRouter for client-side routing.**

**Implementation**:
```typescript
// App.tsx
import { HashRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <HashRouter>  {/* Not BrowserRouter */}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/project/:id/*" element={<ProjectWrapper />} />
      </Routes>
    </HashRouter>
  );
}
```

**URLs look like**:
- Dashboard: `https://example.com/#/`
- Project overview: `https://example.com/#/project/abc123/overview`
- Circuit design: `https://example.com/#/project/abc123/circuits`

---

## Alternatives Considered

### Option A: BrowserRouter + Server Rewrites
**Description**: Use BrowserRouter, configure server to rewrite all routes to `/index.html`

**Pros**:
- ✅ Clean URLs (no `#` in URL)
- ✅ Better SEO (Google crawls clean URLs better)
- ✅ Standard modern web app pattern

**Cons**:
- ❌ Requires server configuration (not simple static file hosting)
- ❌ Different config per hosting platform:
  - Netlify: `_redirects` file
  - Vercel: `vercel.json` rewrites
  - GitHub Pages: Not directly supported (workaround needed)
  - Apache: `.htaccess` rules
  - Nginx: `nginx.conf` rules
- ❌ More complex deployment (easy to misconfigure)
- ❌ 404 errors if misconfigured (bad UX)

**Example Netlify `_redirects`**:
```
/*    /index.html   200
```

**Why rejected**: Deployment complexity not worth cosmetic URL improvement.

### Option B: Static Site Generation (SSG)
**Description**: Pre-render all routes at build time (e.g., Next.js SSG)

**Pros**:
- ✅ Clean URLs
- ✅ Better SEO
- ✅ Faster initial page load

**Cons**:
- ❌ Requires build-time knowledge of all routes (impossible for user-generated projects)
- ❌ Dynamic project IDs can't be pre-rendered
- ❌ Would require full framework migration (Next.js/Gatsby)

**Why rejected**: Our app is fundamentally dynamic (user projects). SSG doesn't fit.

### Option C: Memory Router (Testing Only)
**Description**: In-memory router (no URLs)

**Why rejected**: Only for tests, not production use.

---

## Consequences

### Positive Consequences
- ✅ **Zero configuration deployment**: Upload `/dist/` folder, done
- ✅ **Works on any static host**: GitHub Pages, Netlify, Vercel, S3, etc.
- ✅ **No 404 errors**: Hash routes handled entirely client-side
- ✅ **Simple mental model**: Everything after `#` is client-side routing
- ✅ **Smaller attack surface**: No server-side routing to secure

### Negative Consequences
- ❌ **Ugly URLs**: `#` in every URL (e.g., `/#/project/123`)
- ❌ **SEO impact**: Search engines treat hash as same page (not relevant for auth-protected SaaS)
- ❌ **URL sharing quirks**: Some tools strip hash fragments (rare)
- ❌ **Perceived as "old-school"**: Modern SPAs typically use BrowserRouter

### Neutral Consequences
- ℹ️ **Browser back/forward work correctly**: HashRouter handles history properly
- ℹ️ **No SSR possible**: Hash routing is client-only (not an issue for us)

---

## Implementation Notes

**Routing structure**:
```typescript
<HashRouter>
  <Routes>
    {/* Public routes */}
    <Route path="/" element={<LandingPage />} />
    <Route path="/dashboard" element={<Dashboard />} />

    {/* Project routes (nested) */}
    <Route path="/project/:id/*" element={<ProjectWrapper />}>
      <Route path="overview" element={<ProjectOverview />} />
      <Route path="load-calc" element={<LoadCalculator />} />
      <Route path="circuits" element={<CircuitDesign />} />
      <Route path="grounding" element={<GroundingBonding />} />
      <Route path="inspection" element={<InspectionChecklist />} />
      <Route path="calculators" element={<Calculators />} />
    </Route>
  </Routes>
</HashRouter>
```

**URL examples**:
```
Development:  http://localhost:3000/#/project/abc123/circuits
Production:   https://sparkplan.io/#/project/abc123/circuits
```

**Navigation using React Router**:
```typescript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/project/abc123/circuits');  // Becomes /#/project/abc123/circuits
```

**External links** (from email, Slack, etc.):
```html
<a href="https://sparkplan.io/#/project/abc123/circuits">View circuits</a>
```

---

## Compliance & Standards

**React Router patterns**:
- Follows React Router v6 API
- Nested routes using `<Outlet>` in parent component
- Type-safe route params using `useParams<{ id: string }>()`

**Browser compatibility**:
- Works in all modern browsers (IE11+ supports `hashchange` event)
- No polyfills needed

---

## Monitoring & Validation

**Metrics to track**:
- 404 error rate (target: 0% for hash routes)
- Average deployment time (target: <2 minutes)
- URL sharing success rate (users able to share/bookmark URLs)

**Success criteria**:
- ✅ Zero deployment configuration needed
- ✅ No 404 errors reported
- ✅ URL sharing works reliably

**Review date**: 2026-06-01 (re-evaluate if SEO becomes important)

---

## References

- [React Router HashRouter docs](https://reactrouter.com/en/main/router-components/hash-router)
- [Why hash routing is still relevant (2023)](https://kentcdodds.com/blog/why-i-still-use-hash-routing)
- [GitHub Pages SPA deployment](https://github.com/rafgraph/spa-github-pages)

---

## Notes

**SEO consideration**: Our application is **auth-protected SaaS**, not public content. No SEO requirements. Hash URLs acceptable.

**If SEO becomes important**: Switch to BrowserRouter + server rewrites. Migration is straightforward (change `HashRouter` to `BrowserRouter`, add server config).

**Workaround for GitHub Pages + BrowserRouter**: Use [`spa-github-pages`](https://github.com/rafgraph/spa-github-pages) hack (copies `index.html` to `404.html`). Works but feels fragile.

**Current verdict**: HashRouter perfect for our use case. No plans to change.
