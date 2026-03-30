"use client"

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Play } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

interface CinematicHeroProps {
  title?: string
  subtitle?: string
  description?: string
  trailerUrl?: string
  releaseDate?: string
}

export default function CinematicHero({
  title = "SPIDER-MAN: BRAND NEW DAY",
  subtitle = "The Web-Slinger Returns",
  description = "Peter Parker faces his greatest challenge yet as new threats emerge in New York City. With great power comes great responsibility, and this time, the stakes have never been higher.",
  trailerUrl = "https://www.youtube.com/watch?v=8TZMtslA3UY",
  releaseDate = "JULY 31, 2026"
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLParagraphElement>(null)
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 80%',
          end: 'bottom 20%',
          toggleActions: 'play none none reverse'
        }
      })

      tl.from(titleRef.current, {
        y: 100,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      })
      .from(subtitleRef.current, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
      }, '-=0.5')
      .from(descriptionRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
      }, '-=0.4')
      .from(phoneRef.current, {
        scale: 0.8,
        opacity: 0,
        rotateY: -30,
        duration: 1,
        ease: 'back.out(1.7)'
      }, '-=0.5')
      .from(dateRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out'
      }, '-=0.3')
    }, containerRef)

    return () => ctx.revert()
  }, [])

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop()
    return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center py-20 px-4"
      style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(196,30,58,0.1) 50%, rgba(0,0,0,0.9) 100%)'
      }}
    >
      <div className="max-w-6xl w-full">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left side - Text content */}
          <div className="text-center md:text-left space-y-6">
            <h1
              ref={titleRef}
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight"
              style={{
                color: '#c41e3a',
                textShadow: '0 0 40px rgba(196,30,58,0.8), 0 0 80px rgba(196,30,58,0.4)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.05em'
              }}
            >
              {title}
            </h1>

            <p
              ref={subtitleRef}
              className="text-xl md:text-3xl font-semibold"
              style={{
                color: '#0066cc',
                textShadow: '0 0 20px rgba(0,102,204,0.6)'
              }}
            >
              {subtitle}
            </p>

            <p
              ref={descriptionRef}
              className="text-base md:text-lg leading-relaxed"
              style={{
                color: '#c8a96e'
              }}
            >
              {description}
            </p>

            <p
              ref={dateRef}
              className="text-sm md:text-base font-bold tracking-widest pt-4"
              style={{
                color: '#c41e3a',
                textShadow: '0 0 10px rgba(196,30,58,0.5)'
              }}
            >
              IN CINEMAS {releaseDate}
            </p>
          </div>

          {/* Right side - Phone mockup with trailer */}
          <div ref={phoneRef} className="flex justify-center">
            <div className="relative" style={{ perspective: '1000px' }}>
              {/* Phone frame */}
              <div
                className="relative rounded-[3rem] overflow-hidden"
                style={{
                  width: '320px',
                  height: '650px',
                  background: 'linear-gradient(145deg, #1a1a1a, #0a0a0a)',
                  boxShadow: '0 0 60px rgba(196,30,58,0.5), 0 20px 80px rgba(0,0,0,0.8)',
                  border: '8px solid #000',
                  borderRadius: '3rem'
                }}
              >
                {/* Notch */}
                <div
                  className="absolute top-0 left-1/2 transform -translate-x-1/2 z-20"
                  style={{
                    width: '120px',
                    height: '30px',
                    background: '#000',
                    borderBottomLeftRadius: '20px',
                    borderBottomRightRadius: '20px'
                  }}
                />

                {/* Screen content */}
                <div className="relative w-full h-full bg-black p-4 flex flex-col">
                  {/* Video container */}
                  <div className="flex-1 flex items-center justify-center">
                    {!showVideo ? (
                      <button
                        onClick={() => setShowVideo(true)}
                        className="relative w-full h-full flex items-center justify-center group"
                        style={{
                          background: 'linear-gradient(135deg, rgba(196,30,58,0.2) 0%, rgba(0,102,204,0.2) 100%)',
                          borderRadius: '1rem',
                          border: '2px solid rgba(196,30,58,0.5)'
                        }}
                      >
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            background: 'radial-gradient(circle, rgba(196,30,58,0.3) 0%, transparent 70%)'
                          }}
                        >
                          <div
                            className="flex items-center justify-center rounded-full transition-all duration-300 group-hover:scale-110"
                            style={{
                              width: '80px',
                              height: '80px',
                              background: 'linear-gradient(135deg, #c41e3a 0%, #e62429 100%)',
                              boxShadow: '0 0 30px rgba(196,30,58,0.8)'
                            }}
                          >
                            <Play size={36} fill="#ffffff" color="#ffffff" />
                          </div>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 text-center">
                          <p className="text-white font-bold text-sm" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                            WATCH TRAILER
                          </p>
                        </div>
                      </button>
                    ) : (
                      <iframe
                        src={getYouTubeEmbedUrl(trailerUrl)}
                        className="w-full h-full rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{
                          border: 'none',
                          borderRadius: '1rem'
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Phone highlights */}
                <div
                  className="absolute top-8 left-0 w-1 h-12 rounded-r"
                  style={{ background: 'linear-gradient(180deg, #333, #111)' }}
                />
                <div
                  className="absolute top-24 left-0 w-1 h-16 rounded-r"
                  style={{ background: 'linear-gradient(180deg, #333, #111)' }}
                />
                <div
                  className="absolute top-24 right-0 w-1 h-20 rounded-l"
                  style={{ background: 'linear-gradient(180deg, #333, #111)' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
