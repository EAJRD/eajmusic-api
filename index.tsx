import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

// --- Types ---

type UserRole = 'artist' | 'admin';
type ViewState = 'login' | 'artist_app' | 'admin_dashboard';
type ReleaseStatus = 'pending' | 'approved' | 'ready_for_bot' | 'uploaded' | 'rejected';

interface Track {
  id: string;
  title: string;
  version: string;
  featuredArtists?: string; // Added Secondary Artists
  tiktokStart: string;
  explicitType: 'Clean' | 'Explicit' | 'Instrumental';
  hasLyrics: boolean;
  lyrics: string;
  composer?: string;
  producers?: string;
}

interface Release {
  id: string;
  artistId: string;
  title: string;
  coverUrl: string | null;
  audioUrl: string | null;
  
  // Dates
  releaseDate: string;
  submissionDate: string;

  // Metadata
  type: 'Single' | 'EP' | 'Album';
  genre: string;
  
  // People
  mainArtist: string;
  soundEngineers: string;
  mixingEngineers: string;
  masteringEngineers: string;

  tracks: Track[];
  splitSheetUrl: string | null;
  status: ReleaseStatus;
}

interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  walletBalance: number;
}

// --- Icons ---
const Icons = {
  Menu: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>,
  Home: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Disc: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M6 12c0-1.7.7-3.3 1.8-4.2"/></svg>,
  Upload: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Wallet: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>,
  Chart: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Shield: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  File: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Logout: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
};

// --- Mock Data ---
const CURRENT_USER: User = {
  uid: 'user_123',
  displayName: 'Jay Z',
  email: 'jayz@rocafella.com',
  role: 'artist',
  walletBalance: 12450.50
};

// --- Helpers ---
const getNextAuditDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const getStatusColor = (status: ReleaseStatus) => {
  switch (status) {
    case 'uploaded': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'approved': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'ready_for_bot': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    case 'rejected': return 'text-red-400 bg-red-400/10 border-red-400/20';
    default: return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  }
};

// --- Validation Logic (Client Side Code - No AI) ---
const validateCoverArt = (file: File): Promise<{valid: boolean, message: string}> => {
    return new Promise((resolve) => {
        if (!file.type.match('image/jpeg') && !file.type.match('image/jpg')) {
             resolve({ valid: false, message: "File must be a JPG/JPEG." });
             return;
        }
        
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            if (img.width < 3000 || img.height < 3000) {
                resolve({ valid: false, message: `Image too small (${img.width}x${img.height}). Minimum 3000x3000px required.` });
            } else if (img.width !== img.height) {
                resolve({ valid: false, message: "Image must be perfectly square (1:1 aspect ratio)." });
            } else {
                resolve({ valid: true, message: "Cover art looks good." });
            }
        };
        img.onerror = () => {
            resolve({ valid: false, message: "Invalid image file." });
        };
        img.src = objectUrl;
    });
};

// --- Components ---

