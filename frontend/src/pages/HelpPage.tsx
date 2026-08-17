import React from 'react';
import { HelpCircle, Upload, Settings, BookOpen, AlertCircle } from 'lucide-react';
import Sidebar from '../components/Sidebar';

export default function HelpPage() {
  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800 relative">
      <Sidebar />
      <main className="flex-1 flex flex-col p-10 overflow-y-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <HelpCircle className="text-blue-600" size={32} />
            Help & User Guide
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Learn how to use HCM Document Intelligence, what files to upload, and how to configure settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
          {/* Main Workflows Section */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <Upload className="text-blue-500" size={24} />
              <h2 className="text-lg font-bold text-slate-800">1. Uploading Documents</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="font-semibold text-sm mb-1 text-slate-800">Uploads Page (Main Dashboard)</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">
                  Use this page to analyze your actual user assignments and roles. You must upload two files:
                </p>
                <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
                  <li><strong>Security Roles XLSX:</strong> The spreadsheet containing your users, roles, and assignments.</li>
                  <li><strong>Active Users CSV:</strong> The CSV file with your active employee list.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Configuration Section */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <Settings className="text-indigo-500" size={24} />
              <h2 className="text-lg font-bold text-slate-800">2. Configuration & AI</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="font-semibold text-sm mb-1 text-slate-800">Settings Page</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Navigate to the Settings page via the sidebar to configure the backend logic:
                </p>
                <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Model Settings:</strong> Choose which AI models to use (e.g. DeepSeek Chat V3 vs Reasoner R1) for extraction and insights. Your account balance is also shown here.</li>
                  <li><strong>Document Configuration:</strong> Upload official <strong>Oracle Privileges PDFs</strong> and <strong>Cost Sheet PDFs</strong>. The AI will extract the structured data to power the main dashboard logic.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Navigating Results Section */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <BookOpen className="text-emerald-500" size={24} />
              <h2 className="text-lg font-bold text-slate-800">3. Reading the Results</h2>
            </div>
            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <p>
                After uploading your XLSX on the dashboard and clicking <strong>Analyse Documents</strong>, you will be taken to the Results page.
              </p>
              <p>
                The results are tiered into three levels:
              </p>
              <ul className="list-decimal pl-5 space-y-1">
                <li><strong>Services:</strong> High-level cost and license counts.</li>
                <li><strong>Privileges:</strong> Detailed view of the specific privileges causing the costs. You can request AI insights here for impact analysis.</li>
                <li><strong>Roles & Employees:</strong> See exactly who has access to what, and where you are over-provisioned.</li>
              </ul>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
              <AlertCircle className="text-orange-500" size={24} />
              <h2 className="text-lg font-bold text-slate-800">Troubleshooting</h2>
            </div>
            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>Missing Data / No Costs:</strong> If your analysis shows $0 or no services, make sure you have extracted the Privileges PDF and Cost Sheet PDF in the <strong>Settings &gt; Document Configuration</strong> tab.
              </p>
              <p>
                <strong>AI Error:</strong> Check your Model Settings tab to ensure you have selected a valid DeepSeek model and that your account balance is positive.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
