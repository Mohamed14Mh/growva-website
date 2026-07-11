# GROWVA Admin System Architecture Report

Audit date: 2026-07-02  
Project root: `C:\Users\Asmaa\Downloads\files`

## Executive Summary

GROWVA is currently a premium static multi-page website with a large amount of hardcoded content and a centralized visual/animation system. The project has grown beyond the original homepage into a full site with 54 HTML pages:

- 9 root pages.
- 20 individual service pages under `services/`.
- 6 work category pages under `work/`.
- 19 individual portfolio project pages under nested `work/*/` folders.

The site is visually advanced but content-operationally static. Every page duplicates the same header, footer, preloader, cursor, and page-transition markup. The shared behavior lives mainly in `js/script.js`, and the shared design system lives mainly in `css/style.css`.

The best path is not to build a second dashboard website. The best path is to keep one single public website, add an authenticated Admin/Edit Mode to the same frontend, and back it with Supabase Auth, Supabase Postgres, Supabase Storage, Row Level Security, and a preview/publish content layer.

Recommended architecture: **Option C: Static website + Supabase Auth + Supabase Database + Supabase Storage**, with a future migration from duplicated HTML to data-driven templates.

This allows:

- Real owner/editor login.
- Real permanent saving.
- Image/file uploads.
- Preview before publish.
- Role-based permissions.
- GitHub Pages compatibility for the public static frontend.
- Client-resell suitability without requiring the client to touch code.

## 1. Project Structure Audit

### High-Level Structure

```text
/
  index.html
  shopify.html
  services.html
  process.html
  about.html
  pricing.html
  faq.html
  contact.html
  work.html
  css/
    style.css
  js/
    script.js
  services/
    20 service detail pages
  work/
    6 category pages
    19 project detail pages
  output/playwright/
    screenshot artifacts from QA passes
  README.md
  style.css
  script.js
```

### Important Files And Roles

| File / Folder | Role | Admin/CMS Relevance |
|---|---|---|
| `index.html` | Homepage with hero, stack-deck animation, service teasers, process teaser, stats, latest projects, testimonials, final CTA. | High priority. Needs editable hero, cards, services, process steps, stats, projects, testimonials, CTAs. |
| `shopify.html` | Shopify-focused landing page with bento intro and chapter navigation. | Needs editable page hero, chapter content, pillars, process steps, integrations, CTA. High animation risk due chapter ScrollTriggers. |
| `services.html` | Services directory hub with bento intro, page hero, tabbed department directory, final CTA. | Should render from `service_categories` and `services` data. Inline tab script should move to shared JS. |
| `process.html` | Process page with bento intro, 9-stage timeline, stats, final CTA. | Process stages should become ordered records. |
| `about.html` | About page with bento intro, story/mission/value/team-style content, stats, final CTA. | Editable editorial sections and stats. |
| `pricing.html` | Pricing page with bento intro and 8 pricing categories, 24 pricing cards. | High priority for admin. Pricing categories/cards/features should be structured data. |
| `faq.html` | FAQ page with bento intro, 5 FAQ categories, 23 FAQ items, final CTA. | Strong CMS candidate: simple category/item data. |
| `contact.html` | Contact page with bento intro, contact details, WhatsApp link, contact form, stats. | Editable contact methods, form options, success copy, stats. Form submission currently only frontend success state. |
| `work.html` | Work index/directory with 6 categories and visual cards. | Should render from `work_categories` data. |
| `services/*.html` | 20 individual service pages. Each has service hero, detail grid, timeline, related services, CTA. | Should eventually be one dynamic service template driven by service records. |
| `work/*.html` | 6 work category pages: Shopify Stores, Brand Identity, Packaging Design, Amazon Storefronts, Websites, Marketing & Print. | Should be one category template driven by work category/project records. |
| `work/*/*.html` | 19 project detail pages. | Should be one project template driven by project records. |
| `css/style.css` | Active stylesheet. Contains design tokens, nav, hero, bento galleries, work, services, pricing, contact, responsive rules, reduced motion, page transitions, tilt cards. | Must remain the visual source of truth. Admin styles should be isolated and not degrade public design. |
| `js/script.js` | Active behavior file. Handles preloader, Lenis, ScrollTrigger, Flip, Three.js visuals, mega menu, mobile menu, FAQ, work filters, tilt cards, page transitions. | Must be split later into public runtime modules and admin runtime modules. Reinitialization hooks are needed for dynamic content. |
| `README.md` | Older project note. It describes an earlier 3-file static version and GitHub Pages deployment. | Outdated for current architecture. Should eventually be replaced with current docs. |
| `style.css` | Legacy root stylesheet. Not referenced by current HTML pages. | Should remain untouched until a cleanup phase. Not part of active runtime. |
| `script.js` | Legacy root script. Not referenced by current HTML pages. | Should remain untouched until a cleanup phase. Not part of active runtime. |
| `output/playwright/*.png` | QA screenshots. | Not production content. Can be ignored by CMS. |

### Active Dependencies

All pages load these runtime libraries from CDNs:

- `three.js` r128
- `gsap` 3.12.5
- `ScrollTrigger`
- `Flip`
- `Lenis` 1.1.13
- Google Fonts: Fraunces, Inter, JetBrains Mono

There is no local package manager, bundler, build step, or backend currently.

### Shared Markup Duplication

Every audited HTML page includes duplicated global shell markup:

| Shared Surface | Count |
|---|---:|
| `<header class="nav">` | 54 pages |
| `<footer class="footer">` | 54 pages |
| `#pageTransition` | 54 pages |
| `#preloader` | 54 pages |
| `#cursorDot` / `#cursorRing` | 54 pages |
| `#ctaCanvas` | 27 pages |
| `#pageHeroCanvas` | 7 pages |
| `data-intro-gallery` bento intro | 7 pages |

This duplication is the largest maintainability risk. Admin Mode should not try to edit 54 separate header/footer copies. The future system should render shell content from one source of truth.

### Animation-Related Code

Primary animation and interaction surfaces in `js/script.js`:

