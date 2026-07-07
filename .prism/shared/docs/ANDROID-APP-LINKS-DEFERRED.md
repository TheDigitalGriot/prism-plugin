# Android App Links — deferred (how to add back later)

> **Date:** 2026-07-06 · **Context:** relay pairing landing page (see
> `.prism/shared/handoffs/2026-07-03-relay-pairing-landing-page.md`).
> When the pairing landing page + universal links were built, we scoped it to **Apple only**
> and pulled the Android App Links pieces back out. This note records exactly what was removed
> and how to restore it.

---

## Why it was removed

- We're shipping iOS first. The registered test device runs **Prism / Prism Debug** on iPhone.
- Android App Links (`autoVerify`) need the app's **app-signing SHA-256 fingerprint** in a
  `/.well-known/assetlinks.json`. That value lives in EAS-managed Android credentials and wasn't
  on hand. Shipping `intentFilters` with `autoVerify: true` pointed at an `assetlinks.json` full
  of placeholder fingerprints would make Android link-verification **fail loudly**, so it was
  cleaner to remove it than to ship it broken.

## What still works on Android WITHOUT this

The removal only drops the **automatic** "https link opens the app, no browser hop" verification.
Everything else is cross-platform and still works on Android:

- The daemon offer link `https://prism.digitalgriot.studio/#offer=…` still lands on the pairing
  page (the Cloudflare Worker serves the apex for all platforms).
- The page's **Open in Prism** button still deep-links via the custom scheme `prism://#offer=…`
  (Expo `scheme: "prism"` is cross-platform), and the app's global offer listener
  (`packages/app/src/app/_layout.tsx` → `OfferLinkListener`) imports it.

So Android users pair with **one extra tap** (open link → tap "Open in Prism") instead of the
link opening the app directly. Adding App Links back removes that one tap.

---

## What was removed (3 edit sites)

### 1. `apps/prism-mobile/packages/app/app.config.js` — `android.intentFilters`

Removed from the `android` block (sat just after `usesCleartextTraffic: true`):

```js
      // App Links: taps on https://prism.digitalgriot.studio/… open the app directly. autoVerify
      // checks the host's /.well-known/assetlinks.json against the app-signing cert. Needs a new
      // native build to take effect.
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [{ scheme: "https", host: "prism.digitalgriot.studio" }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
```

> Note: iOS `ios.associatedDomains: ["applinks:prism.digitalgriot.studio"]` was **kept**.

### 2. `apps/prism-mobile/packages/relay/src/pairing-page.ts` — assetlinks data + builder + route

**a.** The Android signing table (sat after `IOS_BUNDLE_IDS`):

```ts
interface AndroidAppSigning {
  packageName: string;
  /** Upper-case, colon-separated SHA-256 of the app-signing cert, e.g. "AB:CD:…". */
  sha256Fingerprint: string;
}

/** Android packages + their app-signing SHA-256 fingerprints. */
export const ANDROID_APP_SIGNING: readonly AndroidAppSigning[] = [
  { packageName: "com.thedigitalgriot.prism", sha256Fingerprint: "REPLACE_WITH_ANDROID_SHA256_PROD" },
  {
    packageName: "com.thedigitalgriot.prism.debug",
    sha256Fingerprint: "REPLACE_WITH_ANDROID_SHA256_DEBUG",
  },
] as const;
```

**b.** The builder (sat after `buildAppleAppSiteAssociation`):

```ts
/** Android asset links for App Links (autoVerify). */
export function buildAndroidAssetLinks(): unknown {
  return ANDROID_APP_SIGNING.map((app) => ({
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: app.packageName,
      sha256_cert_fingerprints: [app.sha256Fingerprint],
    },
  }));
}
```

**c.** The route branch in `handlePairingStaticRoutes` (sat after the AASA branch, before `return null`):

```ts
  if (pathname === "/.well-known/assetlinks.json") {
    return new Response(JSON.stringify(buildAndroidAssetLinks()), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=3600",
      },
    });
  }
```

### 3. `apps/prism-mobile/packages/relay/src/cloudflare-adapter.test.ts` — assetlinks test

```ts
  it("serves the android assetlinks with the handle_all_urls relation", async () => {
    const response = await relayWorker.fetch(
      new Request("https://prism.digitalgriot.studio/.well-known/assetlinks.json"),
      noEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const links = (await response.json()) as Array<{
      relation: string[];
      target: { package_name: string };
    }>;
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]?.relation).toContain("delegate_permission/common.handle_all_urls");
    expect(links.map((l) => l.target.package_name)).toContain("com.thedigitalgriot.prism");
  });
```

---

## How to add it back (checklist)

1. **Get the Android app-signing SHA-256 fingerprint(s):**
   ```bash
   cd apps/prism-mobile/packages/app
   eas credentials -p android      # → Keystore → "SHA-256 Fingerprint"
   ```
   - The **production** build (Play/EAS-signed) and the **development** build (debug keystore)
     usually have **different** fingerprints. Grab the one(s) matching the variant you'll test.
   - If Google Play App Signing is enabled, use the **app-signing key** SHA-256 from
     Play Console → *Setup → App integrity*, not the upload key.
   - Format: upper-case, colon-separated (e.g. `AB:CD:EF:…`). One string per fingerprint.

2. **Restore the three code blocks above** (paste them back verbatim), replacing the
   `REPLACE_WITH_ANDROID_SHA256_*` placeholders with the real fingerprint(s).

3. **Verify locally:**
   ```bash
   cd apps/prism-mobile/packages/relay
   npx vitest run src/cloudflare-adapter.test.ts --bail=1
   npm run typecheck
   ```

4. **Cut a new EAS Android build** — `intentFilters` + `autoVerify` are native manifest entries,
   so `eas update` won't apply them:
   ```bash
   cd apps/prism-mobile/packages/app
   eas build -p android --profile development   # or production
   ```

5. **Deploy the Worker** so `assetlinks.json` is live:
   ```bash
   cd apps/prism-mobile/packages/relay && npx wrangler deploy
   curl -s https://prism.digitalgriot.studio/.well-known/assetlinks.json   # 200 JSON
   ```

6. **Confirm verification on-device:**
   ```bash
   adb shell pm get-app-links com.thedigitalgriot.prism     # look for "verified"
   # or: adb shell pm verify-app-links --re-verify com.thedigitalgriot.prism
   ```

## Reference

- iOS equivalent already live: `buildAppleAppSiteAssociation()` in `pairing-page.ts`
  (Team ID `M6K8N36JN8`, served at `/.well-known/apple-app-site-association`). Android's
  `assetlinks.json` is the direct analogue — same idea, SHA-256 fingerprint instead of Team ID.
- Landing page + relay routing: `apps/prism-mobile/packages/relay/src/pairing-page.ts` +
  `cloudflare-adapter.ts` (`handlePairingStaticRoutes`), route in `wrangler.toml`.
