/**
 * Supabase Edge Function: Gemini API Proxy
 * Securely proxies requests to Google's Gemini AI API
 * Prevents API key exposure in frontend code
 */

// @ts-ignore: Deno global available in Supabase Edge Functions
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeminiRequest {
  prompt: string
  systemInstruction?: string
  model?: string
  pdfData?: string // Base64 encoded PDF
  imageData?: string // Base64 encoded image
  tools?: ToolDefinition[] // Function calling tools
  toolResult?: { // Result from a tool call to continue conversation
    toolName: string
    result: any
  }
}

interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

serve(async (req) => {
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

    // Parse request body
    const { prompt, systemInstruction, model = 'gemini-2.0-flash-exp', pdfData, imageData, tools, toolResult }: GeminiRequest = await req.json()

    if (!prompt) {
      throw new Error('Prompt is required')
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`

    // Build parts array for multimodal input
    const parts: any[] = [{ text: prompt }]

    // Add PDF if provided
    if (pdfData) {
      parts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: pdfData
        }
      })
    }

    // Add image if provided
    if (imageData) {
      parts.push({
        inline_data: {
          mime_type: "image/jpeg", // Assume JPEG, could be enhanced
          data: imageData
        }
      })
    }

    // Build contents array - handle tool result continuation
    let contents: any[] = []
    if (toolResult) {
      // This is a continuation after a tool call
      contents = [
        { role: 'user', parts: [{ text: prompt }] },
        {
          role: 'model',
          parts: [{
            functionCall: {
              name: toolResult.toolName,
              args: {}
            }
          }]
        },
        {
          role: 'function',
          parts: [{
            functionResponse: {
              name: toolResult.toolName,
              response: toolResult.result
            }
          }]
        }
      ]
    } else {
      contents = [{ parts: parts }]
    }

    const geminiPayload: any = {
      contents,
      ...(systemInstruction && {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      }),
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    }

    // Add function calling tools if provided
    if (tools && tools.length > 0) {
      geminiPayload.tools = [{
        functionDeclarations: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }]
      geminiPayload.toolConfig = {
        functionCallingConfig: {
          mode: 'AUTO' // Let Gemini decide when to call tools
        }
      }
    }

    const geminiResponse = await fetch(geminiUrl, {
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

    // Check for function call response
    const candidate = data.candidates?.[0]
    const parts = candidate?.content?.parts || []

    // Check if the response contains a function call
    const functionCallPart = parts.find((part: any) => part.functionCall)
    if (functionCallPart) {
      // Return the function call for the client to execute
      return new Response(
        JSON.stringify({
          functionCall: {
            name: functionCallPart.functionCall.name,
            args: functionCallPart.functionCall.args || {}
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Extract response text
    const responseText = parts.find((part: any) => part.text)?.text || 'No response generated'

    return new Response(
      JSON.stringify({ response: responseText }),
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