| Area | Current Behavior | CMS Risk |
|---|---|---|
| Preloader | Page load progress simulation, hides before interaction. | Admin preview should not be blocked repeatedly while editing. |
| Lenis | Smooth scrolling on desktop/non-reduced-motion. | Dynamic content height changes require `lenis.resize()` and `ScrollTrigger.refresh()`. |
| Word headline reveals | Splits hero/page hero words into spans. | Must run after dynamic hero text renders, not before. |
| Custom cursor | Uses `[data-hover]` and `[data-cursor-text]`. | Admin controls need either cursor compatibility or opt-out. |
| Nav / burger / mega menus | Desktop mega hover, mobile accordion, active page state. | Dynamic nav/mega content must preserve data attributes and ARIA. |
| Reveal on scroll | Observes `.reveal-up`, `.reveal-line`. | Newly added sections need observer registration. |
| FAQ accordion | Opens/closes `.faq-item`. | Dynamic FAQ items need listener delegation or reinit. |
| Stats counters | Reads `.stat-num[data-count]`. | Editable stats must preserve machine-readable count. |
| Work filter | Filters `.case-card[data-category]` on old work/card surfaces. | Dynamic categories must normalize slugs. |
| Intro bento galleries | GSAP Flip + ScrollTrigger pinning for `.gallery--bento`. | High risk. Must not change DOM after ScrollTrigger setup without rebuild. |
| Legacy `#bentoGallery` | Additional bento path for older gallery implementation. | Should be retired or unified later. |
| Hero stack deck | Homepage pinned/scattered stack cards. | Stack card count/order changes affect GSAP assumptions. |
| Three.js hero/CTA/page canvases | WebGL visual layers. | Must keep canvas IDs and dimensions stable. |
| Brand object canvases | `[data-brand-object]` torus-knot visual. | Admin media/settings must not remove canvas accidentally. |
| Page transitions | Intercepts internal links and animates overlay. | Admin buttons/forms must opt out or prevent navigation interception. |
| Magnetic buttons | `[data-magnetic]`, `.btn`, `.magnetic`. | Admin UI should not inherit this unless intended. |
| Tilt cards | Adds `.has-tilt` to selected cards. | New dynamic cards need matching selectors or explicit opt-in. |
| Shopify chapter nav | ScrollTriggers for `shopify.html` chapters. | Reordering/adding chapters must rebuild chapter nav and triggers. |

## 2. Current Content Mapping

### Root Pages

| Page | Section | Content Type | Current Location | Should Be Editable? | Suggested Data Key |
|---|---|---|---|---|---|
| Home | SEO | title/meta | `index.html` head | Yes | `pages.home.seo` |
| Home | Global shell | nav, mega menus, footer | duplicated header/footer | Yes | `navigation.primary`, `navigation.mega`, `footer.columns` |
| Home | Hero | eyebrow, headline, subcopy, buttons | `.hero-content` | Yes | `pages.home.sections.hero` |
| Home | Hero stack deck | 4 animated cards, labels, links, CTA overlay text | `#stackDeck` | Yes, with locked count initially | `pages.home.sections.stack_deck.items` |
| Home | Marquee | industry labels | `.marquee-track` | Yes | `pages.home.sections.hero.marquee_items` |
| Home | What We Do | intro copy, 5 department cards, CTA | `.why` | Yes | `pages.home.sections.what_we_do` |
| Home | Compact services | 6 service links | `.services-compact-grid` | Yes, sourced from services | `pages.home.sections.service_teaser` |
| Home | Process teaser | 9 process steps | `.process-steps` | Yes | `process_steps` |
| Home | Stats | counters/labels | `.stats-grid` | Yes | `site_stats` or `pages.home.sections.stats` |
| Home | Latest Projects | 4 project cards | `.latest-projects` | Yes, sourced from work projects | `pages.home.sections.latest_projects` |
| Home | Testimonials | testimonial cards | `.testimonials` | Yes | `testimonials` |
| Home | Final CTA | headline, subcopy, buttons | `.final-cta` | Yes | `pages.home.sections.final_cta` |
| Shopify | SEO | title/meta | `shopify.html` head | Yes | `pages.shopify.seo` |
| Shopify | Bento intro | 8 bento tiles/captions | `.gallery-wrap` | Yes, cautiously | `pages.shopify.sections.intro_gallery` |
| Shopify | Hero | eyebrow, headline, subcopy | `.page-hero` | Yes | `pages.shopify.sections.hero` |
| Shopify | Chapters | 5 chapter sections, nav labels, cards | `.shopify-chapter` | Yes, with animation constraints | `pages.shopify.sections.chapters` |
| Shopify | CTA | final CTA text/buttons | `.final-cta` | Yes | `pages.shopify.sections.final_cta` |
| Services | SEO | title/meta | `services.html` head | Yes | `pages.services.seo` |
| Services | Bento intro | service department bento tiles | `.gallery-wrap` | Yes, cautiously | `pages.services.sections.intro_gallery` |
| Services | Hero | title/subtitle | `.page-hero` | Yes | `pages.services.sections.hero` |
| Services | Directory | 6 tabs, 20 links | `.service-directory` | Yes, sourced from services | `service_categories`, `services` |
| Services | CTA | final CTA text/buttons | `.final-cta` | Yes | `pages.services.sections.final_cta` |
| Process | SEO | title/meta | `process.html` head | Yes | `pages.process.seo` |
| Process | Bento intro | 8 intro tiles | `.gallery-wrap` | Yes, cautiously | `pages.process.sections.intro_gallery` |
| Process | Hero | title/subtitle | `.page-hero` | Yes | `pages.process.sections.hero` |
| Process | Timeline | 9 stages with bullets | `.process-timeline` | Yes | `process_steps` |
| Process | Stats | stats grid | `.stats-grid` | Yes | `site_stats` |
| Process | CTA | CTA | `.final-cta` | Yes | `pages.process.sections.final_cta` |
| About | SEO | title/meta | `about.html` head | Yes | `pages.about.seo` |
| About | Bento intro | 8 intro tiles | `.gallery-wrap` | Yes, cautiously | `pages.about.sections.intro_gallery` |
| About | Hero | title/subtitle | `.page-hero` | Yes | `pages.about.sections.hero` |
| About | Editorial sections | mission/story/approach/value copy | middle `.section` blocks | Yes | `pages.about.sections.*` |
| About | Stats | stats grid | `.stats-grid` | Yes | `site_stats` |
| About | CTA | final CTA | `.final-cta` | Yes | `pages.about.sections.final_cta` |
| Pricing | SEO | title/meta | `pricing.html` head | Yes | `pages.pricing.seo` |
| Pricing | Bento intro | 8 pricing tiles | `.gallery-wrap` | Yes, cautiously | `pages.pricing.sections.intro_gallery` |
| Pricing | Hero | title/subtitle | `.page-hero` | Yes | `pages.pricing.sections.hero` |
| Pricing | Pricing categories/cards | 8 categories, 24 cards | `.pricing-category`, `.pricing-card` | Yes | `pricing_categories`, `pricing_plans` |
| Pricing | CTA | final CTA | `.final-cta` | Yes | `pages.pricing.sections.final_cta` |
| FAQ | SEO | title/meta | `faq.html` head | Yes | `pages.faq.seo` |
| FAQ | Bento intro | 8 FAQ tiles | `.gallery-wrap` | Yes, cautiously | `pages.faq.sections.intro_gallery` |
| FAQ | Hero | title/subtitle | `.page-hero` | Yes | `pages.faq.sections.hero` |
| FAQ | FAQ categories/items | 5 categories, 23 items | `.faq-category`, `.faq-item` | Yes | `faq_categories`, `faq_items` |
| FAQ | CTA | final CTA | `.final-cta` | Yes | `pages.faq.sections.final_cta` |
| Contact | SEO | title/meta | `contact.html` head | Yes | `pages.contact.seo` |
| Contact | Bento intro | 8 contact tiles | `.gallery-wrap` | Yes, cautiously | `pages.contact.sections.intro_gallery` |
| Contact | Hero | title/subtitle | `.page-hero` | Yes | `pages.contact.sections.hero` |
| Contact | Contact methods | email, WhatsApp, copy | contact cards | Yes | `contact_settings.methods` |
| Contact | Form | fields, options, success text | `#contactForm` | Yes, controlled schema | `forms.project_inquiry` |
| Contact | Stats | stats grid | `.stats-grid` | Yes | `site_stats` |
| Work | SEO | title/meta | `work.html` head | Yes | `pages.work.seo` |
| Work | Hero | title/subtitle | `.page-hero` | Yes | `pages.work.sections.hero` |
| Work | Category directory | 6 category cards | `.work-cat-grid` | Yes | `work_categories` |
| Work | CTA | CTA band | `.cta-band` | Yes | `pages.work.sections.cta` |

