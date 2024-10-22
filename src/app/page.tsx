import Head from 'next/head'
import dynamic from 'next/dynamic'
import './globals.css'


// Dynamically import the MapPlatform component with no SSR
const MapPlatform = dynamic(() => import('./MapPlatform'), { ssr: false })

export default function Home() {
  return (
    <>
      <Head>
        <title>My Map App</title>
        <meta name="description" content="Interactive map with search functionality" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <MapPlatform />
    </>
  )
}
