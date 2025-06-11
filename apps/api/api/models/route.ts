import { getCurrentSession } from "api/auth/session/utils";
import type { RequestWithSession } from "api/auth/session/sessionCache";
import { FAVORITE_MODELS, MODEL_CACHE_TTL } from "lib/modelConfig";

const OPENROUTER_MODELS_API = "https://openrouter.ai/api/v1/models";

// In-memory cache for models
let modelsCache: {
  data: any;
  timestamp: number;
} | null = null;

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
    instruct_type?: string;
  };
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
    web_search: string;
    internal_reasoning: string;
    input_cache_read: string;
    input_cache_write: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
  per_request_limits?: any;
  supported_parameters: string[];
}

export async function GET(request: RequestWithSession) {
  try {
    // Check authentication
    await getCurrentSession(request);
    if (!request.session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache
    if (modelsCache && Date.now() - modelsCache.timestamp < MODEL_CACHE_TTL) {
      return Response.json(modelsCache.data);
    }

    // Fetch models from OpenRouter
    const response = await fetch(OPENROUTER_MODELS_API, {
      headers: {
        "User-Agent": "z3chat/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data;

    // Separate favorites and all models
    const favoriteModels = models.filter((model) =>
      FAVORITE_MODELS.includes(model.id)
    );

    // Sort favorites by the order in FAVORITE_MODELS array
    favoriteModels.sort((a, b) => {
      const indexA = FAVORITE_MODELS.indexOf(a.id);
      const indexB = FAVORITE_MODELS.indexOf(b.id);
      return indexA - indexB;
    });

    // Sort all models alphabetically by name
    const sortedModels = [...models].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const result = {
      favorites: favoriteModels,
      all: sortedModels,
      timestamp: Date.now(),
    };

    // Update cache
    modelsCache = {
      data: result,
      timestamp: Date.now(),
    };

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching models:", error);
    return Response.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}