### Service Detail Pages

Current service records:

| Service | Department | Current File | Suggested Data Key |
|---|---|---|---|
| Premium Shopify Website Development | Shopify & Ecommerce | `services/premium-shopify-website-development.html` | `services.premium-shopify-website-development` |
| Shopify CRO | Shopify & Ecommerce | `services/shopify-cro.html` | `services.shopify-cro` |
| Shopify Store Optimization | Shopify & Ecommerce | `services/shopify-store-optimization.html` | `services.shopify-store-optimization` |
| Brand Identity Design | Graphic Design | `services/brand-identity-design.html` | `services.brand-identity-design` |
| Packaging Design | Graphic Design | `services/packaging-design.html` | `services.packaging-design` |
| Ecommerce Strategy | Growth & Strategy | `services/ecommerce-strategy.html` | `services.ecommerce-strategy` |
| Conversion Optimization | Growth & Strategy | `services/conversion-optimization.html` | `services.conversion-optimization` |
| Growth Systems | Growth & Strategy | `services/growth-systems.html` | `services.growth-systems` |
| Website Maintenance | Growth & Strategy | `services/website-maintenance.html` | `services.website-maintenance` |
| Performance Optimization | Shopify & Ecommerce | `services/performance-optimization.html` | `services.performance-optimization` |
| Amazon Account Setup From Scratch | Amazon Seller Central | `services/amazon-account-setup.html` | `services.amazon-account-setup` |
| Amazon Account Management & Growth | Amazon Seller Central | `services/amazon-account-management.html` | `services.amazon-account-management` |
| Amazon Listing & Advertising Optimization | Amazon Seller Central | `services/amazon-listing-advertising-optimization.html` | `services.amazon-listing-advertising-optimization` |
| Company & Corporate Websites | Web Development | `services/corporate-websites.html` | `services.corporate-websites` |
| Portfolio & Personal Websites | Web Development | `services/portfolio-websites.html` | `services.portfolio-websites` |
| Custom Store Development | Web Development | `services/custom-store-development.html` | `services.custom-store-development` |
| Marketing & Social Media Design | Graphic Design | `services/marketing-social-design.html` | `services.marketing-social-design` |
| Business & Marketing Print | Printing | `services/business-marketing-print.html` | `services.business-marketing-print` |
| Packaging Print Production | Printing | `services/packaging-print-production.html` | `services.packaging-print-production` |
| Large Format & Retail Print | Printing | `services/large-format-retail-print.html` | `services.large-format-retail-print` |

Each service page currently contains:

| Content Type | Current Location | Should Be Editable? | Suggested Data Key |
|---|---|---|---|
| SEO title/meta | head | Yes | `services.{slug}.seo` |
| Department label | `.service-page-hero .eyebrow` | Yes | `services.{slug}.category_id` |
| Hero title | `.service-page-title` | Yes | `services.{slug}.title` |
| Hero summary | `.service-page-sub` | Yes | `services.{slug}.summary` |
| Detail title/tag | `.service-section-title`, `.service-section-tag` | Yes | `services.{slug}.display_order`, `title` |
| Problem/Solution/Deliverables/etc. | `.service-detail-item` blocks | Yes | `services.{slug}.detail_blocks[]` |
| Timeline | `.service-timeline` | Yes | `services.{slug}.timeline` |
| Related services | `.related-service-card` | Yes, derived preferred | `services.{slug}.related_service_ids` |
| CTA | `.final-cta` | Yes | `global_ctas.service_detail` |

### Work / Portfolio Pages

Work categories:

| Category | Count | Current Page | Suggested Data Key |
|---|---:|---|---|
| Shopify Stores | 4 | `work/shopify-stores.html` | `work_categories.shopify-stores` |
| Brand Identity | 3 | `work/brand-identity.html` | `work_categories.brand-identity` |
| Packaging Design | 3 | `work/packaging-design.html` | `work_categories.packaging-design` |
| Amazon Storefronts | 3 | `work/amazon-storefronts.html` | `work_categories.amazon-storefronts` |
| Websites | 3 | `work/websites.html` | `work_categories.websites` |
| Marketing & Print | 3 | `work/marketing-print.html` | `work_categories.marketing-print` |

Project detail records:

