import React, { useState, useEffect } from 'react';
import { Info, CheckCircle2, UploadCloud, Trash2, Save, FileText, Loader2, AlertCircle, Settings, BookOpen, ShieldCheck, Cpu } from 'lucide-react';
import Sidebar from '../components/Sidebar';

interface PrivilegeConfig {
  service_code: string;
  service_name: string;
  content: string;
  privileges: string[];
}

interface CostConfig {
  partNumber: string;
  serviceName: string;
  cost: number;
}

export default function ConfigUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<PrivilegeConfig[] | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [existingConfig, setExistingConfig] = useState<PrivilegeConfig[] | null>(null);
  const [jobProgress, setJobProgress] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<'models' | 'documents'>('models');

  const [modelExtract, setModelExtract] = useState('deepseek-chat');
  const [modelInsight, setModelInsight] = useState('deepseek-chat');
  const [modelSuggest, setModelSuggest] = useState('deepseek-chat');
  const [accountBalance, setAccountBalance] = useState<any | null>(null);

  const [costSheetFile, setCostSheetFile] = useState<File | null>(null);
  const [isUploadingCostSheet, setIsUploadingCostSheet] = useState(false);
  const [existingCostSheet, setExistingCostSheet] = useState<boolean>(false);
  const [isDeletingCostSheet, setIsDeletingCostSheet] = useState(false);
  const [extractedCostData, setExtractedCostData] = useState<CostConfig[] | null>(null);
  const [costJobProgress, setCostJobProgress] = useState<string>('');

  useEffect(() => {
    // Load existing config on mount
    fetch('http://localhost:3001/api/settings/privileges')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Config not found');
      })
      .then(data => {
        setExistingConfig(data);
      })
      .catch(() => {
        // Not found, ignore
      });

    // Load model preferences
    setModelExtract(localStorage.getItem('modelExtract') || 'deepseek-chat');
    setModelInsight(localStorage.getItem('modelInsight') || 'deepseek-chat');
    setModelSuggest(localStorage.getItem('modelSuggest') || 'deepseek-chat');

    // Load account balance
    fetch('http://localhost:3001/api/settings/balance')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.is_available) setAccountBalance(data);
      })
      .catch(() => {});

    // Load cost sheet status
    fetch('http://localhost:3001/api/settings/costsheet')
      .then(res => {
        if (res.ok) {
          res.json().then(data => setExistingCostSheet(data.exists));
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleCostSheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCostSheetFile(e.target.files[0]);
    }
  };

  const handleExtractCostSheet = async () => {
    if (!costSheetFile) return;

    setIsUploadingCostSheet(true);
    const formData = new FormData();
    formData.append('file', costSheetFile);
    formData.append('model', modelExtract);

    try {
      const response = await fetch('http://localhost:3001/api/settings/costsheet/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start extraction');
      }

      const data = await response.json();
      const jobId = data.jobId;

      setCostJobProgress('Initializing...');

      const pollTimer = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://localhost:3001/api/settings/costsheet/extract/status/${jobId}`);
          if (!statusRes.ok) throw new Error('Failed to fetch job status');
          
          const job = await statusRes.json();
          setCostJobProgress(job.progress || 'Processing...');

          if (job.status === 'completed') {
            clearInterval(pollTimer);
            setExtractedCostData(job.costs);
            setIsUploadingCostSheet(false);
            setCostJobProgress('');
            
            let usageMsg = '';
            if (job.usage && job.usage.total_tokens > 0) {
              usageMsg = ` (Used ${job.usage.total_tokens} tokens)`;
            }
            showToast(`Extraction successful!${usageMsg} Please review the data below.`);
          } else if (job.status === 'error') {
            clearInterval(pollTimer);
            setIsUploadingCostSheet(false);
            setCostJobProgress('');
            showToast(job.error || 'Extraction failed', 'error');
          }
        } catch (err) {
          console.error(err);
        }
      }, 3000);

    } catch (err: any) {
      setIsUploadingCostSheet(false);
      setCostJobProgress('');
      showToast(err.message || 'Extraction failed', 'error');
    }
  };

  const handleSaveCostSheetData = async () => {
    if (!extractedCostData) return;
    setIsUploadingCostSheet(true);
    try {
      const response = await fetch('http://localhost:3001/api/settings/costsheet/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractedCostData),
      });

      if (!response.ok) throw new Error('Failed to save configuration');
      
      setExistingCostSheet(true);
      setExtractedCostData(null);
      setCostSheetFile(null);
      showToast('Global Cost Sheet successfully saved!');
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error');
    } finally {
      setIsUploadingCostSheet(false);
    }
  };

  const handleDeleteCostSheet = async () => {
    if (!window.confirm('Are you sure you want to delete the Cost Sheet configuration?')) return;
    setIsDeletingCostSheet(true);
    try {
      const response = await fetch('http://localhost:3001/api/settings/costsheet', { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setExistingCostSheet(false);
      showToast('Cost Sheet config deleted successfully');
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    } finally {
      setIsDeletingCostSheet(false);
    }
  };

  const handleExtract = async () => {
    if (!file) return;

    setIsExtracting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', modelExtract);

    try {
      const response = await fetch('http://localhost:3001/api/settings/privileges/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start extraction');
      }

      const data = await response.json();
      const jobId = data.jobId;

      setJobProgress('Initializing...');

      const pollTimer = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://localhost:3001/api/settings/privileges/extract/status/${jobId}`);
          if (!statusRes.ok) throw new Error('Failed to fetch job status');
          
          const job = await statusRes.json();
          setJobProgress(job.progress || 'Processing...');

          if (job.status === 'completed') {
            clearInterval(pollTimer);
            setExtractedData(job.services);
            setIsExtracting(false);
            setJobProgress('');
            
            let usageMsg = '';
            if (job.usage && job.usage.total_tokens > 0) {
              usageMsg = ` (Used ${job.usage.total_tokens} tokens)`;
            }
            showToast(`Extraction successful!${usageMsg} Please review the data below.`);
          } else if (job.status === 'error') {
            clearInterval(pollTimer);
            setIsExtracting(false);
            setJobProgress('');
            showToast(job.error || 'Extraction failed', 'error');
          }
        } catch (err) {
          console.error(err);
          // Keep polling, might be a temporary network blip
        }
      }, 3000);

    } catch (err: any) {
      setIsExtracting(false);
      setJobProgress('');
      showToast(err.message || 'Extraction failed', 'error');
    }
  };

  const handleSaveToS3 = async () => {
    if (!extractedData) return;

    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:3001/api/settings/privileges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractedData),
      });

      if (!response.ok) {
        throw new Error('Failed to save to S3');
      }

      setExistingConfig(extractedData);
      setExtractedData(null);
      setFile(null);
      showToast('Configuration successfully saved to Database (S3).');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!confirm('Are you sure you want to delete the configuration from S3?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch('http://localhost:3001/api/settings/privileges', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete config');
      }

      setExistingConfig(null);
      showToast('Configuration deleted from S3.');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModelChange = (task: 'extract' | 'insight' | 'suggest', model: string) => {
    if (task === 'extract') {
      setModelExtract(model);
      localStorage.setItem('modelExtract', model);
    } else if (task === 'insight') {
      setModelInsight(model);
      localStorage.setItem('modelInsight', model);
    } else if (task === 'suggest') {
      setModelSuggest(model);
      localStorage.setItem('modelSuggest', model);
    }
    showToast(`Model updated for ${task}`);
  };

  return (
    <div className="min-h-screen flex bg-white font-sans text-slate-800">
      <Sidebar />
      <main className="flex-1 flex flex-col px-4 sm:px-12 py-10 overflow-y-auto bg-white">
        
        {/* Top Banner */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Cpu size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Document Configuration Hub</h1>
              <p className="text-sm text-slate-500 mt-1">Upload Oracle documents to configure privileges and extract service costs using AI.</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-700 bg-white border border-slate-100 px-6 py-3 rounded-full shadow-sm">
            <div className="flex items-center gap-2"><Settings size={14} className="text-blue-600"/> AI-Powered Extraction</div>
            <div className="w-px h-4 bg-slate-200"></div>
            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-blue-600"/> Zero Manual Data Entry</div>
            <div className="w-px h-4 bg-slate-200"></div>
            <div className="flex items-center gap-2"><BookOpen size={14} className="text-blue-600"/> Accurate Cost Mapping</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-6 border-b border-slate-200 mb-8">
          <button 
            onClick={() => setActiveTab('models')}
            className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'models' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Model Settings
            {activeTab === 'models' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('documents')}
            className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'documents' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Document Configuration
            {activeTab === 'documents' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
        </div>

        {/* AI & Model Configuration */}
        {activeTab === 'models' && (
        <div className="mb-12 animate-fade-in">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Cpu size={20} className="text-indigo-600" />
            AI & Model Configuration
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Task 1: Extraction */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 mb-1">PDF Extraction Model</h3>
              <p className="text-[11px] text-slate-500 mb-4">Parsing large documents</p>
              <select 
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:border-blue-500 outline-none"
                value={modelExtract}
                onChange={(e) => handleModelChange('extract', e.target.value)}
              >
                <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
              </select>
            </div>
            
            {/* Task 2: Data Insights */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 mb-1">Data Insights Model</h3>
              <p className="text-[11px] text-slate-500 mb-4">Summarizing dashboards</p>
              <select 
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:border-blue-500 outline-none"
                value={modelInsight}
                onChange={(e) => handleModelChange('insight', e.target.value)}
              >
                <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
              </select>
            </div>
            
            {/* Task 3: Privilege Suggestions */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 mb-1">Impact Analysis Model</h3>
              <p className="text-[11px] text-slate-500 mb-4">Evaluating removals</p>
              <select 
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:border-blue-500 outline-none"
                value={modelSuggest}
                onChange={(e) => handleModelChange('suggest', e.target.value)}
              >
                <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
              </select>
            </div>
          </div>
          
          {/* Account Balance */}
          {accountBalance && accountBalance.balance_infos && accountBalance.balance_infos.length > 0 && (
             <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                <span className="text-emerald-700 font-medium text-xs">DeepSeek Account Balance:</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  {accountBalance.balance_infos[0].total_balance} {accountBalance.balance_infos[0].currency}
                </span>
             </div>
          )}
        </div>
        )}

        {/* Privileges Config */}
        {activeTab === 'documents' && (
        <div className="animate-fade-in">
        <div className="flex gap-8 mb-16">
          {/* Left Col - Steps */}
          <div className="w-48 relative flex-shrink-0 pt-2">
            <div className="absolute left-[15px] top-8 bottom-8 w-px border-l border-dashed border-slate-200"></div>
            <div className="flex gap-4 relative mb-12">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold z-10 shadow-sm shadow-blue-200">01</div>
              <div>
                <h4 className="text-[13px] font-bold text-blue-700">Upload Document</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Upload the official<br/>Oracle Privileges PDF.</p>
              </div>
            </div>
            <div className="flex gap-4 relative mb-12">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center z-10"><Settings size={14}/></div>
              <div>
                <h4 className="text-[13px] font-bold text-slate-800">AI Processing</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Our AI extracts all<br/>privileges and services.</p>
              </div>
            </div>
            <div className="flex gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center z-10"><CheckCircle2 size={14}/></div>
              <div>
                <h4 className="text-[13px] font-bold text-slate-800">Configuration Ready</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Review and confirm<br/>the extracted data.</p>
              </div>
            </div>
          </div>

          {/* Middle Col - Main Upload */}
          <div className="flex-1 max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-blue-600"><BookOpen size={24} /></div>
              <div>
                <h2 className="text-[19px] font-bold text-slate-900">Privileges Configuration</h2>
                <p className="text-xs text-slate-500 mt-1">Upload the Oracle Fusion Services Privileges PDF to extract and configure costed privileges using AI.</p>
              </div>
            </div>

            {/* Status Banner */}
            <div className={`flex items-center justify-between p-4 rounded-xl border mb-6 ${existingConfig ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${existingConfig ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                   {existingConfig ? <CheckCircle2 size={16} strokeWidth={3} /> : <AlertCircle size={16} />}
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-slate-900">Current Configuration Status</h3>
                  <p className="text-[12px] text-slate-600 mt-0.5">{existingConfig ? `Active configuration loaded with ${existingConfig.length} services.` : 'No active configuration loaded.'}</p>
                </div>
              </div>
              {existingConfig && (
                <button onClick={handleDeleteConfig} disabled={isDeleting} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-red-600 border border-red-200 bg-white rounded-lg hover:bg-red-50 transition-colors">
                   {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete Configuration
                </button>
              )}
            </div>

            {/* Upload Box */}
            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center mb-6 relative overflow-hidden bg-white shadow-sm">
              <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 flex items-center justify-center rounded-2xl mb-4 relative">
                <FileText size={28} />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center border-[3px] border-white"><UploadCloud size={14}/></div>
              </div>
              <h3 className="text-[17px] font-bold text-slate-900 mb-2">Upload Oracle Privileges PDF</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-8 leading-relaxed">Select the official Oracle privileges documentation. Our AI will read the PDF and extract the structured data automatically.</p>
              
              <div className="flex flex-col items-center gap-3">
                <label className="cursor-pointer flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm w-56">
                  <UploadCloud size={16}/> {file ? 'Change PDF File' : 'Choose PDF File'}
                  <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                </label>
                
                {file && (
                   <div className="flex flex-col items-center gap-3 mt-4 w-full">
                     <span className="text-sm text-slate-600 font-medium">{file.name}</span>
                     <button
                        onClick={handleExtract}
                        disabled={isExtracting}
                        className="flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm shadow-sm w-56"
                      >
                        {isExtracting ? <><Loader2 size={16} className="animate-spin" /> Extracting...</> : <><Settings size={16} /> Extract with AI</>}
                      </button>
                   </div>
                )}
                {isExtracting && jobProgress && (
                   <div className="mt-3 text-[13px] font-bold text-blue-600 flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                     <Loader2 size={14} className="animate-spin"/> {jobProgress}
                   </div>
                )}
              </div>
            </div>

            {/* Bottom mini cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                <div className="text-blue-600 bg-blue-50 p-2 rounded-lg"><FileText size={16}/></div>
                <div><h4 className="text-[11px] font-bold text-slate-900">Supported format</h4><p className="text-[10px] text-slate-500 mt-0.5">PDF only</p></div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                <div className="text-blue-600 bg-blue-50 p-2 rounded-lg"><ShieldCheck size={16}/></div>
                <div><h4 className="text-[11px] font-bold text-slate-900">Secure & Private</h4><p className="text-[10px] text-slate-500 mt-0.5">Your files are encrypted</p></div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                <div className="text-blue-600 bg-blue-50 p-2 rounded-lg"><Cpu size={16}/></div>
                <div><h4 className="text-[11px] font-bold text-slate-900">AI Accuracy</h4><p className="text-[10px] text-slate-500 mt-0.5">High precision extraction</p></div>
              </div>
            </div>
          </div>

          {/* Right Col - Info Cards */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-6">
             <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-sm">
               <h4 className="text-[13px] font-bold text-slate-900 mb-5">What we extract</h4>
               <ul className="space-y-4">
                 <li className="flex items-center gap-3 text-[11px] font-semibold text-slate-700"><FileText size={14} className="text-blue-600"/> Privilege Names</li>
                 <li className="flex items-center gap-3 text-[11px] font-semibold text-slate-700"><Settings size={14} className="text-blue-600"/> Service References</li>
                 <li className="flex items-center gap-3 text-[11px] font-semibold text-slate-700"><BookOpen size={14} className="text-blue-600"/> Role Mappings</li>
                 <li className="flex items-center gap-3 text-[11px] font-semibold text-slate-700"><Cpu size={14} className="text-blue-600"/> Costed Privileges</li>
                 <li className="flex items-center gap-3 text-[11px] font-semibold text-slate-700"><UploadCloud size={14} className="text-blue-600"/> Service Hierarchy</li>
               </ul>
             </div>
             
             <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-sm">
               <h4 className="text-[13px] font-bold text-slate-900 mb-1 text-blue-600">Example output</h4>
               <p className="text-[11px] font-bold text-slate-700 mb-4">221 services detected</p>
               <div className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm relative">
                 <div className="flex gap-2 border-b border-slate-50 pb-2 mb-2">
                   <div className="w-8 h-2 bg-slate-200 rounded"></div>
                   <div className="w-8 h-2 bg-slate-200 rounded"></div>
                 </div>
                 <div className="space-y-2">
                   <div className="flex gap-2">
                     <div className="w-10 h-2 bg-slate-100 rounded"></div>
                     <div className="w-12 h-2 bg-slate-100 rounded"></div>
                   </div>
                   <div className="flex gap-2">
                     <div className="w-8 h-2 bg-slate-100 rounded"></div>
                     <div className="w-10 h-2 bg-slate-100 rounded"></div>
                   </div>
                 </div>
                 <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                   <CheckCircle2 size={12} strokeWidth={4} />
                 </div>
               </div>
             </div>
          </div>
        </div>

        {/* Data Table Section */}
        {extractedData && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-semibold text-slate-800">Extracted Services</h3>
                <p className="text-xs text-slate-500 mt-1">Review the AI extraction results before saving.</p>
              </div>
              <button
                onClick={handleSaveToS3}
                disabled={isSaving}
                className="flex items-center gap-2 bg-emerald-600 text-white font-medium py-2 px-5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm shadow-sm"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save to Database (S3)
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold border-b">Service Code</th>
                    <th className="p-4 font-semibold border-b">Service Name</th>
                    <th className="p-4 font-semibold border-b">Privileges Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {extractedData.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-700">{item.service_code || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">
                        <div>{item.service_name}</div>
                        <div className="text-xs text-slate-400 mt-1 truncate max-w-sm">{item.content}</div>
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                          {item.privileges?.length || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <hr className="my-12 border-slate-200 border-dashed" />

        {/* Cost Sheet Config */}
        <div className="flex gap-8 mb-16">
          {/* Left Col - Steps */}
          <div className="w-48 relative flex-shrink-0 pt-2">
            <div className="absolute left-[15px] top-8 bottom-8 w-px border-l border-dashed border-slate-200"></div>
            <div className="flex gap-4 relative mb-12">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold z-10 shadow-sm shadow-emerald-200">01</div>
              <div>
                <h4 className="text-[13px] font-bold text-emerald-700">Upload Document</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Upload the official<br/>Oracle Cost Sheet PDF.</p>
              </div>
            </div>
            <div className="flex gap-4 relative mb-12">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center z-10"><Settings size={14}/></div>
              <div>
                <h4 className="text-[13px] font-bold text-slate-800">AI Processing</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Our AI extracts<br/>service costs.</p>
              </div>
            </div>
            <div className="flex gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center z-10"><CheckCircle2 size={14}/></div>
              <div>
                <h4 className="text-[13px] font-bold text-slate-800">Configuration Ready</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Review and confirm<br/>the extracted prices.</p>
              </div>
            </div>
          </div>

          {/* Middle Col - Main Upload */}
          <div className="flex-1 max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-emerald-600"><FileText size={24} /></div>
              <div>
                <h2 className="text-[19px] font-bold text-slate-900">Cost Sheet Configuration</h2>
                <p className="text-xs text-slate-500 mt-1">Upload the official Oracle Cost Sheet PDF to automatically resolve service prices during analysis.</p>
              </div>
            </div>

            {/* Status Banner */}
            <div className={`flex items-center justify-between p-4 rounded-xl border mb-6 ${existingCostSheet ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${existingCostSheet ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                   {existingCostSheet ? <CheckCircle2 size={16} strokeWidth={3} /> : <AlertCircle size={16} />}
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-slate-900">Global Cost Sheet Status</h3>
                  <p className="text-[12px] text-slate-600 mt-0.5">{existingCostSheet ? 'A cost sheet is currently loaded and active in the database.' : 'No active cost sheet found. Analysis will skip pricing if missing.'}</p>
                </div>
              </div>
              {existingCostSheet && (
                <button onClick={handleDeleteCostSheet} disabled={isDeletingCostSheet} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-red-600 border border-red-200 bg-white rounded-lg hover:bg-red-50 transition-colors">
                   {isDeletingCostSheet ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete Cost Sheet
                </button>
              )}
            </div>

            {/* Upload Box */}
            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center mb-6 relative overflow-hidden bg-white shadow-sm">
              <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-2xl mb-4 relative">
                <FileText size={28} />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center border-[3px] border-white"><UploadCloud size={14}/></div>
              </div>
              <h3 className="text-[17px] font-bold text-slate-900 mb-2">Upload Cost Sheet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-8 leading-relaxed">Select the official Oracle PDF cost sheet. This will be stored globally and used for all future analyses.</p>
              
              <div className="flex flex-col items-center gap-3">
                <label className="cursor-pointer flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm w-64">
                  <UploadCloud size={16}/> {costSheetFile ? 'Change Cost Sheet PDF' : 'Choose Cost Sheet PDF'}
                  <input type="file" accept="application/pdf" className="hidden" onChange={handleCostSheetChange} />
                </label>
                
                {costSheetFile && (
                   <div className="flex flex-col items-center gap-3 mt-4 w-full">
                     <span className="text-sm text-slate-600 font-medium">{costSheetFile.name}</span>
                     <button
                        onClick={handleExtractCostSheet}
                        disabled={isUploadingCostSheet}
                        className="flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm shadow-sm w-64"
                      >
                        {isUploadingCostSheet ? <><Loader2 size={16} className="animate-spin" /> Extracting Costs...</> : <><Settings size={16} /> Extract with AI</>}
                      </button>
                   </div>
                )}
                {isUploadingCostSheet && costJobProgress && (
                   <div className="mt-3 text-[13px] font-bold text-emerald-600 flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                     <Loader2 size={14} className="animate-spin"/> {costJobProgress}
                   </div>
                )}
              </div>
            </div>

            {/* Bottom mini cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                <div className="text-emerald-600 bg-emerald-50 p-2 rounded-lg"><FileText size={16}/></div>
                <div><h4 className="text-[11px] font-bold text-slate-900">Supported format</h4><p className="text-[10px] text-slate-500 mt-0.5">PDF only</p></div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                <div className="text-emerald-600 bg-emerald-50 p-2 rounded-lg"><ShieldCheck size={16}/></div>
                <div><h4 className="text-[11px] font-bold text-slate-900">Secure & Private</h4><p className="text-[10px] text-slate-500 mt-0.5">Your files are encrypted</p></div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                <div className="text-emerald-600 bg-emerald-50 p-2 rounded-lg"><Cpu size={16}/></div>
                <div><h4 className="text-[11px] font-bold text-slate-900">AI Accuracy</h4><p className="text-[10px] text-slate-500 mt-0.5">High precision extraction</p></div>
              </div>
            </div>
          </div>

          {/* Right Col - Info Cards */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-6">
             <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-sm">
               <h4 className="text-[13px] font-bold text-slate-900 mb-5">What we extract</h4>
               <ul className="space-y-4">
                 <li className="flex items-center gap-3 text-[11px] font-semibold text-slate-700"><FileText size={14} className="text-emerald-600"/> Part Numbers (SKU)</li>
                 <li className="flex items-center gap-3 text-[11px] font-semibold text-slate-700"><Settings size={14} className="text-emerald-600"/> Service Names</li>
                 <li className="flex items-center gap-3 text-[11px] font-semibold text-slate-700"><BookOpen size={14} className="text-emerald-600"/> Monthly Costs</li>
               </ul>
             </div>
             
             <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-sm">
               <h4 className="text-[13px] font-bold text-slate-900 mb-1 text-emerald-600">Example output</h4>
               <p className="text-[11px] font-bold text-slate-700 mb-4">150 prices detected</p>
               <div className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm relative">
                 <div className="flex gap-2 border-b border-slate-50 pb-2 mb-2">
                   <div className="w-8 h-2 bg-slate-200 rounded"></div>
                   <div className="w-8 h-2 bg-slate-200 rounded"></div>
                 </div>
                 <div className="space-y-2">
                   <div className="flex gap-2">
                     <div className="w-10 h-2 bg-slate-100 rounded"></div>
                     <div className="w-12 h-2 bg-slate-100 rounded"></div>
                   </div>
                   <div className="flex gap-2">
                     <div className="w-8 h-2 bg-slate-100 rounded"></div>
                     <div className="w-10 h-2 bg-slate-100 rounded"></div>
                   </div>
                 </div>
                 <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                   <CheckCircle2 size={12} strokeWidth={4} />
                 </div>
               </div>
             </div>
          </div>
        </div>

        {/* Cost Sheet Data Table Section */}
        {extractedCostData && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-semibold text-slate-800">Extracted Prices</h3>
                <p className="text-xs text-slate-500 mt-1">Review the AI extraction results before saving.</p>
              </div>
              <button
                onClick={handleSaveCostSheetData}
                disabled={isUploadingCostSheet}
                className="flex items-center gap-2 bg-emerald-600 text-white font-medium py-2 px-5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm shadow-sm"
              >
                {isUploadingCostSheet ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save to Database (S3)
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold border-b">Part Number (SKU)</th>
                    <th className="p-4 font-semibold border-b">Service Name</th>
                    <th className="p-4 font-semibold border-b text-right">Cost (Monthly)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {extractedCostData.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-sm font-semibold text-slate-700">{item.partNumber || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{item.serviceName}</td>
                      <td className="p-4 text-sm text-emerald-600 font-semibold text-right">${item.cost?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
        )}
      </main>

      {/* Success/Error Toast Popup */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="bg-white rounded-xl shadow-lg border p-4 flex items-center gap-3"
            style={{ borderColor: '#e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            </div>
            <p className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>
              {toast.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
