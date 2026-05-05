import { useEffect, useRef } from 'react'

export default function ScrollBackground() {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const scrub = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      if (docHeight <= 0 || !video.duration) return
      const fraction = Math.min(scrollTop / docHeight, 1)
      video.currentTime = fraction * video.duration
    }

    video.addEventListener('loadedmetadata', scrub)
    window.addEventListener('scroll', scrub, { passive: true })

    return () => {
      video.removeEventListener('loadedmetadata', scrub)
      window.removeEventListener('scroll', scrub)
    }
  }, [])

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: -2,
        width: '100vw', height: '100vh', overflow: 'hidden',
        pointerEvents: 'none'
      }}>
        <video
          ref={videoRef}
          src="/videos/bg_scrub.mp4"
          muted
          playsInline
          preload="auto"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div style={{
        position: 'fixed', inset: 0, zIndex: -1,
        background: 'linear-gradient(to bottom, rgba(48,110,79,0.15), rgba(26,26,26,0.25))',
        pointerEvents: 'none'
      }} />
    </>
  )
}