| Project | Current File | Suggested Data Key |
|---|---|---|
| Noor Perfumery Shopify Store | `work/shopify-stores/noor-perfumery.html` | `projects.noor-perfumery-shopify-store` |
| Vella Cosmetics Shopify Store | `work/shopify-stores/vella-cosmetics.html` | `projects.vella-cosmetics-shopify-store` |
| Atelier Marbre Shopify Store | `work/shopify-stores/atelier-marbre.html` | `projects.atelier-marbre-shopify-store` |
| Terra & Grove Shopify Store | `work/shopify-stores/terra-grove.html` | `projects.terra-grove-shopify-store` |
| Noor Perfumery Brand Identity | `work/brand-identity/noor-perfumery.html` | `projects.noor-perfumery-brand-identity` |
| Vella Cosmetics Brand Identity | `work/brand-identity/vella-cosmetics.html` | `projects.vella-cosmetics-brand-identity` |
| Hasat Organics Brand Identity | `work/brand-identity/hasat-organics.html` | `projects.hasat-organics-brand-identity` |
| Atelier Marbre Packaging | `work/packaging-design/atelier-marbre.html` | `projects.atelier-marbre-packaging` |
| Noor No.03 Packaging | `work/packaging-design/noor-no03.html` | `projects.noor-no03-packaging` |
| Terra & Grove Packaging | `work/packaging-design/terra-grove.html` | `projects.terra-grove-packaging` |
| Noor Perfumery Amazon Storefront | `work/amazon-storefronts/noor-perfumery.html` | `projects.noor-perfumery-amazon-storefront` |
| Maison Luxe Amazon Storefront | `work/amazon-storefronts/maison-luxe.html` | `projects.maison-luxe-amazon-storefront` |
| Hasat Organics Amazon Storefront | `work/amazon-storefronts/hasat-organics.html` | `projects.hasat-organics-amazon-storefront` |
| Atelier Marbre Website | `work/websites/atelier-marbre.html` | `projects.atelier-marbre-website` |
| Dune Studio Website | `work/websites/dune-studio.html` | `projects.dune-studio-website` |
| Hasat Organics Website | `work/websites/hasat-organics.html` | `projects.hasat-organics-website` |
| Noor Holiday Collection | `work/marketing-print/noor-holiday.html` | `projects.noor-holiday-campaign` |
| Terra & Grove Harvest Print | `work/marketing-print/terra-grove.html` | `projects.terra-grove-harvest-print` |
| Vella Cosmetics Campaign | `work/marketing-print/vella-campaign.html` | `projects.vella-cosmetics-campaign` |

Each project page currently contains:

| Content Type | Current Location | Should Be Editable? | Suggested Data Key |
|---|---|---|---|
| SEO title/meta | head | Yes | `projects.{slug}.seo` |
| Hero title/category/summary | `.page-hero` | Yes | `projects.{slug}.hero` |
| Narrative blocks | `.project-narrative-block` | Yes | `projects.{slug}.narrative[]` |
| Visual system/gallery | `.project-gallery-grid` | Yes, template-constrained | `projects.{slug}.gallery_items[]` |
| Metrics | `.project-metrics` | Yes | `projects.{slug}.metrics[]` |
| Related projects | `.project-related-grid` | Yes, derived preferred | `projects.{slug}.related_project_ids` |
| CTA | `.cta-band` | Yes | `global_ctas.project_detail` |

### Pricing Content

Current pricing data has 8 categories and 24 cards.

| Category | Cards | Suggested Data Key |
|---|---|---|
| Brand Identity Packages | Essential, Premium, Enterprise | `pricing_categories.branding-packages` |
| E-Commerce Website Packages | Essentials Store, Growth Store, Enterprise Store | `pricing_categories.shopify-development-packages` |
| Growth Systems Packages | Foundation, Full Stack, Growth Retainer | `pricing_categories.growth-retention-packages` |
| SEO Packages | Technical SEO, SEO Growth, Enterprise SEO | `pricing_categories.seo-packages` |
| Website Maintenance Packages | Essential, Standard, Growth | `pricing_categories.website-maintenance-packages` |
| Amazon Seller Central Packages | Launch Setup, Managed Growth, Listings & Ads | `pricing_categories.amazon-seller-central-packages` |
| Web Development Packages | Company Site, Portfolio Platform, Custom Store | `pricing_categories.web-development-packages` |
| Printing Packages | Business Print, Packaging Print, Retail Format | `pricing_categories.printing-packages` |

Editable fields per pricing card:

- Tier name.
- Price label.
- Note/description.
- Feature list.
- Featured state.
- CTA label/link.
- Order.
- Visibility.

### FAQ Content

Current FAQ page has 5 categories and 23 items.

| Category | Item Count | Suggested Data Key |
|---|---:|---|
| General | 4 | `faq_categories.general` |
| Departments | 5 | `faq_categories.departments` |
| Shopify Development | 5 | `faq_categories.shopify-development` |
| Pricing & Process | 4 | `faq_categories.pricing-process` |
| Support & Maintenance | 5 | `faq_categories.support-maintenance` |

Each FAQ item should support:

- Question.
- Answer rich text.
- Category.
- Order.
- Visibility.
- Optional related service/page.

## 3. Animation Safety Audit

### Must Not Break

These are visually defining parts of the GROWVA site and must be protected during Admin Mode work:

1. **GSAP ScrollTrigger pinned sections**
   - Homepage stack-deck hero.
   - Bento intro galleries.
   - Shopify chapter navigation.
   - Process line animation.

2. **GSAP Flip bento galleries**
   - `.gallery--bento` and `.gallery--final.gallery--bento`.
   - `.bento-gallery--grid` legacy path.
   - Dynamic content must preserve item count/layout expectations or use a validated template.

3. **Lenis smooth scrolling**
   - Requires recalculation after dynamic content changes.
   - Admin panel scroll should not fight body Lenis scroll.

4. **Page transitions**
   - Link interception is global.
   - Admin buttons, modal controls, save/publish actions, and file upload controls must not trigger page-transition navigation.

5. **Custom cursor / magnetic buttons**
   - Admin UI should either opt out or intentionally support it.
   - Avoid putting `[data-hover]` on admin controls unless desired.

6. **Mega menu / mobile menu**
   - Dynamic navigation must preserve the exact class/data structure expected by `initMegaNavigation()`.

7. **Three.js canvases**
   - `#heroCanvas`, `#ctaCanvas`, `#pageHeroCanvas`, and `[data-brand-object]`.
   - Admin content edits must not remove or duplicate these canvas IDs.

8. **Tilt-card system**
   - New project/pricing cards should opt into existing selectors or use `has-tilt`.
   - Re-rendered cards need tilt initialization.

9. **Reduced motion**
   - The current site has reduced-motion handling.
   - Admin Mode must preserve reduced-motion behavior and should disable heavy preview animations when editing.

### Dynamic Content Risks

| Risk | Why It Matters | Mitigation |
|---|---|---|
| DOM renders after animation init | ScrollTrigger/Flip measure the wrong layout. | Render dynamic content before calling public animation initializers. |
| Admin edits change section height | Pinned ScrollTriggers and Lenis offsets become wrong. | Run `window._lenis?.resize()` and `ScrollTrigger.refresh()` after edits. |
| Reordering animated children | GSAP timelines assume specific nth-child or fixed arrays. | Lock high-risk animated templates or validate item counts. |
| Removing IDs/classes | JS selectors fail silently or break console. | Define protected system fields and template schemas. |
| Inline rich text injects unsafe HTML | Security and layout risk. | Sanitize rich text and limit allowed tags. |
| Uploaded images too large | Performance and cinematic smoothness suffer. | Storage transforms, size validation, responsive image URLs. |
| Editing global nav in one page only | Header is duplicated today. | Move nav/footer to data-rendered shared shell. |
| Preview mode conflicts with page transitions | Unsaved edits could be lost on navigation. | Add unsaved-change guard and admin-safe navigation layer. |

