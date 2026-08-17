/**
 * AnalyticsIllustration — Custom SVG enterprise illustration
 * Shows: Documents → AI Processing → HCM Analytics → Insights
 * with glowing blue/cyan data connections, charts, and HR icons.
 */
export default function AnalyticsIllustration() {
  return (
    <div className="relative w-full max-w-[520px] mx-auto select-none" style={{ aspectRatio: '1/1' }}>

      {/* ── Background glow blobs ───────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="animate-blob-pulse absolute w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(29,111,164,0.12) 0%, transparent 70%)', top: '10%', left: '15%' }} />
        <div className="animate-blob-pulse absolute w-56 h-56 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,180,216,0.10) 0%, transparent 70%)', bottom: '10%', right: '10%', animationDelay: '2s' }} />
      </div>

      {/* ── Main SVG ────────────────────────────────────────── */}
      <svg viewBox="0 0 480 480" fill="none" xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10">

        {/* ─── Defs: gradients & filters ─────────────────────── */}
        <defs>
          <linearGradient id="docGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8f4fc" />
            <stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>
          <linearGradient id="aiGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1a2b4a" />
            <stop offset="100%" stopColor="#1d6fa4" />
          </linearGradient>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d6fa4" />
            <stop offset="100%" stopColor="#00b4d8" />
          </linearGradient>
          <linearGradient id="insightGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0077b6" />
            <stop offset="100%" stopColor="#00b4d8" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1d6fa4" stopOpacity="0" />
            <stop offset="50%" stopColor="#00b4d8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1d6fa4" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softShadow">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#1d6fa4" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* ─── Layer 1: Document Cards (top-left) ─────────────── */}
        <g className="animate-float" style={{ animationDelay: '0s' }}>
          {/* Card 3 (back) */}
          <rect x="48" y="62" width="110" height="138" rx="10" fill="#dbeafe" opacity="0.6" />
          {/* Card 2 */}
          <rect x="38" y="54" width="110" height="138" rx="10" fill="#e8f4fc" />
          {/* Card 1 (front) */}
          <rect x="28" y="46" width="110" height="138" rx="10" fill="url(#docGrad)" filter="url(#softShadow)" />
          {/* Document lines */}
          <rect x="44" y="72" width="78" height="6" rx="3" fill="#94a3b8" opacity="0.6" />
          <rect x="44" y="85" width="60" height="5" rx="2.5" fill="#cbd5e1" opacity="0.8" />
          <rect x="44" y="96" width="70" height="5" rx="2.5" fill="#cbd5e1" opacity="0.8" />
          <rect x="44" y="107" width="50" height="5" rx="2.5" fill="#cbd5e1" opacity="0.8" />
          <rect x="44" y="118" width="65" height="5" rx="2.5" fill="#cbd5e1" opacity="0.8" />
          <rect x="44" y="129" width="40" height="5" rx="2.5" fill="#cbd5e1" opacity="0.8" />
          {/* PDF badge */}
          <rect x="44" y="148" width="36" height="20" rx="5" fill="#C74634" />
          <text x="62" y="163" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">PDF</text>
          {/* Document icon top right */}
          <circle cx="122" cy="60" r="12" fill="#1d6fa4" />
          <text x="122" y="65" textAnchor="middle" fill="white" fontSize="10" fontWeight="600">📄</text>
          {/* Label */}
          <rect x="28" y="192" width="110" height="22" rx="6" fill="white" opacity="0.8" />
          <text x="83" y="207" textAnchor="middle" fill="#1a2b4a" fontSize="9" fontWeight="600">HCM Documents</text>
        </g>

        {/* ─── Layer 2: DOCX / XLSX mini cards (top-right stack) ── */}
        <g className="animate-float-slow" style={{ animationDelay: '1.5s' }}>
          <rect x="330" y="30" width="100" height="70" rx="10" fill="white" filter="url(#softShadow)" />
          <rect x="330" y="30" width="100" height="8" rx="5" fill="#10b981" />
          <text x="380" y="37" textAnchor="middle" fill="white" fontSize="7" fontWeight="700">XLSX</text>
          {/* mini bar chart inside */}
          <rect x="344" y="65" width="8" height="20" rx="2" fill="#dbeafe" />
          <rect x="356" y="56" width="8" height="29" rx="2" fill="#93c5fd" />
          <rect x="368" y="60" width="8" height="25" rx="2" fill="#3b8fd4" />
          <rect x="380" y="50" width="8" height="35" rx="2" fill="#1d6fa4" />
          <rect x="392" y="55" width="8" height="30" rx="2" fill="#0077b6" />
          <rect x="404" y="47" width="8" height="38" rx="2" fill="#00b4d8" />

          {/* DOCX card */}
          <rect x="340" y="110" width="90" height="58" rx="10" fill="white" filter="url(#softShadow)" />
          <rect x="340" y="110" width="90" height="8" rx="5" fill="#3b8fd4" />
          <text x="385" y="117" textAnchor="middle" fill="white" fontSize="7" fontWeight="700">DOCX</text>
          <rect x="350" y="124" width="70" height="4" rx="2" fill="#cbd5e1" />
          <rect x="350" y="132" width="55" height="4" rx="2" fill="#e2e8f0" />
          <rect x="350" y="140" width="62" height="4" rx="2" fill="#e2e8f0" />
          <rect x="350" y="148" width="40" height="4" rx="2" fill="#e2e8f0" />
        </g>

        {/* ─── Layer 3: AI Processing Hub (center) ──────────────── */}
        <g filter="url(#softShadow)">
          {/* Outer ring */}
          <circle cx="240" cy="240" r="72" fill="none" stroke="#dbeafe" strokeWidth="2" strokeDasharray="6 4" />
          {/* Mid ring */}
          <circle cx="240" cy="240" r="56" fill="none" stroke="#bfdbfe" strokeWidth="1.5" />
          {/* Core */}
          <circle cx="240" cy="240" r="44" fill="url(#aiGrad)" />
          {/* Inner circle glow */}
          <circle cx="240" cy="240" r="32" fill="#1d6fa4" opacity="0.4" />
          <circle cx="240" cy="240" r="22" fill="#00b4d8" opacity="0.25" />
        </g>
        {/* AI Text */}
        <text x="240" y="234" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" letterSpacing="0.08em">AI</text>
        <text x="240" y="249" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="7.5" fontWeight="500" letterSpacing="0.12em">PROCESSING</text>

        {/* Orbit dots */}
        <g>
          <circle cx="240" cy="168" r="6" fill="#00b4d8" filter="url(#glow)" className="animate-pulse-glow" />
          <circle cx="312" cy="240" r="5" fill="#1d6fa4" filter="url(#glow)" className="animate-pulse-glow" style={{ animationDelay: '0.8s' }} />
          <circle cx="240" cy="312" r="6" fill="#00b4d8" filter="url(#glow)" className="animate-pulse-glow" style={{ animationDelay: '1.6s' }} />
          <circle cx="168" cy="240" r="5" fill="#1d6fa4" filter="url(#glow)" className="animate-pulse-glow" style={{ animationDelay: '2.4s' }} />
        </g>

        {/* ─── Layer 4: Data Connection Lines ──────────────────── */}
        {/* Doc → AI */}
        <path d="M 140 130 Q 190 180 196 196" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="6 4"
          fill="none" style={{ animation: 'data-flow 3s ease-in-out infinite' }} />
        {/* XLSX → AI */}
        <path d="M 342 95 Q 300 170 284 196" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="6 4"
          fill="none" style={{ animation: 'data-flow 3s ease-in-out 0.5s infinite' }} />
        {/* AI → Analytics (bottom-right) */}
        <path d="M 284 284 Q 320 330 346 350" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="6 4"
          fill="none" style={{ animation: 'data-flow 3s ease-in-out 1s infinite' }} />
        {/* AI → Insight panel (bottom-left) */}
        <path d="M 196 284 Q 160 330 130 360" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="6 4"
          fill="none" style={{ animation: 'data-flow 3s ease-in-out 1.5s infinite' }} />

        {/* ─── Layer 5: HCM Analytics Panel (bottom-right) ─────── */}
        <g className="animate-float" style={{ animationDelay: '1s' }}>
          <rect x="330" y="330" width="128" height="110" rx="14" fill="white" filter="url(#softShadow)" />
          {/* header strip */}
          <rect x="330" y="330" width="128" height="28" rx="14" fill="url(#aiGrad)" />
          <rect x="330" y="344" width="128" height="14" fill="url(#aiGrad)" />
          <text x="394" y="349" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700">HCM Analytics</text>
          {/* Chart bars */}
          <rect x="344" y="403" width="12" height="22" rx="3" fill="#dbeafe" />
          <rect x="360" y="392" width="12" height="33" rx="3" fill="#93c5fd" />
          <rect x="376" y="382" width="12" height="43" rx="3" fill="#3b8fd4" />
          <rect x="392" y="375" width="12" height="50" rx="3" fill="url(#chartGrad)" />
          <rect x="408" y="385" width="12" height="40" rx="3" fill="#0077b6" />
          <rect x="424" y="372" width="12" height="53" rx="3" fill="url(#insightGrad)" />
          {/* Trend line */}
          <polyline points="350,403 366,390 382,378 398,372 414,380 430,368"
            stroke="#00b4d8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
            filter="url(#glow)" />
          {/* Dots on line */}
          <circle cx="398" cy="372" r="3.5" fill="#00b4d8" filter="url(#glow)" />
          <circle cx="430" cy="368" r="3.5" fill="#00b4d8" filter="url(#glow)" />
        </g>

        {/* ─── Layer 6: Insights Panel (bottom-left) ──────────── */}
        <g className="animate-float-slow" style={{ animationDelay: '2.5s' }}>
          <rect x="22" y="340" width="122" height="105" rx="14" fill="white" filter="url(#softShadow)" />
          <rect x="22" y="340" width="122" height="28" rx="14" fill="url(#insightGrad)" />
          <rect x="22" y="354" width="122" height="14" fill="url(#insightGrad)" />
          <text x="83" y="349" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700">Workforce Insights</text>
          {/* KPI rows */}
          <rect x="34" y="374" width="40" height="4" rx="2" fill="#e2e8f0" />
          <rect x="80" y="374" width="30" height="4" rx="2" fill="#1d6fa4" opacity="0.6" />
          <text x="34" y="373" fill="#64748b" fontSize="7" fontWeight="500">Headcount</text>
          <text x="120" y="373" textAnchor="end" fill="#1d6fa4" fontSize="8" fontWeight="700">4,820</text>

          <rect x="34" y="387" width="40" height="4" rx="2" fill="#e2e8f0" />
          <text x="34" y="386" fill="#64748b" fontSize="7" fontWeight="500">Turnover</text>
          <text x="120" y="386" textAnchor="end" fill="#10b981" fontSize="8" fontWeight="700">↓ 3.2%</text>

          <rect x="34" y="400" width="40" height="4" rx="2" fill="#e2e8f0" />
          <text x="34" y="399" fill="#64748b" fontSize="7" fontWeight="500">Performance</text>
          <text x="120" y="399" textAnchor="end" fill="#1d6fa4" fontSize="8" fontWeight="700">↑ 8.7%</text>

          {/* Donut mini */}
          <circle cx="83" cy="420" r="14" fill="none" stroke="#dbeafe" strokeWidth="5" />
          <circle cx="83" cy="420" r="14" fill="none" stroke="#1d6fa4" strokeWidth="5"
            strokeDasharray="55 33" strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '83px 420px' }} />
          <circle cx="83" cy="420" r="14" fill="none" stroke="#00b4d8" strokeWidth="5"
            strokeDasharray="22 66" strokeDashoffset="-55" strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '83px 420px' }} />
          <text x="83" y="424" textAnchor="middle" fill="#1a2b4a" fontSize="7" fontWeight="700">78%</text>
        </g>

        {/* ─── Layer 7: People / HR icons (floating) ───────────── */}
        <g className="animate-float" style={{ animationDelay: '3s' }}>
          {/* Person icons cluster */}
          <circle cx="213" cy="92" r="18" fill="#e8f4fc" />
          <circle cx="213" cy="86" r="6" fill="#3b8fd4" />
          <path d="M 202 104 Q 213 96 224 104" stroke="#3b8fd4" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="233" cy="96" r="14" fill="#dbeafe" />
          <circle cx="233" cy="91" r="5" fill="#1d6fa4" />
          <path d="M 224 106 Q 233 100 242 106" stroke="#1d6fa4" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>

        {/* ─── Layer 8: Node connections (center orbital) ──────── */}
        <g opacity="0.5">
          <line x1="240" y1="168" x2="240" y2="196" stroke="#00b4d8" strokeWidth="1.5" />
          <line x1="312" y1="240" x2="284" y2="240" stroke="#00b4d8" strokeWidth="1.5" />
          <line x1="240" y1="312" x2="240" y2="284" stroke="#00b4d8" strokeWidth="1.5" />
          <line x1="168" y1="240" x2="196" y2="240" stroke="#00b4d8" strokeWidth="1.5" />
        </g>

        {/* ─── Layer 9: Arrow flow labels ───────────────────────── */}
        <g>
          <rect x="170" y="148" width="52" height="18" rx="9" fill="#1a2b4a" opacity="0.85" />
          <text x="196" y="161" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600">↓ Upload</text>

          <rect x="264" y="148" width="52" height="18" rx="9" fill="#1d6fa4" opacity="0.85" />
          <text x="290" y="161" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600">AI Parse</text>

          <rect x="264" y="310" width="60" height="18" rx="9" fill="#0077b6" opacity="0.85" />
          <text x="294" y="323" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600">Analytics</text>

          <rect x="155" y="310" width="56" height="18" rx="9" fill="#00b4d8" opacity="0.85" />
          <text x="183" y="323" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600">Insights</text>
        </g>

        {/* ─── Layer 10: Sparkle elements ───────────────────────── */}
        <g className="animate-pulse-glow" style={{ animationDelay: '0.3s' }}>
          <path d="M 452 135 L 455 128 L 458 135 L 465 138 L 458 141 L 455 148 L 452 141 L 445 138 Z"
            fill="#00b4d8" opacity="0.6" />
        </g>
        <g className="animate-pulse-glow" style={{ animationDelay: '1.8s' }}>
          <path d="M 20 200 L 22 194 L 24 200 L 30 202 L 24 204 L 22 210 L 20 204 L 14 202 Z"
            fill="#1d6fa4" opacity="0.5" />
        </g>
        <g className="animate-pulse-glow" style={{ animationDelay: '3s' }}>
          <path d="M 440 300 L 442 295 L 444 300 L 449 302 L 444 304 L 442 309 L 440 304 L 435 302 Z"
            fill="#00b4d8" opacity="0.4" />
        </g>
      </svg>
    </div>
  )
}
