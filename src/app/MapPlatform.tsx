'use client'

import React, { useState, useCallback, useRef } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import { Search } from 'lucide-react'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBlLUjd6-b5hc3q9ifFhS4LWQWOMSzr_Js'

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

// Coordinates for Vasco Da Gama, Goa
const center = {
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
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<typeof locations[0] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const searchInputRef = useRef<HTMLInputElement>(null)

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
  }, [])

  const onUnmount = useCallback((mapInstance: google.maps.Map) => {
    setMap(null)
  }, [])

  const handleMarkerClick = (location: typeof locations[0]) => {
    setSelectedLocation(location)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log('Searching for:', searchQuery)
  }

  // Filter locations based on search query
  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
        {filteredLocations.map((location) => (
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

      {/* Search Bar in Top Left Corner */}
      <div className="absolute top-4 left-4 z-10 w-full max-w-md px-4">
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
            className="flex-grow px-4 py-2 focus:outline-none"
            aria-label="Search locations"
          />
        </form>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center w-screen h-screen">
      <p>Loading...</p>
    </div>
  )
}
