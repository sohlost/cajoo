// components/MapPlatform.tsx

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import { Search } from 'lucide-react'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

// Sample location data
const locations = [
  { id: 1, name: "Eiffel Tower", position: { lat: 48.8584, lng: 2.2945 }, description: "Iconic iron tower in Paris" },
  { id: 2, name: "Colosseum", position: { lat: 41.8902, lng: 12.4922 }, description: "Ancient amphitheater in Rome" },
  { id: 3, name: "Statue of Liberty", position: { lat: 40.6892, lng: -74.0445 }, description: "Colossal statue in New York Harbor" },
]

const mapContainerStyle = {
  width: '100vw',
  height: '100vh'
}

// Default center if geolocation is not available/fails
const defaultCenter = {
  lat: 15.3838,
  lng: 73.8578
}

// Map options to disable certain controls
const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true, // Disables all default UI
  zoomControl: true,      // Enables zoom control
  fullscreenControl: false,
  streetViewControl: false,
  mapTypeControl: false,
}

export default function MapPlatform() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || ''
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [center, setCenter] = useState(defaultCenter)
  const [selectedLocation, setSelectedLocation] = useState<typeof locations[0] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<string[]>([]) // Store array of search results
  const [isLoading, setIsLoading] = useState(false) // Loading state

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Attempt to get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setCenter({ lat: latitude, lng: longitude })
          if (map) {
            map.setCenter({ lat: latitude, lng: longitude })
          }
        },
        (error) => {
          console.error('Error getting current location:', error)
          // Fallback to default center if geolocation fails
        }
      )
    }
  }, [map])

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const handleMarkerClick = (location: typeof locations[0]) => {
    setSelectedLocation(location)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log('Searching for:', searchQuery)

    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsLoading(true)
    setSearchResults([]) // Clear previous results

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Ensure 'results' is an array
      if (Array.isArray(data.results)) {
        setSearchResults(data.results)
      } else {
        setSearchResults([data.results])
      }
    } catch (error) {
      console.error('Error fetching search results:', error)
      setSearchResults(['An error occurred while fetching search results.'])
    } finally {
      setIsLoading(false)
    }
  }

  return isLoaded ? (
    <div className="relative w-screen h-screen">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
        options={mapOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {locations.map((location) => (
          <Marker
            key={location.id}
            position={location.position}
            onClick={() => handleMarkerClick(location)}
          />
        ))}

        {selectedLocation && (
          <InfoWindow
            position={selectedLocation.position}
            onCloseClick={() => setSelectedLocation(null)}
          >
            <div>
              <h2 className="font-bold">{selectedLocation.name}</h2>
              <p>{selectedLocation.description}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Centered Search Bar */}
      <div 
        className="absolute top-4 left-1/2 z-10 w-full max-w-md px-4 transform -translate-x-1/2"
      >
        <form onSubmit={handleSearchSubmit} className="flex items-center bg-white rounded-full shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            className="p-3 bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            aria-label="Focus search input"
          >
            <Search className="w-5 h-5" />
          </button>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search locations..."
            className="flex-grow px-4 py-2 focus:outline-none text-black"
            aria-label="Search locations"
          />
        </form>

        {/* Display search results in a new box if available */}
        {isLoading && (
          <div className="mt-4 p-4 bg-white rounded shadow-lg max-h-60 overflow-y-auto text-black">
            <p>Loading search results...</p>
          </div>
        )}

        {searchResults.length > 0 && !isLoading && (
          <div className="mt-4 p-4 bg-white rounded shadow-lg max-h-60 overflow-y-auto text-black">
            <h3 className="font-bold mb-2">Search Results:</h3>
            <ul className="list-disc list-inside">
              {searchResults.map((result, idx) => (
                <li key={idx}>{result}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center w-screen h-screen">
      <p>Loading...</p>
    </div>
  )
}