## 4. Architecture Options

### Option A: Static Website + Local JSON Editor Only

Pros:

- Lowest technical complexity.
- Can work without backend.
- Easy first migration step for extracting hardcoded content.
- Works on GitHub Pages.

Cons:

- No real login.
- No real permanent saving from the browser unless using downloads/local storage.
- No real media uploads.
- Owner still needs manual deployment or file replacement.
- Not client-sellable as a true CMS.

Difficulty: Low  
Production suitability: Low  
Works on GitHub Pages: Yes  
Real login: No  
Real saving: No, unless browser-local only  
Image uploads: No  
Suitable for selling to clients: No, except as a prototype

### Option B: Static Website + GitHub API Saving

Pros:

- Keeps static hosting.
- Changes can commit directly to repository.
- Version history comes for free.
- Works with GitHub Pages.

Cons:

- GitHub OAuth/token handling is awkward for non-technical owners.
- Exposes a developer-flavored workflow.
- Media upload through Git commits is slow and brittle.
- Publishing is tied to GitHub Pages deployment delay.
- Hard to create a polished mini-Webflow feeling.

Difficulty: Medium  
Production suitability: Medium  
Works on GitHub Pages: Yes  
Real login: Yes, via GitHub OAuth/token  
Real saving: Yes  
Image uploads: Yes, but clunky  
Suitable for selling to clients: Limited

### Option C: Static Website + Supabase Auth + Supabase Database + Supabase Storage

Pros:

- Real login and role-based access.
- Real database saving.
- Real image/file uploads.
- Works with the existing static site and GitHub Pages.
- Supports preview/publish content states.
- Row Level Security protects edits.
- Good fit for a custom inline editor without building a separate CMS.
- Client-sellable and scalable across multiple projects.

Cons:

- Requires careful data modeling.
- Requires runtime data rendering refactor.
- Requires auth/security setup.
- The static site becomes dependent on Supabase availability for live content unless fallback JSON is used.

Difficulty: Medium-high  
Production suitability: High  
Works on GitHub Pages: Yes  
Real login: Yes  
Real saving: Yes  
Image uploads: Yes  
Suitable for selling to clients: Yes

### Option D: Firebase Auth + Firestore + Storage

Pros:

- Real auth, database, and storage.
- Mature SDKs.
- Works on static hosting.
- Good realtime behavior.

Cons:

- Firestore document modeling is less relational for pages/sections/services/projects.
- Querying ordered relational content can become messy.
- Security rules can become harder to reason about than Supabase RLS.
- Less natural for preview/publish relational workflows.

Difficulty: Medium-high  
Production suitability: High  
Works on GitHub Pages: Yes  
Real login: Yes  
Real saving: Yes  
Image uploads: Yes  
Suitable for selling to clients: Yes

### Option E: Headless CMS Like Sanity / Strapi

Pros:

- Mature content editing interface.
- Good schema systems.
- Sanity has excellent structured content and image tooling.
- Strapi is powerful when self-hosted.

Cons:

- User explicitly wants a mini-Shopify/mini-Webflow editor inside this website.
- A separate CMS studio/dashboard feels like a second product.
- Inline editing and section-level previews require custom work anyway.
- Strapi needs hosting and maintenance.
- Sanity can be client-sellable but less "built into the site."

Difficulty: Medium  
Production suitability: High  
Works on GitHub Pages: Yes for frontend, CMS hosted elsewhere  
Real login: Yes  
Real saving: Yes  
Image uploads: Yes  
Suitable for selling to clients: Yes, but not the desired integrated experience

### Option F: Full Custom Dashboard

Pros:

- Maximum control.
- Can be designed exactly like a premium GROWVA admin system.
- Can support every workflow eventually.

Cons:

- Highest cost and longest timeline.
- Duplicates work Supabase/Auth/Storage already solve.
- Easy to overbuild before content extraction is stable.
- Requires backend hosting if not using a backend platform.

Difficulty: High  
Production suitability: High if funded properly  
Works on GitHub Pages: Frontend only; backend must be hosted elsewhere  
Real login: Yes, if built  
Real saving: Yes, if built  
Image uploads: Yes, if built  
Suitable for selling to clients: Yes, but too expensive for first version

### Recommended Path

Choose **Option C: Static website + Supabase Auth + Supabase Database + Supabase Storage**.

Reason:

It gives the project a real CMS foundation while preserving the current premium static frontend. It supports the user's preferred "mini-Shopify / mini-Webflow editor" direction without forcing the owner into code, GitHub, or a generic third-party CMS studio.

Recommended implementation style:

- Keep one public website.
- Add an Admin button to the existing nav.
- Load Admin Mode only after authentication.
- Render public content from structured data.
- Keep templates and animations local to the website.
- Store drafts/published versions in Supabase.
- Store uploaded media in Supabase Storage.
- Use Row Level Security for roles.
- Keep a checked-in `content/default-site.json` fallback so the site can still render if Supabase is unavailable during early phases.

## 5. Recommended Data Model

Use relational tables for core content, with JSON fields for flexible section settings. This gives structure where the editor needs it, and flexibility where visual templates vary.

### Core Tables

```sql
site_settings
  id uuid primary key
  brand_name text
  logo_media_id uuid
  primary_color text
  secondary_color text
  accent_color text
  default_theme text
  contact_email text
  whatsapp_url text
  social_links jsonb
  updated_at timestamptz

navigation_groups
  id uuid primary key
  key text unique
  label text
  order_index int
  is_visible boolean

navigation_items
  id uuid primary key
  group_id uuid references navigation_groups(id)
  parent_id uuid references navigation_items(id)
  label text
  href text
  description text
  icon_key text
  order_index int
  is_visible boolean
  settings jsonb

pages
  id uuid primary key
  slug text unique
  title text
  template text
  path text
  status text
  seo jsonb
  is_visible boolean
  updated_at timestamptz

sections
  id uuid primary key
  page_id uuid references pages(id)
  type text
  key text
  title text
  subtitle text
  body jsonb
  items jsonb
  settings jsonb
  animation_type text
  order_index int
  is_visible boolean
  status text
  updated_at timestamptz
```

### Services

