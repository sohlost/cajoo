// components/MapPlatform.tsx

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import { Search, X } from 'lucide-react'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

// Sample location data - removed international locations
const locations: MarkerType[] = []

// Unified marker type
type MarkerType = {
  id: string | number
  name: string
  position: { lat: number, lng: number }
  description: string
}

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

// Helper function to format search results with better typography
const formatSearchResults = (results: string[]) => {
  return results.map((result, idx) => {
    // Split by sentences and format bold text
    const formattedText = result
      .split(/(\*\*[^*]+\*\*)/)
      .map((part, partIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={partIdx} className="text-base font-bold text-gray-900">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return part
      })

    return (
      <div key={idx} className="mb-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">
          {formattedText}
        </div>
      </div>
    )
  })
}

export default function MapPlatform() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || ''
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [center, setCenter] = useState(defaultCenter)
  const [selectedLocation, setSelectedLocation] = useState<MarkerType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<string[]>([]) // Store array of search results
  const [isLoading, setIsLoading] = useState(false) // Loading state
  const [isSearchExpanded, setIsSearchExpanded] = useState(false) // Search expansion state
  const [showResults, setShowResults] = useState(false) // Results visibility
  const [searchMarkers, setSearchMarkers] = useState<MarkerType[]>([]) // Markers from search results

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

  const handleMarkerClick = (location: MarkerType) => {
    setSelectedLocation(location)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleSearchButtonClick = () => {
    if (!isSearchExpanded) {
      setIsSearchExpanded(true)
      setTimeout(() => searchInputRef.current?.focus(), 300)
    } else if (searchQuery.trim()) {
      handleSearch()
    }
  }

  // Function to fit map bounds to show all markers
  const fitMapToMarkers = (markers: MarkerType[]) => {
    if (!map || markers.length === 0) return

    const bounds = new google.maps.LatLngBounds()
    
    // Add user's current location
    bounds.extend(new google.maps.LatLng(center.lat, center.lng))
    
    // Add all search result markers
    markers.forEach(marker => {
      bounds.extend(new google.maps.LatLng(marker.position.lat, marker.position.lng))
    })

    map.fitBounds(bounds)
    
    // Add some padding
    const padding = { top: 100, right: 100, bottom: 200, left: 100 }
    map.fitBounds(bounds, padding)
  }

  const handleSearch = async () => {
    console.log('Searching for:', searchQuery)

    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsLoading(true)
    setSearchResults([]) // Clear previous results
    setShowResults(true)

    try {
      // Include location data in the API request
      const searchParams = new URLSearchParams({
        query: searchQuery,
        lat: center.lat.toString(),
        lng: center.lng.toString()
      })

      const response = await fetch(`/api/search?${searchParams.toString()}`, {
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

      // Use geocoded places from Google Maps API
      if (data.places && Array.isArray(data.places)) {
        const markers: MarkerType[] = data.places.map((place: any, idx: number) => {
          let description = place.address || 'Location found'
          if (place.rating) {
            description += `\n⭐ Rating: ${place.rating}/5`
          }
          
          return {
            id: `place-${idx}`,
            name: place.name || 'Unknown Location',
            position: { lat: place.lat, lng: place.lng },
            description: description
          }
        })
        
        setSearchMarkers(markers)
        fitMapToMarkers(markers)
      }
    } catch (error) {
      console.error('Error fetching search results:', error)
      setSearchResults(['An error occurred while fetching search results.'])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await handleSearch()
  }

  const closeResults = () => {
    setShowResults(false)
    setSearchResults([])
    setSearchQuery('')
    setIsSearchExpanded(false)
    setSearchMarkers([]) // Clear search markers from map
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
            onClick={() => handleMarkerClick(location as MarkerType)}
          />
        ))}

        {selectedLocation && (
          <InfoWindow
            position={selectedLocation.position}
            onCloseClick={() => setSelectedLocation(null)}
          >
            <div className="max-w-xs">
              <h3 className="font-bold text-lg text-gray-900 mb-2">{selectedLocation.name}</h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{selectedLocation.description}</p>
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  📍 {selectedLocation.position.lat.toFixed(6)}, {selectedLocation.position.lng.toFixed(6)}
                </p>
              </div>
            </div>
          </InfoWindow>
        )}

        {searchMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            onClick={() => handleMarkerClick(marker)}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#10B981"/>
                  <circle cx="12" cy="9" r="2.5" fill="white"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 32)
            }}
          />
        ))}
      </GoogleMap>

      {/* Search Interface */}
      <div className={`absolute left-1/2 transform -translate-x-1/2 z-10 transition-all duration-500 ease-in-out ${
        showResults ? 'top-6' : 'bottom-6'
      }`}>
        <div className="flex items-center gap-4">
          {/* Circular Search Button */}
          <button
            onClick={handleSearchButtonClick}
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 overflow-hidden ${
              isSearchExpanded 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-transparent'
            }`}
            aria-label="Search"
          >
            {isSearchExpanded ? (
              <Search className="w-6 h-6" />
            ) : (
              <img 
                src="/favicon.ico" 
                alt="Search" 
                className="w-full h-full object-cover rounded-full"
              />
            )}
          </button>

          {/* Expandable Search Bar */}
          <div 
            className={`transition-all duration-300 ease-in-out ${
              isSearchExpanded ? 'w-80 opacity-100' : 'w-0 opacity-0'
            } overflow-hidden`}
          >
            <form onSubmit={handleSearchSubmit} className="w-full">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search for places near me..."
                className="w-full px-6 py-4 rounded-full shadow-lg border-0 focus:outline-none text-gray-800 text-lg"
                aria-label="Search locations"
              />
            </form>
          </div>
        </div>
      </div>

      {/* Results Panel - Center of Screen */}
      {showResults && (
        <div className={`absolute left-1/2 transform -translate-x-1/2 z-10 transition-all duration-500 ease-in-out ${
          showResults ? 'top-24 opacity-100' : 'top-32 opacity-0'
        }`}>
          <div className="w-96 max-h-96 bg-white rounded-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Search Results</h2>
              <button
                onClick={closeResults}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                aria-label="Close results"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-80 overflow-y-auto p-4">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="ml-3 text-gray-600">Finding places...</p>
                </div>
              )}

              {searchResults.length > 0 && !isLoading && (
                <div className="space-y-3">
                  {formatSearchResults(searchResults)}
                </div>
              )}

              {searchResults.length === 0 && !isLoading && showResults && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No results found. Try a different search term.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="flex items-center justify-center w-screen h-screen">
      <p>Loading...</p>
    </div>
  )
}