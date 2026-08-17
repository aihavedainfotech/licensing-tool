import React, { useState } from 'react';
import { LayoutTemplate, BookOpen, ChevronLeft, ChevronRight, X, Maximize2, Download, CheckCircle2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useTemplate } from '../context/TemplateContext';

// Mock data to render in the templates
const MOCK_DATA = {
  title: "Oracle HCM Intelligence Report",
  date: new Date().toLocaleDateString(),
  services: [
    { name: "HCM Cloud Core HR", cost: 12500, roles: 4, users: 150 },
    { name: "Payroll Processing", cost: 8400, roles: 2, users: 150 },
    { name: "Talent Management", cost: 5600, roles: 3, users: 120 },
    { name: "Benefits Administration", cost: 4200, roles: 2, users: 150 },
    { name: "Time and Labor", cost: 3800, roles: 1, users: 140 },
    { name: "Recruiting Cloud", cost: 6500, roles: 3, users: 15 },
  ],
  totalCost: 41000
};

const TEMPLATES = [
  { id: 't1', name: 'Executive Summary Book', type: 'book', color: 'bg-blue-600', desc: 'A sophisticated 2-page spread book layout for C-level executives.' },
  { id: 't2', name: 'Standard A4 Pages', type: 'pages', color: 'bg-emerald-600', desc: 'A clean, paginated A4 format perfect for printing.' },
  { id: 't3', name: 'Dark Mode Analytics', type: 'single', color: 'bg-slate-900', desc: 'A sleek, dark-themed dashboard style report.' },
  { id: 't4', name: 'Financial Breakdown', type: 'single', color: 'bg-indigo-600', desc: 'Heavy focus on cost metrics, ROI, and tables.' },
  { id: 't5', name: 'Minimalist Data Sheet', type: 'pages', color: 'bg-slate-400', desc: 'Stripped down, distraction-free data presentation.' },
  { id: 't6', name: 'Two-Column Academic', type: 'pages', color: 'bg-stone-700', desc: 'Classic double column layout used in research papers.' },
  { id: 't7', name: 'Enterprise Dashboard', type: 'single', color: 'bg-cyan-600', desc: 'Widget-based layout summarizing key metrics.' },
  { id: 't8', name: 'Role Assignment Roster', type: 'pages', color: 'bg-purple-600', desc: 'Organized by employee and role mappings.' },
  { id: 't9', name: 'Cost vs Budget', type: 'book', color: 'bg-rose-600', desc: 'A side-by-side comparison book layout for finance.' },
  { id: 't10', name: 'License Optimization', type: 'single', color: 'bg-amber-500', desc: 'Highlights redundant licenses and cost savings.' },
  { id: 't11', name: 'Clean Invoice', type: 'pages', color: 'bg-teal-600', desc: 'Standard billing and invoice layout.' },
  { id: 't12', name: 'Compliance Report', type: 'book', color: 'bg-slate-700', desc: 'Thorough, paginated book format for compliance audits.' },
];

