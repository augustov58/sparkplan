/**
 * Supabase Edge Function: Gemini API Proxy
 * Securely proxies requests to Google's Gemini AI API
 * Prevents API key exposure in frontend code
 */

// @ts-ignore: Deno global available in Supabase Edge Functions
declare const Deno: any;

// @ts-ignore: Deno URL import resolved at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore: Deno URL import resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildGeminiPayload, geminiUrl, readGeminiResponse, type GeminiRequest } from "./payload.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create Supabase client to verify auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify the user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured')
    }

    // Parse request body. The model is the proxy's own (payload.ts); a `model` field is ignored (#343).
    const request: GeminiRequest = await req.json()

    if (!request.prompt) {
      throw new Error('Prompt is required')
    }

    const geminiPayload = buildGeminiPayload(request)

    const geminiResponse = await fetch(geminiUrl(geminiApiKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiPayload),
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      
      // Parse error for better messages
      let errorMessage = `Gemini API returned ${geminiResponse.status}`
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error) {
          if (errorData.error.code === 429) {
            // Rate limit / quota exceeded
            if (errorData.error.message.includes('limit: 0')) {
              errorMessage = 'Gemini API free tier not enabled. Please check your API key in Google AI Studio and ensure free tier access is enabled, or enable billing for paid tier.'
            } else {
              errorMessage = `Rate limit exceeded: ${errorData.error.message}. Please wait and try again.`
            }
          } else if (errorData.error.code === 401) {
            errorMessage = 'Invalid Gemini API key. Please check your API key in Supabase Edge Functions secrets.'
          } else if (errorData.error.message) {
            errorMessage = errorData.error.message
          }
        }
      } catch (e) {
        // If parsing fails, use default message
      }
      
      throw new Error(errorMessage)
    }

    const data = await geminiResponse.json()

    // A function call (returned with its part, for the continuation) or the text
    return new Response(
      JSON.stringify(readGeminiResponse(data)),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in gemini-proxy:', error)

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
