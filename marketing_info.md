# SpiceCo Platform Migration & Marketing Reference

This document serves as the central reference for marketing, analytics, dynamic configurations, and external feed feeds as we migrate the SpiceCo project to the new codebase running at `http://localhost:5173/`.

---

## 1. RSS Feeds Configuration

The SpiceCo platform uses a decoupled, RSS-driven architecture where content, product lists, and page layouts are pulled dynamically from specific RSS boards hosted on Artformatics.

### Active RSS Feed Feeds

| Route / Section | Base Path (SvelteKit) | RSS Feed URL |
| :--- | :--- | :--- |
| **Spice Shop** | `/shop` & `/3d` | `https://www.artformatics.com/api/boards/spice-shop-dhp8m/rss` |
| **Calendar** | `/community/calendar` | `https://www.artformatics.com/api/boards/kalender-chkso/rss` |
| **Webart** | `/webart/2d` & `/webart/3d` | `https://www.artformatics.com/api/boards/webart-3vpbm/rss` |
| **J-Edit Community**| `/community/j-edit` | `https://www.artformatics.com/api/boards/j-edit-1q6rb/rss` |
| **About Page** | `/about` | `https://www.artformatics.com/api/boards/about-vz47g/rss` |
| **FAQ Page** | `/faq` | `https://www.artformatics.com/api/boards/faq-dt3d9/rss` |
| **One of Ones (Art)**| `/webart/one-of-ones` | `https://www.artformatics.com/api/boards/one-of-ones-me8d8/rss` |

### External iCal (Google Calendar) Feed

Used to fetch live events and project them onto both the Calendar section and the interactive 3D landing page.

- **iCal Link**: `https://calendar.google.com/calendar/ical/b9a4dc690cba97af9a9919f8029b67ffe8c66fcc1c61c8466255ee29be22ef8c%40group.calendar.google.com/public/basic.ics`

---

## 2. Dynamic RSS Styling Custom Namespace

The platform parses custom namespaces from the feed to control styling dynamically (e.g. background textures, custom fonts, typography, UI sizes, colors, and 3D environment parameters). 

**Custom Namespace Tag**: `xmlns:style="https://github.com/raimundkohlprath/sveltekit-authentication2/rss-style"`

### Configurable Styling Variables

| Namespace Tag / Asset / Setting | CSS Variable (Global Root) / Usage | Expected Value Example |
| :--- | :--- | :--- |
| `<style:setting name="card_styles.corners" value="..." />` | `--rss-border-radius` | `"round"` (12px), `"sharp"` (0px) |
| `<style:asset type="card_styles.fontSize" url="..." />` | `--rss-font-size` | `"16px"` |
| `<style:asset type="card_styles.fontFamily" url="..." />`| `--rss-font-family` | `'"CustomFont", sans-serif'` |
| `<style:setting name="card_styles.cardGap" value="..." />`| `--rss-card-gap` | `56` (px) |
| `<style:setting name="card_styles.contentPadding" value="..." />`| `--rss-content-padding` | `24` (px) |
| `<style:setting name="color_config.text" value="..." />`| `--rss-color-text` | `"#121212"` |
| `<style:setting name="color_config.primary" value="..." />`| `--rss-color-primary` | `"#0070f3"` |
| `<style:setting name="color_config.background" value="..." />`| `--rss-color-background` | `"#1c1c1c"` |
| `<style:setting name="color_config.cardBackground" value="..." />`| `--rss-color-card-background`| `"#121212"` |
| `<style:setting name="color_config.titleBackground" value="..." />`| `--rss-color-title-background`| `"#d9fd28"` |
| `<style:setting name="color_config.backgroundGradient" value="..." />`| `--rss-background-gradient`| `"#52748c"` |
| `<style:asset type="card_texture" url="..." />` | `--rss-card-texture` | Image URL |
| `<style:asset type="background_texture" url="..." />` | `--rss-background-image` | Image URL |
| `<style:asset type="color_config.background_texture_mode" url="..." />`| `--rss-background-repeat` | `"repeat"`, `"no-repeat"`, etc. |
| `<style:asset type="custom_font" url="..." />` | Typography file injection | `.ttf` font URL |

### 3D Scene Config Variables (via RSS)

These parameters allow the content board settings to dynamically adjust the Babylon.js 3D rendering:

