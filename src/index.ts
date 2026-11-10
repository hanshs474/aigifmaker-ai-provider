import type { ImageModelV4, ImageModelV4CallOptions, ImageModelV4Result } from '@ai-sdk/provider';
import { Client, AigifmakerError, KEYS_URL } from 'aigifmaker';

/**
 * AI GIF Maker provider for the Vercel AI SDK.
 *
 * AI GIF Maker (https://aigifmaker.ai) turns text into animated GIFs with
 * native GIF generation, no video conversion.
 *
 *   import { generateImage } from 'ai';
 *   import { aigifmaker } from 'aigifmaker-ai-provider';
 *
 *   const { image } = await generateImage({ model: aigifmaker.image(), prompt: 'a corgi in sunglasses dancing on a beach, looping' });
 *   // image.uint8Array is the .gif file; providerMetadata.aigifmaker.images[0].url is its hosted URL
 *
 * Set `apiKey` or AIGIFMAKER_API_KEY; create a key at https://aigifmaker.ai/settings/apikeys.
 * Each GIF costs 1 credit on your AI GIF Maker account, the same as on the website.
 */

export interface AigifmakerProviderSettings {
  /** Key from https://aigifmaker.ai/settings/apikeys. Defaults to AIGIFMAKER_API_KEY. */
  apiKey?: string;
  /** Service root, for a test or a proxy. */
  baseURL?: string;
  /** Custom fetch implementation. */
  fetch?: typeof fetch;
  /** Poll interval in milliseconds. Default 3 seconds. */
  pollIntervalMs?: number;
  /** Deadline for one GIF in milliseconds. Default 15 minutes. */
  timeoutMs?: number;
}

export interface AigifmakerProvider {
  /** The GIF model. `gif-maker-v1` is the only id. */
  image(modelId?: string): ImageModelV4;
  imageModel(modelId?: string): ImageModelV4;
}

export const IMAGE_MODELS = ['gif-maker-v1'] as const;
const IMAGE_MODEL = 'gif-maker-v1';

export { AigifmakerError, AuthError, QuotaError, RejectedError, GenerationFailedError } from 'aigifmaker';

class AigifmakerImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'aigifmaker';
  readonly maxImagesPerCall = 1;
  readonly supportsFileInputs = false;
  readonly supportsMaskInputs = false;

  constructor(readonly modelId: string, private readonly settings: AigifmakerProviderSettings) {}

  async doGenerate(options: ImageModelV4CallOptions): Promise<ImageModelV4Result> {
    const warnings: ImageModelV4Result['warnings'] = [];
    if (options.size) warnings.push({ type: 'unsupported', feature: 'size' });
    if (options.aspectRatio) warnings.push({ type: 'unsupported', feature: 'aspectRatio' });
    if (options.seed !== undefined) warnings.push({ type: 'unsupported', feature: 'seed' });
    if (!options.prompt?.trim()) throw new AigifmakerError('prompt is required');

    const f = this.settings.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
    const signal = options.abortSignal;
    const client = new Client({
      apiKey: this.settings.apiKey,
      baseUrl: this.settings.baseURL,
      timeout: this.settings.timeoutMs,
      pollEvery: this.settings.pollIntervalMs,
      fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
        f(input, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(options.headers as Record<string, string>) }, signal })) as typeof fetch,
    });
    const url = await client.generate(options.prompt);
    const bytes = new Uint8Array(await (await f(url, { signal })).arrayBuffer());
    return {
      images: [bytes],
      warnings,
      providerMetadata: { aigifmaker: { images: [{ url }] } },
      response: { timestamp: new Date(), modelId: this.modelId, headers: undefined },
    };
  }
}

export function createAigifmaker(settings: AigifmakerProviderSettings = {}): AigifmakerProvider {
  const image = (modelId: string = IMAGE_MODEL) => new AigifmakerImageModel(modelId, settings);
  return { image, imageModel: image };
}

/** Default instance: reads AIGIFMAKER_API_KEY. */
export const aigifmaker = createAigifmaker();
export { KEYS_URL };
