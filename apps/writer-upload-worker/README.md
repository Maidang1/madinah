# Madinah Writer Upload Worker

Cloudflare Worker upload service for Writer pasted images. Writer talks to this
service through an upload-provider interface and only stores endpoint-level
configuration.

## Deploy

```bash
pnpm --filter writer-upload-worker types
pnpm --filter writer-upload-worker deploy
pnpm --filter writer-upload-worker exec wrangler secret put AUTH_KEY_SECRET
```

`wrangler.jsonc` binds `R2_BUCKET` to `madinah-assets`. Change
`r2_buckets[0].bucket_name` when deploying to another bucket.

## Writer Settings

- Provider: `Cloudflare R2 Worker`
- Endpoint: the Worker URL or custom domain
- API Key: the value stored in `AUTH_KEY_SECRET`
- Public Base URL: the public R2/custom-domain URL used in Markdown
- Prefix: object key prefix, for example `images/writer`
