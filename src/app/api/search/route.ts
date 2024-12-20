// app/api/search/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''

    // Validate query
    if (!query.trim()) {
      return NextResponse.json({ error: 'No query provided.' }, { status: 400 })
    }

    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) {
      console.error('Perplexity API key not provided')
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
    }

    // Construct the request to the Perplexity API
    const body = {
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content: "Be precise and concise."
        },
        {
          role: "user",
          content: query
        }
      ]
    }

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
    })

    if (!perplexityResponse.ok) {
      console.error('Perplexity API request failed:', await perplexityResponse.text())
      return NextResponse.json({ error: 'Failed to fetch results.' }, { status: 500 })
    }

    const perplexityData = await perplexityResponse.json()

    // The response structure may vary. Typically, you would extract the model output.
    // Adjust this according to the actual Perplexity API response format.
    // Let's assume perplexityData contains an array of choices, each with a message.content
    const results = perplexityData?.choices?.map((choice: any) => choice.message?.content) || []

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error in /api/search:', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
