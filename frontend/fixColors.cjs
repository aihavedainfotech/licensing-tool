const fs = require('fs');
let code = fs.readFileSync('src/pages/ResultsPage.tsx', 'utf-8');

// Replace #64748b (slate-500)
code = code.replace(/color: '#64748b'/g, "color: 'var(--theme-text-muted)'");

// Replace #334155 (slate-700)
code = code.replace(/color: '#334155'/g, "color: 'var(--theme-text-main)'");

// Replace #475569 (slate-600)
code = code.replace(/color: '#475569'/g, "color: 'var(--theme-text-muted)'");

// Replace #1d6fa4 (brand blue) in some places where it's used as text color
code = code.replace(/color: '#1d6fa4'/g, "color: 'var(--theme-blue-text)'");
code = code.replace(/background: '#eff6ff'/g, "background: 'var(--theme-blue-bg)'");
code = code.replace(/background: '#dbeafe'/g, "background: 'var(--theme-blue-bg)'");
code = code.replace(/borderColor: '#dbeafe'/g, "borderColor: 'var(--theme-blue-bg)'");

// Remove hardcoded tailwind bg colors that conflict with dark mode
code = code.replace(/className="bg-slate-50 border-b"/g, 'className="border-b"');

// Replace the hardcoded linear gradient header bg that was missed:
code = code.replace(/background: 'linear-gradient\\(90deg, #f8fafc, #ffffff\\)'/g, "background: 'var(--theme-bg-card)'");

fs.writeFileSync('src/pages/ResultsPage.tsx', code);
console.log('ResultsPage.tsx text colors updated successfully');
