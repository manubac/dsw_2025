// CSS Modules
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

// Plain CSS side-effect imports
declare module '*.css' {}

// Image assets
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}

// scrolly-video
declare module 'scrolly-video/dist/ScrollyVideo.esm.jsx'

// Vite env
interface ImportMeta {
  readonly env: Record<string, string>
}
