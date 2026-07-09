# Paraggi - STEP 10 - Deployment

## Ambienti

- Local: Supabase CLI + Expo.
- Staging: Supabase hosted + EAS Android preview APK.
- Production: Supabase hosted production + store builds.

## Variabili

Vedi `.env.example`.

Mobile:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Edge Functions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Mappe:

- `MAPBOX_ACCESS_TOKEN`

Build:

- `EXPO_TOKEN`

## Local setup

```bash
npm install
supabase start
supabase db reset
npm run mobile:start
```

## Deploy Supabase

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy update-location
supabase functions deploy get-nearby-feed
supabase functions deploy create-post
supabase functions deploy create-comment
supabase functions deploy request-connection
supabase functions deploy respond-connection
supabase functions deploy send-private-message
supabase functions deploy register-push-token
supabase functions deploy sync-offline-actions
supabase functions deploy report-content
supabase functions deploy block-user
supabase functions deploy export-account-data
supabase functions deploy delete-account
```

## APK Android preview

```bash
npm run mobile:build:apk
```

Richiede:

- account Expo/EAS;
- `EXPO_TOKEN`;
- `apps/mobile/eas.json` aggiornato con project id reale;
- segreti Supabase di staging.

## GitHub Actions

- `.github/workflows/ci.yml`
- `.github/workflows/android-preview-apk.yml`

