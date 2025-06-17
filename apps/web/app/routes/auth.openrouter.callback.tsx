import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { exchangeCodeForKey } from "~/lib/openrouter-pkce";
import { put } from "~/lib/fetchWrapper";
import { queryClient } from "~/providers/queryClient";
import { Button } from "~/components/ui/button";
import { Loader2 } from "lucide-react";

export default function OpenRouterCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      
      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        return;
      }
      
      try {
        // Exchange the code for an API key
        const { key } = await exchangeCodeForKey(code);
        
        // Save the key to the backend
        await put('/api/user/openrouter-key', { key });
        
        // Invalidate queries to refresh the session data
        await queryClient.invalidateQueries({ queryKey: ['APIKEYINFO'] });
        await queryClient.invalidateQueries({ queryKey: ['session'] });
        
        setStatus('success');
        
        // Redirect back to chat after a short delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    };
    
    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <h2 className="mt-6 text-2xl font-bold">Connecting to OpenRouter</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Please wait while we complete the setup...
              </p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-6 text-2xl font-bold">Successfully Connected!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your OpenRouter API key has been saved. Redirecting you back to the chat...
              </p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="mt-6 text-2xl font-bold">Connection Failed</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {error}
              </p>
              <div className="mt-6 space-y-2">
                <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                  Return to Chat
                </Button>
                <Button onClick={() => window.location.href = '/'} className="w-full">
                  Try Again
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}