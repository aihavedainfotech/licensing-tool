import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import AnimatedLogo from '../components/AnimatedLogo'

/* ─────────────────────────────────────────────
   Mini Dashboard Panel (right side)
───────────────────────────────────────────── */
function DashboardPreview() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Slight delay so the user sees the animation start after sliding in
    const t = setTimeout(() => setMounted(true), 350)
    return () => clearTimeout(t)
  }, [])

  const bars = [
    { role: 'HR Specialist',  pct: 92, count: 18, hot: true  },
    { role: 'Payroll Admin',  pct: 74, count: 14, hot: true  },
    { role: 'Benefits Mgr',   pct: 55, count: 11, hot: false },
    { role: 'Recruiter',      pct: 38, count:  8, hot: false },
    { role: 'Line Manager',   pct: 22, count:  5, hot: false },
  ]

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'white',
      borderRadius: 20,
      boxShadow: '0 24px 64px rgba(29,111,164,0.14)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>
        {`
          @keyframes dashSlideDown {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes dashFadeUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes dashFadeInLeft {
            from { transform: translateX(-15px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes dashFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .dash-anim-header { animation: dashSlideDown 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .dash-anim-kpi { animation: dashFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .dash-anim-row { animation: dashFadeInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .dash-anim-fade { animation: dashFadeIn 0.8s ease both; }
        `}
      </style>

      {/* Panel header */}
      <div className="dash-anim-header" style={{
        padding: '14px 20px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(90deg, #31231a 0%, #ba6017 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AnimatedLogo size={24} />
          <span style={{ color: 'white', fontSize: 12, fontWeight: 700, letterSpacing: '0.01em' }}>
            Costed Privilege Analytics
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => (
            <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 1, background: '#f1f5f9', flexShrink: 0,
      }}>
        {[
          { label: 'Costed Privileges',  value: '247',   sub: 'in active roles',  color: '#ba6017' },
          { label: 'Licences Consumed',  value: '1,840', sub: 'of 2,000 allocated', color: '#0077b6' },
          { label: 'Over-provisioned',   value: '38',    sub: 'roles flagged',     color: '#C74634' },
        ].map((k, i) => (
          <div key={k.label} className="dash-anim-kpi" style={{
            background: 'white', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2,
            animationDelay: `${0.15 + i * 0.1}s`
          }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, letterSpacing: '-0.02em' }}>
              {k.value}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="dash-anim-fade" style={{ flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', animationDelay: '0.4s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1a2b4a' }}>
            Licence Consumption by Role
          </span>
          <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, background: '#fef2f2',
            padding: '2px 8px', borderRadius: 99 }}>
            ● 2 roles over threshold
          </span>
        </div>

        {bars.map((b, i) => (
          <div key={b.role} className="dash-anim-row" style={{ display: 'flex', alignItems: 'center', gap: 10, animationDelay: `${0.45 + i * 0.08}s` }}>
            <span style={{ fontSize: 10, color: '#475569', width: 90, flexShrink: 0, fontWeight: 500 }}>
              {b.role}
            </span>
            <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: mounted ? `${b.pct}%` : '0%', borderRadius: 99,
                background: b.hot
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : 'linear-gradient(90deg, #ba6017, #d47e3b)',
                transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, width: 28, textAlign: 'right', flexShrink: 0,
              color: b.hot ? '#ef4444' : '#ba6017',
              opacity: mounted ? 1 : 0, transition: 'opacity 0.6s ease 0.6s',
              transform: mounted ? 'translateX(0)' : 'translateX(-5px)' }}>
              {b.count}
            </span>
          </div>
        ))}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 'auto', paddingTop: 8,
          borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 24, height: 6, borderRadius: 99,
              background: 'linear-gradient(90deg,#ef4444,#f97316)' }} />
            <span style={{ fontSize: 9, color: '#94a3b8' }}>Over-consumed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 24, height: 6, borderRadius: 99,
              background: 'linear-gradient(90deg,#ba6017,#d47e3b)' }} />
            <span style={{ fontSize: 9, color: '#94a3b8' }}>Within limit</span>
          </div>
        </div>
      </div>

      {/* Bottom badge */}
      <div className="dash-anim-fade" style={{
        padding: '8px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        animationDelay: '0.8s'
      }}>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>Last analysed: just now</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,2,3,4,5].map(n => (
            <div key={n} style={{ width: 6, height: 6, borderRadius: '50%',
              background: n <= 4 ? '#ba6017' : '#e2e8f0' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Landing Page
───────────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate()

  const points = [
    'Identify every costed privilege and its licence cost impact across all users',
    'See exactly which roles are consuming the most licences — and why',
    'Pinpoint over-provisioned role-privilege assignments driving unnecessary spend',
  ]

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'linear-gradient(140deg, #f8fafc 0%, #eef6fb 50%, #e8f0ff 100%)',
    }}>

      {/* ══ HEADER ═══════════════════════════════════════════════════ */}
      <header style={{
        height: 58, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(226,232,240,0.8)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AnimatedLogo size={34} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#C74634',
              letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1 }}>
              Oracle HCM
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2b4a',
              letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Licence Intelligence
            </div>
          </div>
        </div>

        {/* Nav pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {['Privilege Analytics', 'Licence Usage', 'Role Reports'].map(l => (
            <span key={l} style={{
              fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 99,
              background: '#eef2f8', color: '#1a2b4a', cursor: 'default',
            }}>{l}</span>
          ))}
          <div style={{
            width: 32, height: 32, borderRadius: '50%', marginLeft: 4,
            background: 'linear-gradient(135deg, #ba6017, #d47e3b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 12, fontWeight: 700,
          }}>A</div>
        </div>
      </header>

      {/* ══ BODY ══════════════════════════════════════════════════════ */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        overflow: 'hidden',
        maxWidth: 1280,
        margin: '0 auto',
        width: '100%',
      }}>

        {/* ── LEFT: All text ──────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '0 20px 0 48px',
          animation: 'fadeUp 0.65s ease-out both',
        }}>

          {/* Label */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            marginBottom: 20, alignSelf: 'flex-start',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C74634' }} />
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#C74634',
              letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>
              Oracle HCM · Licence Intelligence Platform
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            margin: '0 0 18px',
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            fontSize: 'clamp(2rem, 3vw, 3rem)',
          }}>
            Know Exactly Which<br />
            Privileges Are{' '}
            <span style={{
              background: 'linear-gradient(130deg, #ba6017 0%, #a65615 50%, #d47e3b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Costing You
            </span>
          </h1>

          {/* Description */}
          <p style={{
            margin: '0 0 24px',
            color: '#475569',
            fontSize: '0.9375rem',
            lineHeight: 1.8,
            maxWidth: '30rem',
          }}>
            A purpose-built analytics tool for Oracle HCM administrators.
            Upload your HCM reports to understand how{' '}
            <strong style={{ color: '#1a2b4a', fontWeight: 600 }}>
              costed privileges flow through roles
            </strong>
            {' '}and which assignments are driving unnecessary licence spend.
          </p>

          {/* Key points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 30 }}>
            {points.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <CheckCircle2 size={16} style={{ color: '#ba6017', marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: '0.8625rem', color: '#475569', lineHeight: 1.6 }}>{p}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button
              id="get-started-btn"
              onClick={() => navigate('/upload')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '13px 32px', borderRadius: 14,
                fontSize: '0.9375rem', fontWeight: 700,
                background: 'linear-gradient(135deg, #31231a 0%, #ba6017 100%)',
                color: 'white', border: 'none', cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(29,111,164,0.35)',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={e => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.transform = 'translateY(-2px)'
                b.style.boxShadow = '0 10px 30px rgba(29,111,164,0.45)'
              }}
              onMouseLeave={e => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.transform = 'translateY(0)'
                b.style.boxShadow = '0 6px 20px rgba(29,111,164,0.35)'
              }}
            >
              Let&apos;s Get Started
              <ArrowRight size={17} />
            </button>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Upload up to 3 HCM documents
            </span>
          </div>

          {/* Trust */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }}>
            <div style={{ display: 'flex' }}>
              {['#ba6017','#a65615','#d47e3b','#c16722'].map((c, i) => (
                <div key={i} style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: c, border: '2px solid white',
                  marginLeft: i > 0 ? -8 : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 9, fontWeight: 700,
                }}>{String.fromCharCode(65+i)}</div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Trusted by{' '}
              <strong style={{ color: '#ba6017' }}>2,400+</strong>
              {' '}Oracle HCM administrators
            </span>
          </div>
        </div>

        {/* ── RIGHT: Dashboard preview ─────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 48px 24px 0',
          animation: 'slideInRight 0.8s ease-out both',
        }}>
          {/* Decorative tilt card behind panel */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 520 }}>
            <div style={{
              position: 'absolute', inset: -10,
              background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
              borderRadius: 26, transform: 'rotate(-2.5deg)',
              opacity: 0.5,
            }} />
            <div style={{ position: 'relative' }}>
              <DashboardPreview />
            </div>
          </div>
        </div>
      </main>

      {/* ══ FOOTER STRIP ══════════════════════════════════════════════ */}
      <footer style={{
        height: 42, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px',
        background: '#1a2b4a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AnimatedLogo size={22} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            Oracle HCM Licence Intelligence © 2024
          </span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy', 'Terms', 'Support'].map(l => (
            <span key={l} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>
              {l}
            </span>
          ))}
        </div>
      </footer>
    </div>
  )
}
