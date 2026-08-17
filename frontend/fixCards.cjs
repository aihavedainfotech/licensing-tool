const fs = require('fs');
let code = fs.readFileSync('src/pages/ResultsPage.tsx', 'utf-8');

code = code.split("boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}").join("boxShadow: '0 2px 12px rgba(0,0,0,0.04)', background: 'var(--theme-bg-card)' }}");
code = code.split("boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>").join("boxShadow: '0 2px 12px rgba(0,0,0,0.04)', background: 'var(--theme-bg-card)' }}>");

// And also replace standard rounded-2xl border
code = code.split('className=" border rounded-xl overflow-hidden"').join("className=\" border rounded-xl overflow-hidden\" style={{ background: 'var(--theme-bg-card)' }}");

// One more check for text-slate that was missed
code = code.split('text-slate-800').join('');
code = code.split('bg-slate-50').join('');
code = code.split('bg-white').join('');

fs.writeFileSync('src/pages/ResultsPage.tsx', code);
console.log('Done!');
