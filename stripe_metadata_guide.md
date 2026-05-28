# Parsing Stripe Metadata for Sizes and Prices

This guide describes how Stripe products, pricing variants, and size attributes are parsed and matched within the apparel section (`/shop`) of the platform.

---

## 1. Stripe Product Metadata Schema

Since Stripe does not have a native first-class variant hierarchy (like Shopify's Product-Variant relationship), the platform maps product configurations using Stripe **Metadata** keys and **Stripe Price API objects**.

### Expected Metadata Fields on Stripe Products
- **`handle`**: Unique product slug (e.g. `classic-hoodie-black`).
- **`collection`**: Grouping label (e.g. `apparel`, `staples`, defaults to `'default'`).
- **`size` / `sizes` / `Size` / `Sizes`**: Comma-separated list of available sizes (e.g. `S, M, L, XL`).
- **`sku`**: Stock keeping unit identifier.
- **`digital`**: String boolean (`"true"` / `"false"`) determining shipping requirements.
- **`imageAlt`**: Alt text description for product images.

---

## 2. Server-Side Data Transformation

The backend transforms Stripe products and prices into a Shopify-compatible storefront schema. This logic resides in `src/utils/stripe.js` inside the `transformStripeProduct` function.

### A. Sizing Option Parsing
The parser extracts sizes from metadata, splits the comma-separated string, and constructs the standardized options array:
```javascript
const sizeOption = product.metadata?.size || product.metadata?.sizes || product.metadata?.Size || product.metadata?.Sizes;
const options = [];
if (sizeOption) {
  options.push({
    name: 'Size',
    values: sizeOption.split(',').map(s => s.trim()).filter(Boolean)
  });
}
```

### B. Price and Variant Parsing
1. **Price Variant Extraction**: Each price object associated with a Stripe product ID is treated as a variant:
   - **Variant ID**: The Stripe Price ID (e.g. `price_123456...`). This ID is required to initiate Stripe checkout sessions.
   - **Variant Price**: Computed from `price.unit_amount / 100` to format unit cents as standard decimal values (e.g., `45.00`).
   - **Compare At Price**: Extracted from price-specific metadata (`price.metadata?.compareAtPrice`) when available.
2. **Min/Max Price Ranges**: Mapped to calculate price spreads for list views:
   ```javascript
   priceRange: {
     maxVariantPrice: {
       amount: (Math.max(...variants.map(v => parseFloat(v.priceV2.amount)))).toFixed(2),
       currencyCode: currency.toUpperCase()
     },
     minVariantPrice: {
       amount: (Math.min(...variants.map(v => parseFloat(v.priceV2.amount)))).toFixed(2),
       currencyCode: currency.toUpperCase()
     }
   }
   ```

---

## 3. Frontend Selection & Cart Mapping

The selection state and option matching occur inside `src/components/EditorialFeed.svelte` and syncs with `src/store.js`.

### A. Frontend Selection State
On mount, the component initializes the selected option to the first value (e.g. the first size) for every product:
```javascript
let productSelections = $state((() => {
    const initial = {};
    if (products && Array.isArray(products)) {
        products.forEach(p => {
            if (p.options) {
                initial[p.id] = p.options.reduce((acc, opt) => ({
                    ...acc,
                    [opt.name]: opt.values[0]
                }), {});
            }
        });
    }
    return initial;
})());
```

### B. Size Button rendering
The UI displays sizes as toggleable buttons. Clicking a button updates the selection state:
```html
{#each currentProduct.options as option}
    {#each option.values as value}
        <button 
            onclick={() => selectOption(currentProduct.id, option.name, value)}
            class={productSelections[currentProduct.id]?.[option.name] === value ? 'selected' : ''}
        >
            {value}
        </button>
    {/each}
{/each}
```

### C. Variant Selection Matching & Cart Insertion
When a user clicks "Inquire/Add to Cart", the matching logic retrieves the appropriate Stripe Price ID (`priceId`):

1. **Option Matching Fallback**: Because Stripe prices represent distinct currency values rather than separate sub-variant records, the `variants.edges.node.selectedOptions` array defaults to empty (`[]`).
2. **Matching Strategy**: The frontend iterates through the product's price variants. If a variant's options match the selection, it is used. Otherwise, it falls back to the first available price variant.
3. **Cart Metadata**: The chosen size is attached directly to the cart item's `selectedOptions` object:
   ```javascript
   const selectedOptions = productSelections[prod.id] || {};
   let selectedVariant = prod.variants.edges[0].node; // Fallback to first price

   addToCartStore({
       priceId: selectedVariant.id, // Stripe price ID used for checkout session
       productId: prod.id,
       title: selectedVariant.title || prod.title,
       productTitle: prod.title,
       price: parseFloat(selectedVariant.priceV2?.amount || 0) * 100, // stored in cents
       selectedOptions: { ...selectedOptions } // e.g. { Size: 'M' }
   });
   ```

---

## 4. Porting and Migration to Astro (`localhost:5173`)

When porting this logic to your new codebase:
1. **Reuse Transformer**: Keep the `transformStripeProduct` utility unchanged to ensure the format remains compatible with components.
2. **Metadata Sync**: Ensure that all products created in Stripe have their sizing metadata written as comma-separated lists (`S, M, L`) and handles populated in the Stripe dashboard.
3. **Price IDs**: Ensure that your cart components submit the matched Stripe Price ID (`priceId`) to your checkout session endpoint rather than the main product ID.
