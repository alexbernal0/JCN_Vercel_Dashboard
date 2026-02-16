import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/landing-bg.jpg)' }}
      />
      
      {/* Overlay for better button visibility */}
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Content */}
      <div className="relative flex h-full items-center justify-center">
        <Link
          href="/dashboard"
          className="rounded-full bg-white/90 px-12 py-4 text-xl font-semibold text-gray-900 shadow-2xl transition-all hover:bg-white hover:scale-105 hover:shadow-3xl backdrop-blur-sm"
        >
          Enter
        </Link>
      </div>
    </div>
  )
}