// 1. Sidebar (Artist)
const Sidebar = ({ activeTab, setActiveTab, onLogout, mobileOpen, setMobileOpen }: any) => {
  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: Icons.Home },
    { id: 'analytics', label: 'Analytics', icon: Icons.Chart },
    { id: 'wallet', label: 'Wallet', icon: Icons.Wallet },
    { id: 'new-release', label: 'New Release', icon: Icons.Upload },
    { id: 'catalog', label: 'Catalog', icon: Icons.Disc },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-950 border-r border-dark-800 flex flex-col transition-transform duration-300 transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
            EAJ<span className="text-brand-500">Music</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-brand-600/10 text-brand-400' : 'text-slate-400 hover:bg-dark-800 hover:text-white'
              }`}
            >
              <tab.icon /> {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-dark-800">
           <button onClick={onLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300">
             <Icons.Logout /> Logout
           </button>
        </div>
      </div>
    </>
  );
};

// 2. Dashboard
const Dashboard = ({ user }: { user: User }) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header>
                <h2 className="text-2xl font-bold text-white">Welcome, {user.displayName}</h2>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-dark-900 p-6 rounded-xl border border-dark-800">
                     <p className="text-slate-400 text-sm">Total Streams</p>
                     <p className="text-2xl font-bold text-white mt-1">1,204,500</p>
                     <p className="text-emerald-400 text-xs mt-2">+12% this month</p>
                </div>
                 <div className="bg-dark-900 p-6 rounded-xl border border-dark-800">
                     <p className="text-slate-400 text-sm">Active Releases</p>
                     <p className="text-2xl font-bold text-white mt-1">12</p>
                </div>
                 <div className="bg-dark-900 p-6 rounded-xl border border-dark-800">
                     <p className="text-slate-400 text-sm">Wallet</p>
                     <p className="text-2xl font-bold text-white mt-1">{formatCurrency(user.walletBalance)}</p>
                </div>
            </div>
        </div>
    );
};

// 3. Analytics
const Analytics = () => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
             <header className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Playback Data</h2>
                <span className="text-xs text-slate-500">Source: Amuse.io via n8n</span>
             </header>
             <div className="glass-panel h-64 rounded-xl flex items-center justify-center border border-dark-700">
                 <div className="text-center">
                     <Icons.Chart />
                     <p className="text-slate-400 mt-2">Interactive Chart Visualization Placeholder</p>
                     <p className="text-xs text-slate-600">(Connected to n8n webhook ID: #AMUSE_WEBHOOK_01)</p>
                 </div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 glass-panel rounded-xl p-6">
                    <h3 className="text-white font-medium mb-4">Top Tracks</h3>
                    <div className="space-y-3">
                        {[1,2,3,4,5].map(i => (
                            <div key={i} className="flex justify-between items-center text-sm border-b border-dark-800 pb-2">
                                <span className="text-slate-300">{i}. Empire State of Mind</span>
                                <span className="text-brand-400 font-mono">245,00{i}</span>
                            </div>
                        ))}
                    </div>
                 </div>
                 <div className="glass-panel rounded-xl p-6">
                    <h3 className="text-white font-medium mb-4">Top Territories</h3>
                     <div className="space-y-2 text-sm text-slate-400">
                         <div className="flex justify-between"><span>USA</span> <span>45%</span></div>
                         <div className="flex justify-between"><span>UK</span> <span>15%</span></div>
                         <div className="flex justify-between"><span>Germany</span> <span>8%</span></div>
                     </div>
                 </div>
             </div>
        </div>
    );
};

// 4. Wallet
const Wallet = ({ user }: { user: User }) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold text-white">Wallet & Payouts</h2>
            <div className="glass-panel p-8 rounded-2xl relative overflow-hidden max-w-2xl">
                <div className="absolute top-0 right-0 p-32 bg-brand-600/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-brand-400 mb-2">
                        <Icons.Wallet />
                        <span className="font-medium text-sm">Withdrawable Balance</span>
                    </div>
                    <div className="text-5xl font-bold text-white tracking-tight">{formatCurrency(user.walletBalance)}</div>
                    
                    <div className="mt-8 flex flex-wrap gap-4">
                        <button className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-brand-900/50">
                            Request Payout
                        </button>
                        <button className="bg-dark-800 border border-dark-700 hover:bg-dark-700 text-slate-200 px-6 py-3 rounded-lg text-sm font-medium transition-colors">
                            Transaction History
                        </button>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-white/5 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <p className="text-xs text-slate-400 font-mono">
                            Next audit: <span className="text-white">{getNextAuditDate()}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 5. Release Wizard (Expanded)
const ReleaseWizard = ({ onSubmit }: any) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Release>>({
    title: '',
    type: 'Single',
    genre: '',
    releaseDate: '',
    mainArtist: CURRENT_USER.displayName,
    soundEngineers: '',
    mixingEngineers: '',
    masteringEngineers: '',
    tracks: [{ 
        id: '1', 
        title: '', 
        version: 'Original', 
        featuredArtists: '', // Init featured artists
        tiktokStart: '00:00',
        explicitType: 'Clean',
        hasLyrics: false,
        lyrics: '',
        composer: '',
        producers: ''
    }],
    splitSheetUrl: null
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [splitFile, setSplitFile] = useState<File | null>(null);
  
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [validationMsg, setValidationMsg] = useState<{valid: boolean, message: string} | null>(null);

  // 21 Day Rule
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 21);
  const minDateStr = minDate.toISOString().split('T')[0];

  // Logic: Reset tracks if Single
  useEffect(() => {
    if (formData.type === 'Single' && formData.tracks && formData.tracks.length > 1) {
        const firstTrack = formData.tracks[0];
        setFormData(prev => ({ ...prev, tracks: [firstTrack] }));
    }
  }, [formData.type]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setCoverFile(file);
          
          // STRICT JS VALIDATION
          const result = await validateCoverArt(file);
          setValidationMsg(result);
          if (result.valid) {
              setCoverPreview(URL.createObjectURL(file));
          } else {
              setCoverPreview(null);
          }
      }
  };

  const handleTrackChange = (index: number, field: keyof Track, value: any) => {
      const newTracks = [...(formData.tracks || [])];
      newTracks[index] = { ...newTracks[index], [field]: value };
      setFormData({...formData, tracks: newTracks});
  };

  const addTrack = () => {
      setFormData(prev => ({
          ...prev,
          tracks: [...(prev.tracks || []), { 
            id: Math.random().toString(), 
            title: '',
            version: 'Original',
            featuredArtists: '', // Init featured artists for new tracks
            tiktokStart: '00:00',
            explicitType: 'Clean',
            hasLyrics: false,
            lyrics: ''
          }]
      }));
  };

  const removeTrack = (index: number) => {
      if ((formData.tracks || []).length <= 1) return;
      const newTracks = [...(formData.tracks || [])];
      newTracks.splice(index, 1);
      setFormData({ ...formData, tracks: newTracks });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">New Release</h2>
        <span className="text-slate-500 text-sm">Step {step} of 4</span>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-2xl border-t-4 border-t-brand-600">
        
        {/* STEP 1: Core Metadata */}
        {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-medium text-white border-b border-dark-700 pb-2">1. Basic Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-xs text-slate-400">Release Title</label>
                        <input type="text" className="input-field" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">Main Artist</label>
                        <input type="text" disabled className="input-field opacity-60 cursor-not-allowed" value={formData.mainArtist} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">Release Type</label>
                        <select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                            <option value="Single">Single</option>
                            <option value="EP">EP</option>
                            <option value="Album">Album</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">{formData.type === 'Single' ? 'Strictly 1 Track' : 'Multiple Tracks Allowed'}</p>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">Genre</label>
                        <input type="text" className="input-field" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} />
                    </div>
                     <div>
                        <label className="text-xs text-slate-400">Release Date</label>
                        <input type="date" min={minDateStr} className="input-field" value={formData.releaseDate} onChange={e => setFormData({...formData, releaseDate: e.target.value})} />
                        <p className="text-[10px] text-amber-500 mt-1">Min 21 days lead time.</p>
                    </div>
                </div>
                <div className="flex justify-end">
                    <button onClick={() => setStep(2)} disabled={!formData.title} className="btn-primary">Next: Details</button>
                </div>
            </div>
        )}

        {/* STEP 2: Production Details (Engineers only) */}
        {step === 2 && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-medium text-white border-b border-dark-700 pb-2">2. Production Credits</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs text-slate-400">Sound Engineer(s)</label>
                        <input type="text" className="input-field" placeholder="Names separated by commas" value={formData.soundEngineers} onChange={e => setFormData({...formData, soundEngineers: e.target.value})} />
                    </div>
                     <div>
                        <label className="text-xs text-slate-400">Mixing Engineer(s)</label>
                        <input type="text" className="input-field" value={formData.mixingEngineers} onChange={e => setFormData({...formData, mixingEngineers: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">Mastering Engineer(s)</label>
                        <input type="text" className="input-field" value={formData.masteringEngineers} onChange={e => setFormData({...formData, masteringEngineers: e.target.value})} />
                    </div>
                </div>

                <div className="flex justify-between">
                    <button onClick={() => setStep(1)} className="text-slate-400 hover:text-white">Back</button>
                    <button onClick={() => setStep(3)} className="btn-primary">Next: Tracks</button>
                </div>
             </div>
        )}

        {/* STEP 3: Tracklist Metadata */}
        {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-medium text-white border-b border-dark-700 pb-2">3. Tracklist Metadata</h3>
                
                {(formData.tracks || []).map((track, i) => (
                    <div key={track.id} className="bg-dark-900 border border-dark-700 p-4 rounded-lg space-y-4">
                         <div className="flex justify-between items-center">
                            <span className="text-brand-500 font-bold text-sm">Track {i+1}</span>
                            {formData.type !== 'Single' && <button onClick={() => removeTrack(i)} className="text-red-400 text-xs">Remove</button>}
                         </div>
                         
                         {/* Row 1: Basic Info */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                             <div className="md:col-span-2">
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Track Title</label>
                                <input type="text" placeholder="Title" className="input-field" value={track.title} onChange={(e) => handleTrackChange(i, 'title', e.target.value)} />
                             </div>
                             
                             <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Version</label>
                                <select className="input-field" value={track.version} onChange={(e) => handleTrackChange(i, 'version', e.target.value)}>
                                    <option value="Original">Original</option>
                                    <option value="Radio Edit">Radio Edit</option>
                                    <option value="Instrumental">Instrumental</option>
                                    <option value="Remix">Remix</option>
                                    <option value="Acoustic">Acoustic</option>
                                    <option value="Live">Live</option>
                                </select>
                             </div>

                             <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">TikTok Start Time</label>
                                <input type="text" placeholder="00:00" className="input-field" value={track.tiktokStart} onChange={(e) => handleTrackChange(i, 'tiktokStart', e.target.value)} />
                             </div>
                        </div>

                        {/* Row 2: Secondary Artists */}
                         <div className="grid grid-cols-1 gap-3">
                             <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Featured Artists / Artistas Secundarios</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Feat. Artist Name" 
                                    className="input-field" 
                                    value={track.featuredArtists || ''} 
                                    onChange={(e) => handleTrackChange(i, 'featuredArtists', e.target.value)} 
                                />
                             </div>
                         </div>

                        {/* Row 3: Content Rating & Credits */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                             <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Content Rating</label>
                                <select className="input-field" value={track.explicitType} onChange={(e) => handleTrackChange(i, 'explicitType', e.target.value)}>
                                    <option value="Clean">Clean</option>
                                    <option value="Explicit">Explicit</option>
                                    <option value="Instrumental">Instrumental</option>
                                </select>
                             </div>
                             
                             <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Composer(s)</label>
                                <input type="text" className="input-field" value={track.composer || ''} onChange={(e) => handleTrackChange(i, 'composer', e.target.value)} />
                             </div>
                             
                             <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Producer(s)</label>
                                <input type="text" className="input-field" value={track.producers || ''} onChange={(e) => handleTrackChange(i, 'producers', e.target.value)} />
                             </div>
                        </div>

                        {/* Row 4: Lyrics */}
                        <div className="pt-2 border-t border-dark-800">
                             <div className="flex items-center gap-4 mb-2">
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Has Lyrics?</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleTrackChange(i, 'hasLyrics', true)}
                                        className={`text-xs px-3 py-1 rounded border ${track.hasLyrics ? 'bg-brand-600 border-brand-500 text-white' : 'border-dark-600 text-slate-400'}`}
                                    >
                                        Yes
                                    </button>
                                    <button 
                                        onClick={() => handleTrackChange(i, 'hasLyrics', false)}
                                        className={`text-xs px-3 py-1 rounded border ${!track.hasLyrics ? 'bg-dark-700 border-dark-500 text-white' : 'border-dark-600 text-slate-400'}`}
                                    >
                                        No
                                    </button>
                                </div>
                             </div>
                             
                             {track.hasLyrics && (
                                 <textarea 
                                    className="input-field h-32 font-mono text-xs" 
                                    placeholder="Paste lyrics here..."
                                    value={track.lyrics || ''}
                                    onChange={(e) => handleTrackChange(i, 'lyrics', e.target.value)}
                                 ></textarea>
                             )}
                        </div>
                    </div>
                ))}

                {formData.type !== 'Single' && (
                    <button onClick={addTrack} className="w-full py-2 border border-dashed border-dark-600 rounded text-slate-400 hover:text-brand-400 hover:border-brand-500 transition-colors">+ Add Track</button>
                )}

                <div className="flex justify-between">
                    <button onClick={() => setStep(2)} className="text-slate-400 hover:text-white">Back</button>
                    <button onClick={() => setStep(4)} disabled={!formData.tracks?.[0]?.title} className="btn-primary">Next: Assets</button>
                </div>
            </div>
        )}

        {/* STEP 4: Assets & Upload */}
        {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-medium text-white border-b border-dark-700 pb-2">4. Upload Assets</h3>
                
                {/* Strict Cover Art Validation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">Cover Art (3000x3000px JPG)</label>
                        <div className="aspect-square bg-dark-900 border-2 border-dashed border-dark-700 rounded-xl relative flex flex-col items-center justify-center overflow-hidden hover:border-brand-500/50 transition-colors">
                            {coverPreview ? (
                                <img src={coverPreview} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-6 text-slate-500">
                                    <Icons.Upload />
                                    <span className="text-xs mt-2 block">Upload</span>
                                </div>
                            )}
                            <input type="file" accept="image/jpeg" onChange={handleCoverUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        {validationMsg && (
                            <div className={`mt-2 text-xs p-2 rounded ${validationMsg.valid ? 'text-emerald-400 bg-emerald-950' : 'text-red-400 bg-red-950'}`}>
                                {validationMsg.message}
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-6">
                        {/* Audio */}
                         <div>
                            <label className="block text-xs font-medium text-slate-400 mb-2">Master Audio (WAV 16/24bit)</label>
                            <input 
                                type="file" 
                                accept=".wav,.flac" 
                                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-400 hover:file:bg-brand-500/20"
                            />
                         </div>

                         {/* Split Sheet */}
                         <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
                            <label className="block text-xs font-medium text-slate-300 mb-2">Split Sheet (PDF)</label>
                            <p className="text-[10px] text-slate-500 mb-3">Upload signed agreement for all writers.</p>
                            
                            <div className="flex gap-2 items-center">
                                <a href="/mock/split_sheet_template.pdf" download className="flex items-center gap-1 text-xs text-brand-400 hover:underline">
                                    <Icons.Download /> Template
                                </a>
                            </div>

                            <input 
                                type="file" 
                                accept=".pdf" 
                                onChange={(e) => setSplitFile(e.target.files?.[0] || null)}
                                className="mt-3 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-400 hover:file:bg-brand-500/20"
                            />
                         </div>
                    </div>
                </div>

                <div className="flex justify-between pt-4">
                    <button onClick={() => setStep(3)} className="text-slate-400 hover:text-white">Back</button>
                    <button 
                        onClick={() => onSubmit({...formData, coverUrl: coverPreview, status: 'pending', submissionDate: new Date().toISOString()})}
                        disabled={!validationMsg?.valid || !audioFile || !splitFile}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit Release
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

// 6. Admin Dashboard (Isolated)
const AdminDashboard = ({ releases, onLogout }: any) => {
    return (
        <div className="min-h-screen bg-slate-900 p-8">
            <header className="flex justify-between items-center mb-10 border-b border-slate-700 pb-6">
                <div>
                     <h1 className="text-3xl font-bold text-white tracking-tighter">EAJ<span className="text-purple-500">Admin</span></h1>
                     <p className="text-slate-400 text-sm">Quality Control & Distribution Queue</p>
                </div>
                <button onClick={onLogout} className="text-slate-400 hover:text-white flex items-center gap-2"><Icons.Logout /> Exit</button>
            </header>

            <div className="bg-slate-800 rounded-xl overflow-hidden shadow-2xl">
                 <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4">Release</th>
                            <th className="p-4">Date</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {releases.map((r: Release) => (
                            <tr key={r.id}>
                                <td className="p-4 flex items-center gap-3">
                                    <div className="w-12 h-12 bg-slate-700 rounded overflow-hidden">
                                        {r.coverUrl ? <img src={r.coverUrl} className="w-full h-full object-cover"/> : null}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{r.title}</div>
                                        <div className="text-xs">{r.mainArtist}</div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="text-xs">{r.releaseDate}</span>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-xs rounded border ${getStatusColor(r.status)}`}>{r.status}</span>
                                </td>
                                <td className="p-4 text-right">
                                    <button className="text-purple-400 hover:text-purple-300 mr-2">Review</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        </div>
    );
};