- `scene_config.mapStyle` (Map styles URL, e.g. OpenFreeMap styles)
- `scene_config.mapScaleX` / `scene_config.mapScaleZ` (Map scaling dimensions)
- `scene_config.linkDistance` / `scene_config.linkStrength` (Node layout force vectors)
- `scene_config.mapZoomScale` (Zoom constraints)
- `scene_config.chargeStrength` / `scene_config.xForceStrength` / `scene_config.yForceStrength`
- `scene_config.collisionRadius` / `scene_config.collisionPadding`
- `scene_config.globeObjectScale` / `scene_config.globeObjectScaleMode`
- `scene_config.visualizationMode` (e.g. `"blocks"`)
- `scene_config.globeSunRotationBPM`
- `scene_config.mapCameraZoomOffset`
- `scene_config.hideMentionedProducts`
- `scene_config.globeLightingBrightness`
- `scene_config.cameraDistanceMultiplier`
- `room_scale` / `room_position_x` / `room_position_y` / `room_position_z`

---

## 3. Database Schema Reference (Supabase)

The newsletter subscription, event registrations, and participant rankings are stored in a Supabase Postgres instance.

### A. Newsletter Subscribers
- **Table**: `newsletter_subscribers`
- **Fields**:
  - `email` (text, unique)

### B. Participant Management (`participants`)
Stores credentials of community members participating in racing events.
```sql
create table participants (
    participant_id uuid primary key default uuid_generate_v4(),
    first_name text not null,
    last_name text not null,
    date_of_birth date,
    gender text,
    email text unique,
    phone text,
    address text,
    city text,
    country text,
    emergency_contact_name text,
    emergency_contact_phone text,
    created_at timestamptz default now(),
    notes text,
    club_team text,
    nationality text,
    profile_photo text
);
```

### C. Races & Events (`races`)
Stores planned and active races on the calendar.
```sql
create table races (
    race_id uuid primary key default uuid_generate_v4(),
    race_name text not null,
    race_date timestamptz,
    location text,
    distance_km numeric,
    race_type text, -- e.g., marathon, cycling, car
    max_participants integer,
    entry_fee numeric,
    prize_pool numeric,
    status text check (status in ('planned', 'active', 'finished')) default 'planned',
    created_at timestamptz default now()
);
```

### D. Race Registrations (`race_registrations`)
Maps participants to specific races.
```sql
create table race_registrations (
    registration_id uuid primary key default uuid_generate_v4(),
    participant_id uuid references participants(participant_id) on delete cascade,
    race_id uuid references races(race_id) on delete cascade,
    registration_date timestamptz default now(),
    bib_number integer,
    payment_status text,
    registration_status text check (registration_status in ('registered', 'cancelled', 'finished', 'DNF')) default 'registered',
    unique(participant_id, race_id)
);
```

### E. Race Results (`race_results`)
```sql
create table race_results (
    result_id uuid primary key default uuid_generate_v4(),
    race_id uuid references races(race_id) on delete cascade,
    participant_id uuid references participants(participant_id) on delete cascade,
    finish_time interval,
    position integer,
    category_position integer,
    average_speed numeric,
    laps_completed integer,
    status text check (status in ('finished', 'DNF', 'DSQ')) default 'finished',
    points numeric,
    time_behind_winner interval,
    personal_best boolean default false,
    season_rank integer,
    total_points numeric,
    penalty_seconds numeric,
    unique(race_id, participant_id)
);
```

---

## 4. Stripe Commerce Integration

Stripe serves as the inventory database and checkout pipeline. Product names mentioned in RSS feed descriptions (under the `Mentioned Products:` format) are dynamically matched with active Stripe product IDs.

- **Stripe Publishable Key**: `pk_live_51SJEcf2Ojm7lSvWJmzxYXRsS0qJCawlvo77k56Q6ewmwksQLohTvexC9rW8Dtc0pY6dPRkPEAR0pllZRoUikXiVq00rf8DXtUI`
- **Supabase Backend**: Configured for storing secondary order records.

---

## 5. Shop Feed & Stripe Integration Mechanics

The platform dynamically bridges Stripe products and RSS content through programmatic title matching:

### A. Stripe Product Extraction & Mapping
1. **API Queries**: The backend queries Stripe products via `stripe.products.list(active: true, expand: ['data.default_price'])` and fetches matching prices via `stripe.prices.list()`.
2. **Schema Alignment**: Stripe products are transformed to align with a Shopify storefront schema for frontend compatibility:
   - **Product Handle**: Extracted from Stripe `metadata.handle` (falls back to Stripe Product ID).
   - **Collections**: Organized by Stripe `metadata.collection` (defaulting to `'default'`).
   - **Product Variants**: Stripe prices are mapped to variants. The currency code and variant price are derived from the Stripe price object (`unit_amount / 100`).
   - **Sizes**: Read from metadata tags (checking `size`, `sizes`, `Size`, or `Sizes`) and parsed as comma-separated values.
   - **Images**: Extracted from the `product.images` array.

