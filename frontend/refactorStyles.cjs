const fs = require('fs');
let code = fs.readFileSync('src/pages/ResultsPage.tsx', 'utf-8');

// Replace standard card style
code = code.replace(/style={{ color: '#1a2b4a', background: 'white', border: '1px solid #e2e8f0' }}/g, 
  "style={{ color: 'var(--theme-text-main)', background: 'var(--theme-bg-card)', border: '1px solid var(--theme-border)' }}");

// Replace standard card style with boxShadow
code = code.replace(/style={{ borderColor: '#e2e8f0', boxShadow: '0 2px 12px rgba\\(0,0,0,0\\.04\\)' }}/g, 
  "style={{ borderColor: 'var(--theme-border)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', background: 'var(--theme-bg-card)' }}");

// Replace #1a2b4a text
code = code.replace(/color: '#1a2b4a'/g, "color: 'var(--theme-text-main)'");

// Replace #94a3b8 text
code = code.replace(/color: '#94a3b8'/g, "color: 'var(--theme-text-muted)'");

// Replace #cbd5e1 text
code = code.replace(/color: '#cbd5e1'/g, "color: 'var(--theme-text-light)'");

// Replace #f8fafc bg
code = code.replace(/background: '#f8fafc'/g, "background: 'var(--theme-bg-page)'");
code = code.replace(/backgroundColor: '#f8fafc'/g, "backgroundColor: 'var(--theme-bg-page)'");

// Replace #ffffff bg
code = code.replace(/background: '#ffffff'/g, "background: 'var(--theme-bg-card)'");
code = code.replace(/background: 'white'/g, "background: 'var(--theme-bg-card)'");

// Replace #e2e8f0 border
code = code.replace(/borderColor: '#e2e8f0'/g, "borderColor: 'var(--theme-border)'");
code = code.replace(/border: '1px solid #e2e8f0'/g, "border: '1px solid var(--theme-border)'");
code = code.replace(/borderBottom: '1px solid #e2e8f0'/g, "borderBottom: '1px solid var(--theme-border)'");

// Replace #f1f5f9
code = code.replace(/background: '#f1f5f9'/g, "background: 'var(--theme-bg-hover)'");

// Colored badges
code = code.replace(/bg: '#eff6ff', fg: '#2563eb'/g, "bg: 'var(--theme-blue-bg)', fg: 'var(--theme-blue-text)'");
code = code.replace(/bg: '#f0fdf4', fg: '#059669'/g, "bg: 'var(--theme-green-bg)', fg: 'var(--theme-green-text)'");
code = code.replace(/bg: '#faf5ff', fg: '#7c3aed'/g, "bg: 'var(--theme-purple-bg)', fg: 'var(--theme-purple-text)'");

// Also inject the wrapper layout
code = code.replace(
  /export default function ResultsPage\(\) \{/, 
  "import { useTemplate } from '../context/TemplateContext';\n\nexport default function ResultsPage() {"
);

code = code.replace(
  /return \(\n    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800 relative">/,
  "const { activeTemplateId } = useTemplate();\n\n  return (\n    <div className={`min-h-screen flex font-sans relative results-page-wrapper layout-${activeTemplateId}`}>"
);

fs.writeFileSync('src/pages/ResultsPage.tsx', code);
console.log('ResultsPage.tsx updated successfully');