// 7. Login / Router
const App = () => {
    const [view, setView] = useState<ViewState>('login');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [releases, setReleases] = useState<Release[]>([]); // Empty initial state

    const handleLogin = (role: UserRole) => {
        if (role === 'admin') setView('admin_dashboard');
        else setView('artist_app');
    };

    const handleNewRelease = (data: Release) => {
        const newRelease = { ...data, id: Date.now().toString() };
        setReleases([newRelease, ...releases]);
        setActiveTab('catalog');
    };

    if (view === 'login') {
        return (
            <div className="h-screen flex items-center justify-center bg-dark-950">
                <div className="text-center space-y-8 animate-in zoom-in duration-300">
                    <h1 className="text-4xl font-bold text-white tracking-tight">EAJ<span className="text-brand-500">Music</span></h1>
                    <div className="flex gap-4">
                        <button onClick={() => handleLogin('artist')} className="px-8 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all">Artist Login</button>
                        <button onClick={() => handleLogin('admin')} className="px-8 py-3 bg-dark-800 border border-dark-700 hover:bg-dark-700 text-slate-300 rounded-xl font-bold transition-all">Admin Portal</button>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'admin_dashboard') {
        return <AdminDashboard releases={releases} onLogout={() => setView('login')} />;
    }

    // Artist App Layout
    return (
        <div className="flex h-screen bg-dark-950 font-sans text-slate-200">
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                onLogout={() => setView('login')} 
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
            />

            <div className="flex-1 flex flex-col h-full overflow-hidden lg:pl-64">
                {/* Mobile Header */}
                <div className="lg:hidden h-16 border-b border-dark-800 flex items-center px-4 justify-between bg-dark-950 z-40">
                    <span className="font-bold text-white">EAJMusic</span>
                    <button onClick={() => setMobileOpen(true)} className="text-slate-400"><Icons.Menu /></button>
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                    <div className="max-w-7xl mx-auto">
                        {activeTab === 'dashboard' && <Dashboard user={CURRENT_USER} />}
                        {activeTab === 'analytics' && <Analytics />}
                        {activeTab === 'wallet' && <Wallet user={CURRENT_USER} />}
                        {activeTab === 'new-release' && <ReleaseWizard onSubmit={handleNewRelease} />}
                        {activeTab === 'catalog' && (
                             <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-white">My Catalog</h2>
                                {releases.length === 0 ? <p className="text-slate-500">No releases yet.</p> : releases.map(r => (
                                    <div key={r.id} className="glass-panel p-4 rounded-xl flex justify-between items-center">
                                        <div className="font-bold text-white">{r.title}</div>
                                        <div className={`text-xs px-2 py-1 rounded border ${getStatusColor(r.status)}`}>{r.status}</div>
                                    </div>
                                ))}
                             </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Styles for Forms
const style = document.createElement('style');
style.innerHTML = `
  .input-field {
    width: 100%;
    background-color: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    padding: 0.75rem;
    color: white;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .input-field:focus {
    border-color: #0ea5e9;
  }
  .btn-primary {
    background-color: #0ea5e9;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-weight: 500;
    transition: background-color 0.2s;
  }
  .btn-primary:hover {
    background-color: #0284c7;
  }
`;
document.head.appendChild(style);