### B. RSS Feed Product Parsing
The RSS feed parser (`src/utils/rss.js`) scans post content (`<content:encoded>`) for product mentions using two patterns:
1. **Primary Pattern**: Scans for blocks structured as:
   ```html
   <div><div>PRODUCT_NAME</div><div>By spice-co on...</div>
   ```
2. **Fallback Pattern**: Scans sections following a `Mentioned Products:` marker, parsing names from:
   - `<div>PRODUCT_NAME: Description</div>`
   - `<div>PRODUCT_NAME</div>`

### C. Backend Merging Logic
1. During route rendering (e.g. in `src/routes/+page.server.js` or `src/routes/shop/[[slug]]/+page.server.js`), the backend performs a case-insensitive match between the RSS product mentions array and all active Stripe product names:
   ```javascript
   allProducts.find(p => p.title.toUpperCase() === productTitle.toUpperCase())
   ```
2. **Resulting Aggregations**:
   - **Image Merging**: Images from the matched Stripe product are injected into the RSS post's image gallery with `{ source: 'stripe' }`.
   - **Cart Association**: Links the exact Stripe price ID to the Svelte cart store (`src/store.js`) to initiate Stripe checkout sessions dynamically.

---

## 6. Header Navigation & Context-Aware Routing Logic

The navigation system (`src/components/Header.svelte`) is built on dynamic, state-aware components configured by both user preferences and RSS style configurations.

### A. View Mode Integration (2D vs. 3D Contexts)
Navigation targets dynamically adapt to Svelte's global `viewMode` store:
- **Webart Link**: Directs to `/webart` (3D Backrooms gallery) or `/webart/2d` (traditional layout).
- **Apparel Link**: Directs to `/3d` (procedural Metropolis tower) or `/shop` (traditional commerce grid).
- **Mode Switching Redirects**: Toggle interactions programmatically redirect URLs to maintain matching context:
  - `/` $\leftrightarrow$ `/3d`
  - `/shop` $\leftrightarrow$ `/3d`
  - `/shop/[slug]` $\leftrightarrow$ `/3d/[slug]`
  - `/webart/2d` $\leftrightarrow$ `/webart`

### B. Device & Orientation Awareness
The header responsive layout changes based on screen width and device orientation:
- **Desktop (Lg resolutions)**: Renders as a top-docked horizontal navigation bar with hover-triggered dropdowns.
- **Mobile/Tablets**: 
  - **Orientation-Responsive Layout**: Adapts automatically by reading the Orientation API and window resize/orientationchange handlers.
  - **Portrait Mode**: Positioned as a floating bar at the bottom (`safe-area-bottom`).
  - **Landscape Mode**: Docked to the left (`safe-area-left`) or right (`safe-area-right`) side of the viewport to maximize vertical view space.
  - **Click Translations**: Item interactions invoke physical viewport-aligned translations (tilts) based on orientation (e.g. `translateY` in portrait, `translateX` in landscape).

### C. Style Configuration Mapping
CSS variables representing fonts are dynamically read from SvelteKit's layout loader:
- `--title-font`: Set if `globalRssConfig['title_font']` is configured (defaults to `sans-serif`).
- `--body-font`: Set if `globalRssConfig['custom_font']` is configured (defaults to `monospace`).

---

## 7. Sitemap Generation & Caching Architecture

The platform generates a search-engine-optimized dynamic sitemap XML (`src/routes/sitemap.xml/+server.js`) mapping pages and posts.

### A. XML Assembly Pipeline
1. **Parallel Aggregation**: Retrieves feed entries and inventory using `Promise.all` across:
   - All active Stripe products.
   - The 7 Artformatics RSS boards (Shop, Calendar, Webart, J-Edit, About, FAQ, One of Ones).
2. **Freshness Tracking**: Inspects all `pubDate` records via a helper function to calculate the latest entry update:
   ```javascript
   const getLatestDate = (posts) => { ... Math.max(...dates) ... }
   ```
   This computed date is applied as the main sitemap's root `<lastmod>` tag for maximum indexing efficiency.
3. **Route Construction**:
   - **Static Routes**: Registers routes with pre-assigned metadata, including `/` (priority `1.0`), `/shop` (priority `0.9`), `/community` (priority `0.8`), and `/webart/2d` (priority `0.8`).
   - **Dynamic Routes**: Loops through every individual RSS item from the 7 boards. Generates deep links with formatting:
     ```
     https://spicecoworld.com/[section]/[slugified-post-title]
     ```
   - **Filters**: Excludes entries representing administrative placeholders (such as the `'GOOGLE KALENDER'` marker in the calendar feed).

### B. Caching Framework
- To prevent heavy load times from parallel RSS fetches, sitemaps are cached in-memory (`cachedSitemap`).
- **Cache TTL**: Set to **1 hour (3600 seconds)**. Subsequent request queries will return the pre-compiled XML immediately.