```sql
service_categories
  id uuid primary key
  slug text unique
  title text
  short_title text
  description text
  icon_key text
  order_index int
  is_visible boolean

services
  id uuid primary key
  category_id uuid references service_categories(id)
  slug text unique
  title text
  short_title text
  summary text
  hero_body text
  icon_key text
  detail_blocks jsonb
  deliverables jsonb
  process_steps jsonb
  ideal_client text
  expected_outcome text
  timeline text
  related_service_ids uuid[]
  seo jsonb
  order_index int
  is_visible boolean
  status text
```

Example service record:

```json
{
  "slug": "premium-shopify-website-development",
  "category_slug": "shopify",
  "title": "Premium Shopify Website Development",
  "summary": "Custom storefronts planned around how your customer buys.",
  "detail_blocks": [
    {
      "label": "The Problem",
      "type": "paragraph",
      "content": "Generic templates constrain your brand identity..."
    },
    {
      "label": "Deliverables",
      "type": "list",
      "items": ["Custom Liquid theme", "Responsive across all devices"]
    }
  ],
  "timeline": "6-10 weeks from kickoff to launch",
  "is_visible": true,
  "order_index": 1
}
```

### Work Projects

```sql
work_categories
  id uuid primary key
  slug text unique
  title text
  description text
  icon_key text
  visual_type text
  order_index int
  is_visible boolean

projects
  id uuid primary key
  category_id uuid references work_categories(id)
  slug text unique
  title text
  client_name text
  industry text
  summary text
  challenge text
  strategy text
  result text
  metrics jsonb
  gallery_items jsonb
  card_visual jsonb
  related_project_ids uuid[]
  seo jsonb
  order_index int
  is_featured boolean
  is_visible boolean
  status text
```

Example project:

```json
{
  "slug": "noor-perfumery-shopify-store",
  "category_slug": "shopify-stores",
  "title": "Noor Perfumery",
  "industry": "Luxury Fragrance",
  "summary": "A sensory Shopify experience for a luxury fragrance house.",
  "narrative": [
    { "label": "Challenge", "content": "The previous store looked generic..." },
    { "label": "Strategy", "content": "We restructured the store around scent storytelling..." },
    { "label": "Result", "content": "Conversion climbed from 0.9% to 2.4%..." }
  ],
  "metrics": [
    { "value": "2.4%", "label": "Conversion Rate" },
    { "value": "2x", "label": "Average Order Value" }
  ],
  "is_featured": true,
  "is_visible": true
}
```

### Pricing

```sql
pricing_categories
  id uuid primary key
  slug text unique
  title text
  subtitle text
  order_index int
  is_visible boolean

pricing_plans
  id uuid primary key
  category_id uuid references pricing_categories(id)
  slug text unique
  tier text
  price_label text
  note text
  features jsonb
  cta_label text
  cta_href text
  is_featured boolean
  order_index int
  is_visible boolean
```

### FAQ

```sql
faq_categories
  id uuid primary key
  slug text unique
  title text
  order_index int
  is_visible boolean

faq_items
  id uuid primary key
  category_id uuid references faq_categories(id)
  question text
  answer jsonb
  order_index int
  is_visible boolean
```

### Media

```sql
media_assets
  id uuid primary key
  bucket text
  path text
  url text
  alt text
  caption text
  mime_type text
  width int
  height int
  size_bytes int
  uploaded_by uuid
  created_at timestamptz
```

### Users And Roles

```sql
profiles
  id uuid primary key references auth.users(id)
  email text
  full_name text
  role text -- owner, editor, viewer
  is_active boolean
  created_at timestamptz
```

### Publishing

```sql
content_revisions
  id uuid primary key
  entity_type text
  entity_id uuid
  draft_data jsonb
  published_data jsonb
  status text -- draft, published, archived
  created_by uuid
  updated_by uuid
  published_by uuid
  created_at timestamptz
  updated_at timestamptz
  published_at timestamptz
```

## 6. Admin UX Plan

### Entry Point

- Add a small `Admin` or `Edit` button in the existing top navigation.
- It can be visible only on hover/keyboard focus or visible as a minimal mono-style link.
- On public visitors, it opens a login modal.
- On authenticated users, it toggles Admin Mode.

### Login Modal

Design:

- Dark glass panel.
- GROWVA wordmark.
- Email/password fields.
- Optional magic-link login later.
- No generic dashboard chrome.
- Uses the same mint accent, mono labels, and crisp border styling.

Behavior:

- Supabase Auth login.
- On success, close modal and load admin shell.
- On failure, show inline error.
- Remember session.

### Admin Top Bar

After login:

- Fixed slim top bar above or below the nav.
- Shows current mode: `Editing Draft`, `Preview`, or `Published`.
- Actions: `Edit`, `Preview`, `Save Draft`, `Publish`, `Exit`.
- Status: saved/unsaved/saving/error.
- Role badge: Owner/Editor/Viewer.

### Modes

| Mode | Purpose |
|---|---|
| View | Normal public site. |
| Edit | Inline edit handles appear on editable sections. Links do not navigate accidentally. |
| Preview | Shows draft content without edit handles. Animations run as public. |
| Publish | Commits draft to published records. Owner/editor permission required. |

### Inline Editing

Each editable section gets a subtle edit affordance:

- Section outline only on hover in Admin Mode.
- Small floating `Edit` button in mono style.
- For repeated items, item-level edit buttons appear on cards/list rows.

Do not add permanent heavy admin boxes into the visual composition.

### Right-Side Editing Panel

Panel behavior:

- Slides in from right.
- Uses dark premium UI.
- Contains fields for selected section/item.
- Supports text, rich text, link pickers, toggles, order fields, media pickers.
- Has Save Draft and Cancel.

Field types:

- Short text.
- Long text/rich text.
- Button label + href.
- Link picker.
- Icon selector.
- Media upload/replace.
- Visibility toggle.
- Featured toggle.
- Order number / drag reorder.
- SEO title/meta fields.

### Media Upload Panel

Features:

- Drag/drop upload.
- Replace existing media.
- Alt text required.
- File size validation.
- Preview thumbnail.
- Supabase Storage path by entity type, e.g. `projects/noor-perfumery/hero.webp`.

### Section Library

Section templates should be predefined, not freeform:

- Hero.
- Editorial text block.
- Bento intro.
- Service directory.
- Service detail.
- Work category grid.
- Project grid.
- Pricing grid.
- FAQ accordion.
- Stats row.
- Testimonial grid.
- CTA band.
- Contact form.

For high-animation sections, the admin should show constraints:

- Bento intro: exactly 8 tiles initially.
- Homepage stack deck: exactly 4 cards initially.
- Shopify chapters: start with fixed chapter template until the animation is generalized.

### Reorder Flow

