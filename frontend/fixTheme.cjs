const fs = require('fs');

// 1. Update index.css for theme-dark
let css = fs.readFileSync('src/index.css', 'utf-8');
css = css.replace(/body\.theme-dark \{[\s\S]*?\}/, `body.theme-dark {
  --theme-bg-page: #000000;
  --theme-bg-card: #111111;
  --theme-bg-hover: #1f1f1f;
  --theme-border: #f97316;
  --theme-text-main: #f97316;
  --theme-text-muted: #fdba74;
  --theme-text-light: #ea580c;
  --theme-blue-bg: rgba(249, 115, 22, 0.15);
  --theme-blue-text: #f97316;
  --theme-green-bg: rgba(249, 115, 22, 0.15);
  --theme-green-text: #fdba74;
  --theme-purple-bg: rgba(249, 115, 22, 0.15);
  --theme-purple-text: #ea580c;
}`);
fs.writeFileSync('src/index.css', css);

// 2. Remove bg-white from ResultsPage.tsx
let tsx = fs.readFileSync('src/pages/ResultsPage.tsx', 'utf-8');
tsx = tsx.replace(/bg-white/g, '');

// Apply background to cards
tsx = tsx.replace(/boxShadow: '0 2px 12px rgba\\(0,0,0,0\\.04\\)' }}/g, 
  "boxShadow: '0 2px 12px rgba(0,0,0,0.04)', background: 'var(--theme-bg-card)' }}");

// Add background to input search
tsx = tsx.replace(/className=\"w-full pl-9 pr-4 py-2\.5 rounded-xl text-sm border  outline-none\" style={{ borderColor: 'var\\(--theme-border\\)', color: 'var\\(--theme-text-main\\)' }}/g,
  "className=\"w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none\" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-main)', background: 'var(--theme-bg-card)' }}");

// Also add background to any container that was missed (like the table card)
tsx = tsx.replace(/className=\"rounded-2xl border  overflow-hidden\"/g, 
  "className=\"rounded-2xl border overflow-hidden\" style={{ background: 'var(--theme-bg-card)' }}");

// And another one inside PrivilegesView
tsx = tsx.replace(/className=\"border rounded-2xl overflow-hidden \"/g,
  "className=\"border rounded-2xl overflow-hidden\" style={{ background: 'var(--theme-bg-card)' }}");
  
// Replace `text-gray-900`, `text-gray-600` if any just in case
tsx = tsx.replace(/text-gray-900/g, "");
tsx = tsx.replace(/text-slate-800/g, "");

fs.writeFileSync('src/pages/ResultsPage.tsx', tsx);
console.log('Fixed bg-white and updated dark theme to orange/black');
