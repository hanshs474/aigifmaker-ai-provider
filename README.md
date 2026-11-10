# aigifmaker-ai-provider

Turn text into animated GIFs with AI GIF Maker. Native GIF generation — no video conversion. Type what you want and download your GIF in about a minute.

This is the [AI GIF Maker](https://aigifmaker.ai/?utm_source=npm-ai-sdk&utm_medium=package) provider for the [Vercel AI SDK](https://ai-sdk.dev): call `generateImage` with a prompt and get back the finished `.gif` file, plus its hosted URL.

```bash
npm install aigifmaker-ai-provider ai
export AIGIFMAKER_API_KEY=sk-...   # create one at https://aigifmaker.ai/settings/apikeys
```

```ts
import { generateImage } from 'ai';
import { aigifmaker } from 'aigifmaker-ai-provider';
import { writeFile } from 'node:fs/promises';

const { image, providerMetadata } = await generateImage({
  model: aigifmaker.image(),        // gif-maker-v1
  prompt: 'a corgi in sunglasses dancing on a beach, looping',
});

await writeFile('corgi.gif', image.uint8Array);
console.log(providerMetadata.aigifmaker.images[0].url); // hosted GIF URL
```

Describe the motion in the prompt ("waving", "spinning", "looping"); the model draws the animation frame by frame as a real GIF, not a clip converted afterwards.

## Settings

```ts
import { createAigifmaker } from 'aigifmaker-ai-provider';

const gif = createAigifmaker({ apiKey: process.env.MY_KEY, timeoutMs: 20 * 60_000 });
```

| Option | Default |
|---|---|
| `apiKey` | `AIGIFMAKER_API_KEY` |
| `timeoutMs` | 15 minutes |
| `pollIntervalMs` | 3 seconds |
| `baseURL`, `fetch` | for tests and proxies |

`size`, `aspectRatio` and `seed` are not used; they come back as warnings.

## Cost

Each GIF costs 1 credit on your AI GIF Maker account, the same as on the website. New accounts get one free GIF (it carries a small aigifmaker.ai badge). Credits are on the [pricing](https://aigifmaker.ai/pricing?utm_source=npm-ai-sdk&utm_medium=package) page. A failed generation refunds its credit.

## Errors

Failures throw the `aigifmaker` SDK errors, re-exported here: `AuthError` (no key or a wrong key), `QuotaError` (out of credits), `RejectedError` (the content filter refused the prompt; reword it), `GenerationFailedError` (the run failed), and `AigifmakerError` with `kind: 'timeout'` when the deadline passes. The AI SDK may wrap them; check `error.cause`.

Plain client without the AI SDK: [`aigifmaker`](https://www.npmjs.com/package/aigifmaker). Questions: support@aigifmaker.ai.

MIT licensed. Source: https://github.com/hanshs474/aigifmaker-ai-provider