export default function TemplatesPage() {
  const [activeTemplate, setActiveTemplate] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const { activeTemplateId, setActiveTemplateId } = useTemplate();

  // Pagination logic
  const totalPages = 4; // Mock 4 pages of content
  
  const handleNext = () => {
    if (currentPage < totalPages - 1) setCurrentPage(c => c + 1);
  };
  
  const handlePrev = () => {
    if (currentPage > 0) setCurrentPage(c => c - 1);
  };

  // The actual rendered template based on type
  const renderTemplateContent = () => {
    if (!activeTemplate) return null;

    if (activeTemplate.type === 'book') {
      return (
        <div className="flex gap-4 w-full max-w-5xl mx-auto h-[600px]">
          {/* Left Page */}
          <div className="flex-1 bg-white shadow-2xl rounded-l-lg p-12 border-r border-slate-200 relative">
            <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-black/10 to-transparent pointer-events-none"></div>
            <h1 className="text-3xl font-serif text-slate-800 mb-6 border-b pb-4">{MOCK_DATA.title}</h1>
            <p className="text-slate-500 mb-8 italic">Page {currentPage * 2 + 1}</p>
            
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-700">Cost Summary</h2>
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500 uppercase tracking-wider mb-1">Total Estimated Monthly Cost</p>
                <p className="text-4xl font-light text-blue-600">${MOCK_DATA.totalCost.toLocaleString()}</p>
              </div>
              <p className="text-slate-600 leading-relaxed">
                This book layout demonstrates how your extracted Privileges and Cost Sheet data can be presented in a professional 2-page spread for executive meetings.
              </p>
            </div>
          </div>
          
          {/* Right Page */}
          <div className="flex-1 bg-white shadow-2xl rounded-r-lg p-12 relative">
             <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-black/5 to-transparent pointer-events-none"></div>
             <p className="text-slate-500 mb-8 italic text-right">Page {currentPage * 2 + 2}</p>
             <h2 className="text-xl font-bold text-slate-700 mb-6">Service Breakdown</h2>
             
             <div className="space-y-4">
                {MOCK_DATA.services.slice(0, 4).map((s, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-semibold text-slate-800">{s.name}</h4>
                      <p className="text-xs text-slate-500">{s.roles} Roles mapped</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-slate-700 font-medium">${s.cost.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      );
    }

    if (activeTemplate.type === 'pages') {
      return (
        <div className="bg-white max-w-3xl mx-auto w-full shadow-xl min-h-[800px] p-16">
          <header className="flex justify-between items-end border-b-2 border-slate-800 pb-6 mb-10">
             <div>
               <h1 className="text-3xl font-bold text-slate-900">{MOCK_DATA.title}</h1>
               <p className="text-slate-500 mt-2">{activeTemplate.name} Format</p>
             </div>
             <div className="text-right">
                <p className="font-mono text-sm text-slate-600">Date: {MOCK_DATA.date}</p>
                <p className="font-mono text-sm text-slate-600">Page: {currentPage + 1} of {totalPages}</p>
             </div>
          </header>
          
          <main>
             <table className="w-full text-left">
               <thead>
                 <tr className="bg-slate-100">
                   <th className="p-3 font-semibold text-slate-700">Service Name</th>
                   <th className="p-3 font-semibold text-slate-700">Users</th>
                   <th className="p-3 font-semibold text-slate-700 text-right">Cost</th>
                 </tr>
               </thead>
               <tbody>
                  {MOCK_DATA.services.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="p-3 text-slate-800">{s.name}</td>
                      <td className="p-3 text-slate-600">{s.users}</td>
                      <td className="p-3 text-slate-800 text-right font-mono">${s.cost.toLocaleString()}</td>
                    </tr>
                  ))}
               </tbody>
             </table>
          </main>
        </div>
      );
    }

    // Default single page layout
    return (
       <div className={`w-full max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl ${activeTemplate.color.includes('slate-900') ? 'bg-slate-900 text-white' : 'bg-white'}`}>
         <div className={`${activeTemplate.color} p-10 text-white`}>
            <h1 className="text-4xl font-bold mb-2">{MOCK_DATA.title}</h1>
            <p className="opacity-80 text-lg">{activeTemplate.name}</p>
         </div>
         <div className="p-10">
            <h2 className="text-2xl font-semibold mb-6">Output Data Preview</h2>
            <div className="grid grid-cols-2 gap-6">
              {MOCK_DATA.services.map((s, i) => (
                <div key={i} className={`p-5 rounded-xl border ${activeTemplate.color.includes('slate-900') ? 'border-slate-800 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}>
                   <h3 className="font-bold text-lg mb-1">{s.name}</h3>
                   <div className="flex justify-between items-center mt-4">
                     <span className="opacity-70 text-sm">{s.roles} Roles</span>
                     <span className="text-xl font-mono">${s.cost.toLocaleString()}</span>
                   </div>
                </div>
              ))}
            </div>
         </div>
       </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800 relative">
      <Sidebar />
      <main className="flex-1 flex flex-col p-10 overflow-y-auto">
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <LayoutTemplate className="text-blue-600" size={32} />
            Output Templates
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Select a beautiful layout to render your extracted AI data into a professional report.</p>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
          {TEMPLATES.map((tpl) => (
            <div 
              key={tpl.id}
              onClick={() => { setActiveTemplate(tpl); setCurrentPage(0); }}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group flex flex-col h-64"
            >
               {/* Thumbnail Mock */}
               <div className={`w-full flex-1 rounded-xl mb-4 ${tpl.color} opacity-80 group-hover:opacity-100 transition-opacity relative overflow-hidden flex items-center justify-center`}>
                 {tpl.type === 'book' && <BookOpen size={48} className="text-white/50" />}
                 {tpl.type === 'pages' && <LayoutTemplate size={48} className="text-white/50" />}
                 {tpl.type === 'single' && <Maximize2 size={48} className="text-white/50" />}
                 
                 {/* Decorative elements for thumbnail */}
                 <div className="absolute top-4 left-4 right-4 h-2 bg-white/20 rounded-full"></div>
                 <div className="absolute top-8 left-4 right-12 h-2 bg-white/20 rounded-full"></div>
               </div>
               
               <div>
                   <h3 className="font-bold text-slate-800 text-[15px] leading-tight">{tpl.name}</h3>
                   <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tpl.desc}</p>
                   <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {tpl.type}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTemplateId(tpl.id);
                        }}
                        className={`text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded transition-colors ${
                          activeTemplateId === tpl.id 
                            ? 'bg-green-100 text-green-700 border border-green-300' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {activeTemplateId === tpl.id ? (
                          <span className="flex items-center gap-1"><CheckCircle2 size={12} /> Applied</span>
                        ) : 'Apply'}
                      </button>
                   </div>
                 </div>
            </div>
          ))}
        </div>
      </main>

      {/* Viewer Modal */}
      {activeTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col backdrop-blur-sm animate-fade-in">
          {/* Toolbar */}
          <div className="h-16 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-900 text-white shrink-0">
             <div className="flex items-center gap-4">
               <span className="font-bold">{activeTemplate.name}</span>
               <span className="px-2 py-0.5 text-xs bg-slate-800 rounded text-slate-400 uppercase tracking-wider">{activeTemplate.type} Layout</span>
             </div>
             
             <div className="flex items-center gap-4">
               <button className="flex items-center gap-2 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium">
                 <Download size={16} /> Export PDF
               </button>
               <button onClick={() => setActiveTemplate(null)} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors">
                 <X size={20} />
               </button>
             </div>
          </div>
          
          {/* Canvas Wrapper */}
          <div className="flex-1 overflow-y-auto p-12 flex items-center justify-center relative">
             
             {/* Rendered Template injected with Data */}
             {renderTemplateContent()}

          </div>

          {/* Pagination Controls (Only show if type is book or pages) */}
          {(activeTemplate.type === 'book' || activeTemplate.type === 'pages') && (
            <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-8 shrink-0">
               <button 
                 onClick={handlePrev} 
                 disabled={currentPage === 0}
                 className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 rounded-lg text-white font-medium transition-colors"
               >
                 <ChevronLeft size={18} /> Previous Page
               </button>
               
               <span className="text-slate-400 font-mono text-sm">
                 {currentPage + 1} / {activeTemplate.type === 'book' ? totalPages / 2 : totalPages}
               </span>
               
               <button 
                 onClick={handleNext} 
                 disabled={currentPage >= (activeTemplate.type === 'book' ? (totalPages/2)-1 : totalPages-1)}
                 className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
               >
                 Next Page <ChevronRight size={18} />
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
