// app/api/search/route.ts
import { NextResponse } from 'next/server'

// Helper function to get location description from coordinates
async function getLocationDescription(lat: string, lng: string): Promise<string> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    )
    
    if (!response.ok) {
      return `coordinates ${lat}, ${lng}`
    }
    
    const data = await response.json()
    
    if (data.results && data.results.length > 0) {
      // Extract city/area information from address components
      const result = data.results[0]
      const addressComponents = result.address_components || []
      
      let city = ''
      let area = ''
      let state = ''
      let country = ''
      
      // Look for relevant location components
      for (const component of addressComponents) {
        const types = component.types
        
        if (types.includes('locality')) {
          city = component.long_name
        } else if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
          area = component.long_name
        } else if (types.includes('administrative_area_level_1')) {
          state = component.long_name
        } else if (types.includes('country')) {
          country = component.long_name
        }
      }
      
      // Build a general location string
      const locationParts = []
      
      // For areas like "Baner" or "Koregaon Park", use the area
      if (area && !area.toLowerCase().includes('ward') && !area.toLowerCase().includes('division')) {
        locationParts.push(area)
      }
      
      // Always include the city
      if (city) {
        locationParts.push(city)
      }
      
      // Add state for context
      if (state) {
        locationParts.push(state)
      }
      
      // Add country if it's not obvious from context
      if (country && country !== 'India') {
        locationParts.push(country)
      }
      
      const generalLocation = locationParts.join(', ')
      return generalLocation || `coordinates ${lat}, ${lng}`
    }
    
    return `coordinates ${lat}, ${lng}`
  } catch (error) {
    console.error('Error getting location description:', error)
    return `coordinates ${lat}, ${lng}`
  }
}

// Type for geocoded place
interface GeocodedPlace {
  name: string
  lat: number
  lng: number
  address: string
  rating: number | null
  place_id: string
}

// Helper function to geocode places using Google Places API and Geocoding API
async function geocodePlaces(searchResults: string[], userLat: string, userLng: string): Promise<GeocodedPlace[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error('Google Maps API key not found')
    return []
  }

  const placesWithCoords = []
  const processedLocations = new Set<string>() // Avoid duplicates

  for (const result of searchResults) {
    // Extract potential locations using multiple patterns
    const locations = extractLocationsFromText(result)
    
    for (const location of locations) {
      const locationKey = location.toLowerCase().trim()
      
      // Skip if already processed or too short
      if (processedLocations.has(locationKey) || location.length < 3) {
        continue
      }
      
      processedLocations.add(locationKey)

      try {
        // First try Google Geocoding API (better for addresses)
        const geocodingResult = await tryGeocoding(location, apiKey)
        
        if (geocodingResult) {
          placesWithCoords.push(geocodingResult)
          continue
        }

        // If geocoding fails, try Places API (better for business names)
        const placesResult = await tryPlacesSearch(location, userLat, userLng, apiKey)
        
        if (placesResult) {
          placesWithCoords.push(placesResult)
        }
      } catch (error) {
        console.error(`Error geocoding location "${location}":`, error)
      }
    }
  }

  return placesWithCoords
}

// Helper function to extract locations from text using multiple patterns
function extractLocationsFromText(text: string): string[] {
  const locations = new Set<string>()
  
  console.log('Extracting locations from text:', text.substring(0, 200) + '...')
  
  // Extract all text in bold (**Text**) - these are the place names
  const boldMatches = text.match(/\*\*([^*]+)\*\*/g)
  if (boldMatches) {
    console.log('Found bold matches:', boldMatches)
    boldMatches.forEach(match => {
      const location = match.replace(/\*\*/g, '').trim()
      // Include all bold text that's not too generic
      if (location.length > 2 && !isGenericText(location)) {
        console.log('Adding bold location:', location)
        locations.add(location)
      }
    })
  }
  
  const result = Array.from(locations).slice(0, 10) // Allow up to 10 locations
  console.log('Final extracted locations:', result)
  return result
}

// Helper function to check if text is too generic
function isGenericText(text: string): boolean {
  const genericWords = /^(the|and|or|in|at|on|near|best|good|great|popular|famous|top|here|there|this|that|where|what|how|when|why)$/i
  return genericWords.test(text.trim())
}