- Use drag handles in a section list panel.
- Reorder sections by `order_index`.
- Save as draft.
- Re-render page.
- Refresh Lenis and ScrollTrigger.

### Delete Flow

- Soft-delete or set `is_visible=false` first.
- Confirm destructive removal.
- Owners can permanently delete; editors can hide.
- Never allow deleting protected global shell elements from inline mode.

### Unsaved Changes

- Track dirty state.
- Warn before navigation.
- Page-transition navigation must respect admin dirty state.
- Autosave drafts every 20-30 seconds after Phase 5.

### Mobile Admin Behavior

- Public mobile site remains unchanged.
- Admin Mode on mobile should be limited:
  - Preview and quick text edits only.
  - Heavy section builder/reorder workflows should recommend desktop.
- Right panel becomes full-screen drawer on mobile.

## 7. Security & Roles

### Roles

| Role | Permissions |
|---|---|
| Owner | Full access: users, settings, publish, delete, media, SEO, navigation, sections. |
| Editor | Edit content, save drafts, upload media, request publish or publish if allowed. No user/security settings. |
| Viewer | Preview drafts and published content. No editing. Optional. |

### Protected Actions

| Action | Owner | Editor | Viewer |
|---|---:|---:|---:|
| Edit text/content | Yes | Yes | No |
| Save drafts | Yes | Yes | No |
| Publish | Yes | Optional | No |
| Upload media | Yes | Yes | No |
| Delete media | Yes | Optional | No |
| Hide sections | Yes | Yes | No |
| Permanently delete sections | Yes | No | No |
| Edit navigation | Yes | Optional | No |
| Edit global settings/colors | Yes | No | No |
| Manage users | Yes | No | No |

### Security Recommendations

- Use Supabase Auth.
- Store user roles in `profiles`.
- Enforce Row Level Security on every admin table.
- Public visitors can read only published content.
- Authenticated editors can read drafts.
- Editors can write drafts, not publish unless explicitly allowed.
- Only owners can change site settings and users.
- Validate uploaded media type and size.
- Sanitize rich text.
- Never store Supabase service-role keys in the browser.
- Use Edge Functions only for privileged operations if needed.

## 8. Implementation Phases

### Phase 1: Content/Data Extraction

Files likely affected:

- New `content/default-site.json`.
- New `content/schema-notes.md`.
- No public rendering changes yet.

Build:

- Extract nav, footer, pages, sections, services, projects, pricing, FAQ into JSON.
- Preserve current text and links.
- Define stable slugs and IDs.

Test:

- JSON validates.
- Counts match current site: 54 pages, 20 services, 6 work categories, 19 projects, 24 pricing cards, 23 FAQ items.

Risks:

- Missing content during extraction.
- Encoding artifacts in existing HTML.

Rollback:

- Delete JSON files; website remains unchanged.

### Phase 2: Dynamic Rendering From Local Data

Files likely affected:

- `js/content-loader.js`
- `js/renderers/*.js`
- `content/default-site.json`
- One pilot page first, probably `faq.html` or `services.html`.

Build:

- Load JSON.
- Render one low-risk page section dynamically.
- Add render lifecycle: `render -> init interactions -> refresh scroll`.

Test:

- Visual parity.
- No console errors.
- FAQ/service tabs still work.
- Reduced motion works.

Risks:

- Rendering after animation init.

Rollback:

- Revert pilot page to hardcoded markup.

### Phase 3: Shared Shell Rendering

Files likely affected:

- `partials` or JS shell renderer.
- All HTML pages eventually.
- `js/script.js`.

Build:

- Render header/footer from data.
- Replace duplicated nav/footer in a pilot page.
- Keep relative links correct by using absolute root-aware paths.

Test:

- Desktop mega menu.
- Mobile menu.
- Active nav.
- Page transitions.
- All link paths at root, `services/`, `work/`, nested `work/*/`.

Risks:

- Broken relative paths.
- Admin button accidentally appears incorrectly.

Rollback:

- Restore hardcoded shell on pilot page.

### Phase 4: Supabase Setup

Files likely affected:

- New `js/supabase-client.js`.
- New `.env.example` if a build step is introduced later.
- Supabase SQL migration files.

Build:

- Create Supabase project.
- Add Auth.
- Add tables and RLS.
- Add Storage bucket.
- Read published content from Supabase with fallback JSON.

Test:

- Public read works.
- Draft records are not public.
- Storage URLs load.

Risks:

- Misconfigured public keys/RLS.

Rollback:

- Use local JSON fallback.

### Phase 5: Admin Login + Admin Shell

Files likely affected:

- `js/admin/auth.js`
- `js/admin/admin-shell.js`
- `css/admin.css`
- Header renderer/nav data.

Build:

- Admin nav button.
- Login modal.
- Session handling.
- Admin top bar.
- Role display.

Test:

- Login/logout.
- Public visitors cannot edit.
- Admin UI does not trigger page transitions.
- Mobile nav still works.

Risks:

- Admin CSS leaking into public UI.

Rollback:

- Remove admin script/style includes.

### Phase 6: Inline Text Editing

Files likely affected:

- `js/admin/inline-editor.js`
- `js/admin/field-panel.js`
- section renderers.

Build:

- Add edit handles.
- Right-side panel.
- Save draft for text/button/link fields.
- Preview draft.

Test:

- Edit hero headline.
- Edit CTA button.
- Save draft.
- Refresh and reload draft as admin.
- Public still sees published content.

Risks:

- Layout break from long text.
- Word reveal spans interfering with editing.

Rollback:

- Disable admin editor module.

### Phase 7: Structured Collections Editing

Files likely affected:

- `js/admin/collections/services.js`
- `js/admin/collections/projects.js`
- `js/admin/collections/pricing.js`
- `js/admin/collections/faq.js`
- renderers for services/projects/pricing/FAQ.

Build:

- CRUD for services.
- CRUD for projects.
- CRUD for pricing plans.
- CRUD for FAQ items.
- Reordering.
- Visibility toggles.

Test:

- Add service.
- Hide service.
- Reorder pricing card.
- Add FAQ item.
- Work category/project pages still render.

Risks:

- New service/project pages need routing strategy.

Rollback:

- Keep collections read-only until templates are stable.

### Phase 8: Media Upload

Files likely affected:

- `js/admin/media-library.js`
- Supabase Storage policies.
- project/service renderers.

Build:

- Upload media.
- Replace media.
- Alt text.
- Media library picker.

Test:

- Upload image.
- Replace project visual.
- Validate size/type.
- Confirm responsive performance.

Risks:

- Oversized assets hurting performance.

Rollback:

- Disable uploads; use existing CSS-generated visuals.

### Phase 9: Section Builder

Files likely affected:

