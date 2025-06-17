// OpenRouter PKCE OAuth implementation

// Generate a random code verifier
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate SHA-256 code challenge from verifier
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64;
}

// Start the OAuth flow
export async function startOpenRouterOAuth(): Promise<string> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store the verifier in sessionStorage for later use
  sessionStorage.setItem('openrouter_code_verifier', codeVerifier);
  
  // Build the authorization URL
  const params = new URLSearchParams({
    callback_url: `${window.location.origin}/auth/openrouter/callback`,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  return `https://openrouter.ai/auth?${params.toString()}`;
}

// Exchange the authorization code for an API key
export async function exchangeCodeForKey(code: string): Promise<{ key: string }> {
  const codeVerifier = sessionStorage.getItem('openrouter_code_verifier');
  
  if (!codeVerifier) {
    throw new Error('No code verifier found. Please restart the authentication process.');
  }
  
  const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      code_challenge_method: 'S256',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }
  
  // Clean up the verifier
  sessionStorage.removeItem('openrouter_code_verifier');
  
  return response.json();
}