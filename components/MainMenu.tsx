'use client'

import { useEffect, useState } from 'react'
import type { GameMode } from '@/lib/types'

// ── Web-mercator projection onto the square world.jpg (zoom 2, centred 0,0) ─
// Returns { x, y } as percentages of the map panel.
function project(lon: number, lat: number): { x: number; y: number } {
  const x = (lon + 180) / 360
  const latR = Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180
  const mercN = Math.log(Math.tan(Math.PI / 4 + latR / 2))
  const y = (1 - mercN / Math.PI) / 2
  return { x: x * 100, y: y * 100 }
}

function coordLabel(lon: number, lat: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}° ${ns} · ${Math.abs(lon).toFixed(1)}° ${ew}`
}

interface Mode {
  key:    GameMode
  label:  string
  desc:   string
  img:    string
  lon:    number | null   // null → "anywhere" (Terra), no map pin
  lat:    number | null
  tag?:   string          // popularity tag
}

const MODES: Mode[] = [
  { key: 'terra',     label: 'Terra',     desc: 'The whole planet is in play — anywhere on Earth.', img: '/images/terra.jpg',     lon: null,    lat: null,   tag: 'Featured' },
  { key: 'urban',     label: 'Urban',     desc: 'Cities & towns worldwide, from grids to old quarters.', img: '/images/urban.jpg',     lon: -74.0,   lat: 40.7,   tag: 'Most popular' },
  { key: 'usa',       label: 'USA',       desc: 'Across the United States, coast to coast.', img: '/images/usa.jpg',       lon: -98.5,   lat: 39.5,   tag: 'Popular' },
  { key: 'europe',    label: 'Europe',    desc: 'Towns & cities across the European continent.', img: '/images/europe.jpg',    lon:  20.0,   lat: 53.0 },
  { key: 'mountains', label: 'Mountains', desc: 'High peaks and glaciers above 2,000 m.', img: '/images/mountains.jpg', lon:   7.5,   lat: 45.8 },
  { key: 'volcanoes', label: 'Volcanoes', desc: 'Active & dormant cones around the world.', img: '/images/volcanoes.jpg', lon: 138.7,   lat: 35.4 },
  { key: 'islands',   label: 'Islands',   desc: 'Reefs, atolls and remote shores.', img: '/images/islands.jpg',   lon: -151.7,  lat: -16.5 },
  { key: 'uncharted', label: 'Uncharted', desc: 'Jungle, desert and untamed wilderness.', img: '/images/uncharted.jpg', lon: -60.0,   lat: -3.0 },
  { key: 'airports',  label: 'Airports',  desc: 'Major aviation hubs worldwide.', img: '/images/airports.jpg',  lon:  55.3,   lat: 25.25 },
  { key: 'landmarks', label: 'Landmarks', desc: 'Iconic sites and human wonders.', img: '/images/landmarks.jpg', lon:  31.1,   lat: 30.0 },
]

const PINNED = MODES.filter(m => m.lon !== null && m.lat !== null)
const BEST_KEY = 'strata_best_score'

// Graticule lines (every 30°) projected onto the map
const GRAT = (() => {
  const v: number[] = []   // vertical (constant lon) → x%
  for (let lon = -150; lon <= 150; lon += 30) v.push(project(lon, 0).x)
  const h: number[] = []   // horizontal (constant lat) → y%
  for (let lat = -60; lat <= 60; lat += 30) h.push(project(0, lat).y)
  return { v, h }
})()

interface MainMenuProps {
  onPlay: (mode: GameMode) => void
}

export default function MainMenu({ onPlay }: MainMenuProps) {
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [selected,  setSelected]  = useState<GameMode>('terra')
  const [preview,   setPreview]   = useState<GameMode | null>(null)

  useEffect(() => {
    try {
      const stored = parseInt(localStorage.getItem(BEST_KEY) ?? '', 10)
      if (!isNaN(stored) && stored > 0) setBestScore(stored)
    } catch { /* storage blocked */ }
  }, [])

  const activeKey = preview ?? selected
  const active    = MODES.find(m => m.key === activeKey)!

  return (
    <div
      className="sx-root absolute inset-0 z-50 overflow-y-auto"
      style={{
        WebkitOverflowScrolling: 'touch' as never,
        overscrollBehavior:      'contain',
        animation:               'fadeIn 0.4s ease both',
      }}
    >
      <div
        className="relative"
        style={{
          minHeight:     '100%',
          maxWidth:      1120,
          margin:        '0 auto',
          paddingTop:    'calc(env(safe-area-inset-top, 0px) + 2.5rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)',
          paddingLeft:   'calc(env(safe-area-inset-left, 0px) + 1.35rem)',
          paddingRight:  'calc(env(safe-area-inset-right, 0px) + 1.35rem)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
          <div>
            <p style={{
              fontFamily: 'var(--font-display), system-ui, sans-serif', fontSize: 11, fontWeight: 500,
              letterSpacing: '0.34em', color: 'rgba(233,238,247,0.42)', textTransform: 'uppercase', margin: '0 0 8px',
            }}>
              Geography · Satellite
            </p>
            <h1 style={{
              fontFamily: 'var(--font-display), system-ui, sans-serif', fontWeight: 700,
              fontSize: 'clamp(40px, 7vw, 64px)', lineHeight: 0.9, letterSpacing: '-0.015em', color: '#f5f2ec', margin: 0,
            }}>
              Strata
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ display: 'inline-flex', gap: 3, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 4 }}>
              <button type="button" className="sx-tab sx-tab-active">Single Player</button>
              <button type="button" className="sx-tab" disabled style={{ cursor: 'default' }}>
                Multiplayer
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.08)', color: 'rgba(233,238,247,0.4)', padding: '2px 6px', borderRadius: 4 }}>Soon</span>
              </button>
            </div>
            {bestScore !== null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-display), system-ui, sans-serif',
                fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--accent)',
                background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', padding: '5px 11px', borderRadius: 999,
              }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                  <path d="M4 2h8v3a4 4 0 0 1-8 0V2Z" /><path d="M4 4H2v1a2 2 0 0 0 2 2M12 4h2v1a2 2 0 0 1-2 2M6 11h4M5.5 14h5M8 11v3" strokeLinecap="round" />
                </svg>
                Best {bestScore.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* ── Stage: world map + detail panel ── */}
        <div className="mx-stage">
          {/* Map */}
          <div className="mx-map" role="group" aria-label="World map — pick a mode by its location">
            <svg className="mx-grat" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {GRAT.v.map((x, i) => <line key={`v${i}`} x1={x} y1={0} x2={x} y2={100} stroke="#bcd4ee" strokeWidth={0.15} />)}
              {GRAT.h.map((y, i) => <line key={`h${i}`} x1={0} y1={y} x2={100} y2={y} stroke="#bcd4ee" strokeWidth={0.15} />)}
            </svg>

            {PINNED.map(m => {
              const { x, y } = project(m.lon!, m.lat!)
              const sel = activeKey === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  className={`mx-pin ${sel ? 'is-sel' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  aria-label={`${m.label} — ${m.desc}`}
                  onMouseEnter={() => setPreview(m.key)}
                  onMouseLeave={() => setPreview(null)}
                  onFocus={() => setPreview(m.key)}
                  onBlur={() => setPreview(null)}
                  onClick={() => { setSelected(m.key); setPreview(null) }}
                >
                  <span className="mx-pin-label">{m.label}</span>
                  <span className="mx-pin-dot" />
                </button>
              )
            })}
          </div>

          {/* Detail panel */}
          <div className="mx-card">
            <div className="mx-card-img" style={{ backgroundImage: `url(${active.img})` }} />
            <div className="mx-card-grad" />
            <div className="mx-card-body">
              <p className="mx-coord">
                {active.lon !== null && active.lat !== null
                  ? coordLabel(active.lon, active.lat)
                  : 'Whole planet'}
                {active.tag ? `  ·  ${active.tag}` : ''}
              </p>
              <h2 className="mx-card-name">{active.label}</h2>
              <p className="mx-card-desc">{active.desc}</p>
              <button type="button" className="mx-play" onClick={() => onPlay(selected)}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M4 2.5v11l9-5.5-9-5.5Z" /></svg>
                Play {MODES.find(m => m.key === selected)!.label}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mode chips — every mode, one tap ── */}
        <div className="mx-chips">
          {MODES.map(m => (
            <button
              key={m.key}
              type="button"
              className={`mx-chip ${selected === m.key ? 'is-sel' : ''}`}
              onMouseEnter={() => setPreview(m.key)}
              onMouseLeave={() => setPreview(null)}
              onClick={() => { setSelected(m.key); setPreview(null) }}
            >
              <span className="mx-chip-thumb" style={{ backgroundImage: `url(${m.img})` }} />
              {m.label}
              {m.tag && <span className="mx-chip-dot" />}
            </button>
          ))}
        </div>

        <p style={{ marginTop: 18, fontSize: 10.5, letterSpacing: '0.05em', color: 'rgba(225,232,244,0.26)' }}>
          Imagery © Mapbox · Maxar · NASA
        </p>
      </div>
    </div>
  )
}