- `js/admin/section-library.js`
- `js/renderers/sections/*.js`
- `css/admin.css`.

Build:

- Add predefined sections.
- Hide/show sections.
- Reorder sections.
- Delete confirmation.

Test:

- Add simple CTA section.
- Reorder editorial section.
- Hide stats.
- ScrollTrigger refreshes.

Risks:

- Animated templates break if unconstrained.

Rollback:

- Limit section builder to non-animated templates until stable.

### Phase 10: Preview/Publish Workflow, Polish, QA

Files likely affected:

- Admin modules.
- Supabase functions/policies.
- Renderer cache logic.

Build:

- Draft/published states.
- Publish confirmation.
- Revision history.
- Unsaved changes guard.
- Premium admin polish.
- Mobile admin fallback.

Test:

- Full site regression.
- All 54 pages.
- Console errors.
- Performance.
- Reduced motion.
- Mobile.
- Role permissions.

Risks:

- Publishing broken content globally.

Rollback:

- Revision restore from previous published snapshot.

## 9. Important Constraints

The future admin system must preserve:

- Premium luxury design.
- Dark/ivory/mint GROWVA identity.
- Editorial typography.
- Cinematic transitions.
- Smooth scroll.
- Mega menu behavior.
- Mobile responsiveness.
- High performance.
- Reduced-motion support.

Do not use:

- Generic Bootstrap-style admin panels.
- Heavy dashboard layouts inside the public experience.
- Unbounded freeform section editing that breaks animations.
- Client-visible developer tooling.
- Browser-only local storage as the final saving mechanism.

## 10. Future Folder Structure

Recommended future structure:

```text
/
  index.html
  shopify.html
  services.html
  process.html
  about.html
  pricing.html
  faq.html
  contact.html
  work.html

  services/
    [legacy-static-service-pages during migration]

  work/
    [legacy-static-work-pages during migration]

  css/
    style.css
    admin.css

  js/
    script.js
    runtime/
      boot.js
      content-loader.js
      render-page.js
      render-shell.js
      animation-lifecycle.js
      path-utils.js
    renderers/
      hero.js
      bento-gallery.js
      services.js
      service-detail.js
      work-directory.js
      project-detail.js
      pricing.js
      faq.js
      cta.js
      stats.js
      testimonials.js
    admin/
      auth.js
      admin-shell.js
      edit-mode.js
      field-panel.js
      inline-editor.js
      media-library.js
      section-library.js
      publish-workflow.js
      permissions.js
    supabase/
      client.js
      queries.js
      mutations.js

  content/
    default-site.json
    schemas/
      site-settings.schema.json
      pages.schema.json
      sections.schema.json
      services.schema.json
      projects.schema.json
      pricing.schema.json
      faq.schema.json

  supabase/
    migrations/
      001_initial_schema.sql
      002_rls_policies.sql
    seed/
      initial-content.sql

  docs/
    ADMIN_SYSTEM_ARCHITECTURE_REPORT.md
    CONTENT_MODEL.md
    QA_CHECKLIST.md
```

During migration, keep the existing HTML pages working. Do not delete static pages until their dynamic equivalents are verified.

## 11. Warning List: Things That Can Break

1. Header/footer duplication can cause inconsistent nav if only some pages are updated.
2. Relative links can break in `services/` and nested `work/*/` pages.
3. ScrollTrigger pinning can measure the wrong layout if content renders late.
4. Bento galleries can lose the dramatic Flip effect if grid classes or item counts change.
5. Homepage stack-deck animation assumes a fixed card structure.
6. Shopify chapter navigation assumes fixed `data-chapter` sections.
7. Page transitions can intercept admin controls unless admin actions opt out.
8. Custom cursor/magnetic effects can make admin controls feel strange if inherited.
9. Rich text can break layout if unlimited tags/styles are allowed.
10. Large uploads can damage performance and smoothness.
11. Publishing draft content without validation can break public pages.
12. Supabase RLS mistakes can expose drafts or allow unauthorized edits.
13. Removing canvas IDs can break Three.js visuals.
14. Re-rendering content without reinitializing interactions can break FAQ, tabs, tilt, counters, reveals.
15. Editing SEO/path slugs without redirects can break links.

## 12. Checklist Before Coding Starts

- [ ] Confirm Supabase is the chosen backend.
- [ ] Decide whether GitHub Pages remains the host for the first production admin version.
- [ ] Freeze current public site as the visual baseline.
- [ ] Create a content inventory JSON from current HTML.
- [ ] Define stable slugs for pages, services, categories, projects, pricing, FAQ.
- [ ] Decide which sections are protected from delete/reorder in v1.
- [ ] Decide owner/editor publishing permissions.
- [ ] Decide media size limits and accepted file types.
- [ ] Define admin UI visual rules so it feels GROWVA, not generic.
- [ ] Add a regression checklist for all 54 pages.
- [ ] Plan a pilot page, preferably `faq.html` or `services.html`, before touching animated pages.
- [ ] Add a renderer lifecycle contract: render content first, then initialize/refresh animations.

## 13. Exact First Implementation Prompt To Run Next

```text
You are working inside the GROWVA website project.

Start Phase 1 only: Content/data extraction.

Do not change public rendering, CSS behavior, JS animation behavior, nav behavior, or page markup output.

Create a new `content/` folder with `default-site.json` and extract the current hardcoded content into structured JSON:
- site settings
- navigation and mega menu
- footer
- pages and SEO metadata
- page sections for the 9 root pages
- all 20 services
- all 6 work categories
- all 19 work projects
- pricing categories and all 24 pricing cards
- FAQ categories and all 23 FAQ items
- contact settings and form options
- global CTAs and stats

Preserve existing text, links, slugs, ordering, and visibility exactly.

Add a validation script or Node check that confirms:
- 20 services
- 6 work categories
- 19 work projects
- 24 pricing cards
- 23 FAQ items
- every root page has an SEO record
- every nav/footer link resolves locally or is mailto/http

Do not wire this JSON into the site yet.
Do not add Supabase yet.
Do not modify existing HTML/CSS/JS behavior.

At the end, report the created files and validation results.
```

## Final Recommendation

Build one single GROWVA website with an authenticated Admin/Edit Mode layered into the existing public frontend.

Use:

- Supabase Auth for login.
- Supabase Postgres for structured content.
- Supabase Storage for media.
- Row Level Security for roles.
- Local JSON fallback during migration.
- Data-rendered templates for services, work, pricing, FAQ, nav, footer, and page sections.
- A premium inline editor with a right-side panel, preview/publish workflow, media library, and section library.

Do not begin with the admin UI. Begin by extracting the content model. Once content is structured, the admin interface can be built safely without damaging the current cinematic experience.