// Helper function to check for location keywords (currently unused but kept for future use)
// function hasLocationKeywords(text: string): boolean {
//   return /(?:Pune|Mumbai|Delhi|Bangalore|Chennai|Hyderabad|Kolkata|Ahmedabad|Baner|Koregaon|Wakad|Hinjewadi|Viman Nagar|Kharadi|Magarpatta|Aundh|Shivaji Nagar|Mall|Complex|Tower|Building|Center|Centre|Park|Garden|Market|Station|Airport|Fort|Palace|Temple|Mandir|Museum|Ashram|Cave|Zoo|Zoological)/i.test(text)
// }

// Helper function to check for business keywords (currently unused but kept for future use)
// function hasBusinessKeywords(text: string): boolean {
//   return /(?:Restaurant|Cafe|Hotel|Hospital|School|College|Office|Shop|Store|Bank|ATM|Gym|Spa|Salon|Theatre|Cinema|Club|Bar|Pub|Pharmacy|Medical|Clinic|Temple|Mandir|Museum|Fort|Palace|Garden|Park|Zoo|Ashram|Cave)/i.test(text)
// }

// Helper function to check if coordinates are in India
function isInIndia(lat: number, lng: number): boolean {
  // India's approximate bounding box
  const INDIA_BOUNDS = {
    north: 37.6,
    south: 6.4,
    east: 97.25,
    west: 68.7
  }
  
  return lat >= INDIA_BOUNDS.south && 
         lat <= INDIA_BOUNDS.north && 
         lng >= INDIA_BOUNDS.west && 
         lng <= INDIA_BOUNDS.east
}

// Helper function to try Google Geocoding API
async function tryGeocoding(location: string, apiKey: string): Promise<GeocodedPlace | null> {
  try {
    const geocodingQuery = encodeURIComponent(location)
    const geocodingResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${geocodingQuery}&key=${apiKey}`
    )

    if (geocodingResponse.ok) {
      const geocodingData = await geocodingResponse.json()
      
      if (geocodingData.results && geocodingData.results.length > 0) {
        const result = geocodingData.results[0]
        const lat = result.geometry.location.lat
        const lng = result.geometry.location.lng
        
        // Only return if the location is in India
        if (isInIndia(lat, lng)) {
          return {
            name: location,
            lat: lat,
            lng: lng,
            address: result.formatted_address || location,
            rating: null,
            place_id: result.place_id
          }
        }
      }
    }
  } catch (error) {
    console.error(`Geocoding API error for "${location}":`, error)
  }
  
  return null
}

// Helper function to try Google Places API
async function tryPlacesSearch(location: string, userLat: string, userLng: string, apiKey: string): Promise<GeocodedPlace | null> {
  try {
    const searchQuery = encodeURIComponent(`${location} near ${userLat},${userLng}`)
    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&key=${apiKey}`
    )

    if (placesResponse.ok) {
      const placesData = await placesResponse.json()
      
      if (placesData.results && placesData.results.length > 0) {
        const place = placesData.results[0]
        const lat = place.geometry.location.lat
        const lng = place.geometry.location.lng
        
        // Only return if the location is in India
        if (isInIndia(lat, lng)) {
          return {
            name: location,
            lat: lat,
            lng: lng,
            address: place.formatted_address || '',
            rating: place.rating || null,
            place_id: place.place_id
          }
        }
      }
    }
  } catch (error) {
    console.error(`Places API error for "${location}":`, error)
  }
  
  return null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    // Validate query
    if (!query.trim()) {
      return NextResponse.json({ error: 'No query provided.' }, { status: 400 })
    }

    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) {
      console.error('Perplexity API key not provided')
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
    }

    // Create location context if coordinates are provided
    let locationContext = ''
    if (lat && lng) {
      const locationDescription = await getLocationDescription(lat, lng)
      locationContext = ` The user is currently located at ${locationDescription}. Please provide location-specific results based on this location.`
    }

    // Construct the request to the Perplexity API
    const body = {
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content: `Be precise and concise. When providing location-based recommendations, always include complete addresses with specific details like building numbers, street names, area names, and city. Format business names in bold using **Business Name** format. For each location mentioned, provide the full address on a separate line. Focus on practical, actionable information.${locationContext}`
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
    interface Choice {
      message: {
        content: string;
      };
    }

    const results = perplexityData?.choices?.map((choice: Choice) => choice.message.content) || []

    // Geocode places mentioned in the results
    let places: GeocodedPlace[] = []
    if (lat && lng && results.length > 0) {
      places = await geocodePlaces(results, lat, lng)
    }

    return NextResponse.json({ results, places })
  } catch (error) {
    console.error('Error in /api/search:', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
