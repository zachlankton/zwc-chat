// Curated list of favorite model IDs
export const FAVORITE_MODELS = [
	"anthropic/claude-3.5-sonnet",
	"anthropic/claude-3.5-haiku",
	"openai/gpt-4o",
	"openai/gpt-4o-mini",
	"google/gemini-2.0-flash-exp",
	"google/gemini-1.5-pro",
	"deepseek/deepseek-r1",
	"deepseek/deepseek-chat",
	"meta-llama/llama-3.3-70b-instruct",
	"x-ai/grok-2-1212",
	"qwen/qwen-2.5-72b-instruct",
	"mistralai/mixtral-8x22b-instruct",
];

// Default model if none specified
export const DEFAULT_MODEL = "openai/gpt-4o-mini";

// Cache configuration
export const MODEL_CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
