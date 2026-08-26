import React from 'react';
import { HelpCircle, Upload, Settings, BookOpen, AlertCircle, ShieldCheck, Search } from 'lucide-react';
import Sidebar from '../components/Sidebar';

export default function HelpPage() {
  return (
    <div className="min-h-screen flex font-sans relative" style={{ backgroundColor: '#faf8f5', color: '#31231a' }}>
      <Sidebar />
      <main className="flex-1 flex flex-col p-10 overflow-y-auto">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3" style={{ color: '#31231a' }}>
              <HelpCircle style={{ color: '#ba6017' }} size={32} />
              Help & User Guide
            </h1>
            <p className="mt-2 text-[15px]" style={{ color: '#6d5f53' }}>
              Learn how to use HCM Document Intelligence, what files to upload, and how to configure settings.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search help articles..." 
              className="pl-9 pr-4 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-64"
              style={{ backgroundColor: '#ffffff', borderColor: '#efebe4', color: '#31231a' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 max-w-5xl">
          {/* Configuration Section */}
          <div className="rounded-3xl p-8 shadow-sm" style={{ backgroundColor: '#ffffff', border: '1px solid #efebe4' }}>
            <div className="flex items-center gap-3 mb-6 border-b pb-4" style={{ borderColor: '#efebe4' }}>
              <Settings size={28} style={{ color: '#ba6017' }} />
              <h2 className="text-xl font-bold" style={{ color: '#31231a' }}>1. Settings & Configuration (Start Here)</h2>
            </div>
            <div className="space-y-6">
              <p className="text-[14px] leading-relaxed" style={{ color: '#6d5f53' }}>
                Before analyzing your user assignments, you must configure the backend intelligence via the <strong>Settings</strong> page. This provides the AI with the necessary rules and cost structures.
              </p>
              
              <div className="p-6 rounded-2xl" style={{ backgroundColor: '#faf8f5', border: '1px solid #efebe4' }}>
                <h3 className="font-bold text-[16px] mb-3 flex items-center gap-2">
                  <Upload size={18} style={{ color: '#d47e3b' }} />
                  What to Upload in Settings
                </h3>
                <ul className="text-[14px] list-disc pl-5 space-y-3" style={{ color: '#6d5f53' }}>
                  <li>
                    <strong style={{ color: '#31231a' }}>Oracle Privileges PDF:</strong> Upload your official security reference manuals. The AI will extract and map all functional privileges to their corresponding licenses.
                  </li>
                  <li>
                    <strong style={{ color: '#31231a' }}>Cost Sheet PDF / Pricing Guide:</strong> Upload your organization's specific rate cards and enterprise agreements. The AI needs this to calculate precise financial impacts and overage costs.
                  </li>
                </ul>
              </div>

              <div className="p-6 rounded-2xl" style={{ backgroundColor: '#faf8f5', border: '1px solid #efebe4' }}>
                <h3 className="font-bold text-[16px] mb-3 flex items-center gap-2">
                  <ShieldCheck size={18} style={{ color: '#d47e3b' }} />
                  How to Configure AI Models
                </h3>
                <ul className="text-[14px] list-disc pl-5 space-y-3" style={{ color: '#6d5f53' }}>
                  <li>Navigate to <strong>Settings &gt; Model Configuration</strong>.</li>
                  <li>Select the primary AI engine (e.g., DeepSeek Chat V3 for general extraction, Reasoner R1 for complex logic).</li>
                  <li>Ensure your account balance is positive to enable real-time API calls during analysis.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Main Workflows Section */}
            <div className="rounded-3xl p-8 shadow-sm" style={{ backgroundColor: '#ffffff', border: '1px solid #efebe4' }}>
              <div className="flex items-center gap-3 mb-6 border-b pb-4" style={{ borderColor: '#efebe4' }}>
                <Upload size={24} style={{ color: '#ba6017' }} />
                <h2 className="text-lg font-bold" style={{ color: '#31231a' }}>2. Uploading User Data</h2>
              </div>
              <div className="space-y-4">
                <p className="text-[14px] leading-relaxed mb-4" style={{ color: '#6d5f53' }}>
                  Once settings are configured, go to the <strong>Uploads</strong> dashboard. You will need to upload two critical files to run the analysis:
                </p>
                <div className="p-5 rounded-2xl" style={{ backgroundColor: '#faf8f5', border: '1px solid #efebe4' }}>
                  <ul className="text-[14px] list-disc pl-5 space-y-2" style={{ color: '#6d5f53' }}>
                    <li><strong style={{ color: '#31231a' }}>Security Roles XLSX:</strong> The raw spreadsheet containing all active user role assignments.</li>
                    <li><strong style={{ color: '#31231a' }}>Active Users CSV:</strong> The master list of current employees to cross-reference against assignments.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Navigating Results Section */}
            <div className="rounded-3xl p-8 shadow-sm" style={{ backgroundColor: '#ffffff', border: '1px solid #efebe4' }}>
              <div className="flex items-center gap-3 mb-6 border-b pb-4" style={{ borderColor: '#efebe4' }}>
                <BookOpen size={24} style={{ color: '#ba6017' }} />
                <h2 className="text-lg font-bold" style={{ color: '#31231a' }}>3. Reading Results</h2>
              </div>
              <div className="space-y-4 text-[14px] leading-relaxed" style={{ color: '#6d5f53' }}>
                <p>
                  After analysis completes, you will be taken to the Results page which tiers your data:
                </p>
                <ul className="list-decimal pl-5 space-y-2">
                  <li><strong style={{ color: '#31231a' }}>Services:</strong> High-level financial exposure and license counts.</li>
                  <li><strong style={{ color: '#31231a' }}>Privileges:</strong> Detailed view of the specific privileges causing the costs.</li>
                  <li><strong style={{ color: '#31231a' }}>Roles & Employees:</strong> See exactly who has access to what, and where you are over-provisioned.</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
