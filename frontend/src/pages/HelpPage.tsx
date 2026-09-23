import React from 'react';
import { HelpCircle, Upload, Settings, BookOpen, AlertCircle, ShieldCheck, Search } from 'lucide-react';
import Sidebar from '../components/Sidebar';

export default function HelpPage() {
  return (
    <div className="min-h-screen flex font-sans relative bg-white text-slate-800">
      <Sidebar />
      <main className="flex-1 flex flex-col p-10 overflow-y-auto bg-white">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3 text-slate-900">
              <HelpCircle className="text-blue-600" size={32} />
              Help & User Guide
            </h1>
            <p className="mt-2 text-[15px] text-slate-500">
              Learn how to use HCM Document Intelligence, what files to upload, and how to configure settings.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search help articles..." 
              className="pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 bg-white text-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 max-w-5xl">
          {/* Configuration Section */}
          <div className="rounded-3xl p-8 shadow-sm bg-white border border-slate-200">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">01</span>
              <Settings size={24} className="text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900">Settings & Configuration (Start Here)</h2>
            </div>
            <div className="space-y-6">
              <p className="text-[14px] leading-relaxed text-slate-600">
                Before analyzing your user assignments, you must configure the backend intelligence via the <strong className="text-slate-900">Settings</strong> page. This provides the AI with the necessary rules and cost structures.
              </p>
              
              <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100">
                <h3 className="font-bold text-[16px] mb-3 flex items-center gap-2 text-blue-900">
                  <Upload size={18} className="text-blue-600" />
                  What to Upload in Settings
                </h3>
                <ul className="text-[14px] list-disc pl-5 space-y-3 text-slate-700">
                  <li>
                    <strong className="text-slate-900">Oracle Privileges PDF:</strong> Upload your official security reference manuals. The AI will extract and map all functional privileges to their corresponding licenses.
                  </li>
                  <li>
                    <strong className="text-slate-900">Cost Sheet PDF / Pricing Guide:</strong> Upload your organization's specific rate cards and enterprise agreements. The AI needs this to calculate precise financial impacts and overage costs.
                  </li>
                </ul>
              </div>

              <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <h3 className="font-bold text-[16px] mb-3 flex items-center gap-2 text-emerald-900">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  How to Configure AI Models
                </h3>
                <ul className="text-[14px] list-disc pl-5 space-y-3 text-slate-700">
                  <li>Navigate to <strong className="text-slate-900">Settings &gt; Model Configuration</strong>.</li>
                  <li>Select the primary AI engine (e.g., DeepSeek Chat V3 for general extraction, Reasoner R1 for complex logic).</li>
                  <li>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 text-xs font-bold border border-emerald-200">
                      DeepSeek Account Balance
                    </span> Ensure your account balance is positive to enable real-time API calls during analysis.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Main Workflows Section */}
            <div className="rounded-3xl p-8 shadow-sm bg-white border border-slate-200">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs border border-emerald-200">02</span>
                <Upload size={22} className="text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">Uploading User Data</h2>
              </div>
              <div className="space-y-4">
                <p className="text-[14px] leading-relaxed mb-4 text-slate-600">
                  Once settings are configured, go to the <strong className="text-slate-900">Uploads</strong> dashboard. You will need to upload two critical files to run the analysis:
                </p>
                <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-100">
                  <ul className="text-[14px] list-disc pl-5 space-y-2 text-slate-700">
                    <li><strong className="text-slate-900">Security Roles XLSX:</strong> The raw spreadsheet containing all active user role assignments.</li>
                    <li><strong className="text-slate-900">Active Users CSV:</strong> The master list of current employees to cross-reference against assignments.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Navigating Results Section */}
            <div className="rounded-3xl p-8 shadow-sm bg-white border border-slate-200">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs border border-indigo-200">03</span>
                <BookOpen size={22} className="text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">Reading Results</h2>
              </div>
              <div className="space-y-4 text-[14px] leading-relaxed text-slate-600">
                <p>
                  After analysis completes, you will be taken to the Results page which tiers your data:
                </p>
                <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100">
                  <ul className="list-disc pl-5 space-y-2 text-slate-700">
                    <li><strong className="text-slate-900">Services:</strong> High-level financial exposure and license counts.</li>
                    <li><strong className="text-slate-900">Privileges:</strong> Detailed view of the specific privileges causing the costs.</li>
                    <li><strong className="text-slate-900">Roles & Employees:</strong> See who has access and over-provisioning.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
