import React, { useState, useEffect } from "react";
import { Release, Track } from "../types";
import { Icons, validateCoverArt, CURRENT_USER } from "../utils";

export const ReleaseWizard = ({ onSubmit }: any) => {
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
        hasFeaturedArtists: false, // Init toggle
        featuredArtists: '', 
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
  const [trackAssets, setTrackAssets] = useState<Record<string, { audio?: File, cover?: File, splitSheet?: File }>>({}); 
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
          const result = await validateCoverArt(file);
          setValidationMsg(result);
          if (result.valid) {
              setCoverPreview(URL.createObjectURL(file));
          } else {
              setCoverPreview(null);
          }
      }
  };

  const handleTrackAssetUpload = (trackId: string, assetType: 'audio' | 'cover' | 'splitSheet', e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setTrackAssets(prev => ({
              ...prev,
              [trackId]: {
                  ...prev[trackId],
                  [assetType]: e.target.files![0]
              }
          }));
      }
  };
  
  const removeTrackAsset = (trackId: string, assetType: 'audio' | 'cover' | 'splitSheet') => {
       setTrackAssets(prev => {
            const newAssets = { ...prev };
            if (newAssets[trackId]) {
                 delete newAssets[trackId][assetType];
            }
            return newAssets;
       });
  };

  const handleTrackChange = (index: number, field: keyof Track, value: any) => {
      const newTracks = [...(formData.tracks || [])];
      
      // Special logic for Featured Artists toggle
      if (field === 'hasFeaturedArtists') {
          if (value === false) {
              newTracks[index] = { ...newTracks[index], hasFeaturedArtists: false, featuredArtists: '' };
          } else {
              newTracks[index] = { ...newTracks[index], hasFeaturedArtists: true };
          }
      } else {
          newTracks[index] = { ...newTracks[index], [field]: value };
      }
      
      setFormData({...formData, tracks: newTracks});
  };

  const addTrack = () => {
      setFormData(prev => ({
          ...prev,
          tracks: [...(prev.tracks || []), { 
            id: Math.random().toString(), 
            title: '',
            version: 'Original',
            hasFeaturedArtists: false, // Init toggle
            featuredArtists: '', 
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

  const areAllTracksUploaded = () => {
      if (!formData.tracks) return false;
      return formData.tracks.every(t => trackAssets[t.id]?.audio);
  };

  const handleFinalSubmit = () => {
      const finalizedTracks = formData.tracks?.map(t => ({
          ...t,
          audioUrl: trackAssets[t.id]?.audio?.name,
          coverUrl: trackAssets[t.id]?.cover?.name || coverPreview || undefined,
          splitSheetUrl: trackAssets[t.id]?.splitSheet?.name
      })) || [];

      onSubmit({
          ...formData, 
          tracks: finalizedTracks,
          coverUrl: coverPreview, 
          status: 'pending', 
          submissionDate: new Date().toISOString()
      });
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

        {/* STEP 2: Production Details */}
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

        {/* STEP 3: Tracklist */}
        {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-medium text-white border-b border-dark-700 pb-2">3. Tracklist Metadata</h3>
                {(formData.tracks || []).map((track, i) => (
                    <div key={track.id} className="bg-dark-900 border border-dark-700 p-4 rounded-lg space-y-4">
                         <div className="flex justify-between items-center">
                            <span className="text-brand-500 font-bold text-sm">Track {i+1}</span>
                            {formData.type !== 'Single' && <button onClick={() => removeTrack(i)} className="text-red-400 text-xs">Remove</button>}
                         </div>
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
                         <div className="grid grid-cols-1 gap-3 border-t border-dark-800 pt-3">
                             <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold mb-2 block">Featured Artists / Artistas Secundarios?</label>
                                <div className="flex gap-2 mb-2">
                                    <button 
                                        onClick={() => handleTrackChange(i, 'hasFeaturedArtists', true)}
                                        className={`text-xs px-3 py-1 rounded border ${track.hasFeaturedArtists ? 'bg-brand-600 border-brand-500 text-white' : 'border-dark-600 text-slate-400'}`}
                                    >
                                        Yes
                                    </button>
                                    <button 
                                        onClick={() => handleTrackChange(i, 'hasFeaturedArtists', false)}
                                        className={`text-xs px-3 py-1 rounded border ${!track.hasFeaturedArtists ? 'bg-dark-700 border-dark-500 text-white' : 'border-dark-600 text-slate-400'}`}
                                    >
                                        No
                                    </button>
                                </div>
                                {track.hasFeaturedArtists && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Bad Bunny, Rosalía" 
                                            className="input-field" 
                                            value={track.featuredArtists || ''} 
                                            onChange={(e) => handleTrackChange(i, 'featuredArtists', e.target.value)} 
                                        />
                                        <p className="text-[10px] text-brand-400 mt-1">If more than 1, separate with commas (,) / Si es más de 1, usar comas (,).</p>
                                    </div>
                                )}
                             </div>
                         </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-dark-800 pt-3">
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
                <div className="grid grid-cols-1 gap-8">
                    {/* Cover Art Section */}
                    <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
                        <label className="block text-sm font-bold text-white mb-2">Release Cover Art (Main)</label>
                         <p className="text-[10px] text-slate-400 mb-4">Required: 3000x3000px JPG/JPEG. Perfect Square.</p>
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="w-48 h-48 shrink-0 bg-dark-800 border-2 border-dashed border-dark-600 rounded-xl relative flex flex-col items-center justify-center overflow-hidden hover:border-brand-500/50 transition-colors">
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
                            <div className="flex-1 w-full">
                                {validationMsg && (
                                    <div className={`text-xs p-3 rounded border ${validationMsg.valid ? 'text-emerald-400 bg-emerald-950 border-emerald-900' : 'text-red-400 bg-red-950 border-red-900'}`}>
                                        <div className="font-bold flex items-center gap-2">
                                            {validationMsg.valid ? <Icons.Check /> : <Icons.Alert />}
                                            {validationMsg.valid ? 'Valid Image' : 'Issue Detected'}
                                        </div>
                                        <div className="mt-1">{validationMsg.message}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Audio Uploads - PER TRACK */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-white border-b border-dark-700 pb-2">Track Assets (Audio, Cover, Splits)</h4>
                         <p className="text-[10px] text-slate-400">Audio is required. Cover/Split sheet are optional (Release defaults will apply if empty).</p>
                        
                        {(formData.tracks || []).map((track, i) => (
                             <div key={track.id} className="bg-dark-900 border border-dark-700 rounded-xl p-4">
                                <div className="flex items-center gap-4 mb-4 border-b border-dark-800 pb-3">
                                    <div className="w-8 h-8 rounded bg-dark-800 flex items-center justify-center text-slate-500 font-mono text-sm">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{track.title || "Untitled Track"}</p>
                                        <p className="text-xs text-slate-500">{track.version} • {track.explicitType}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* AUDIO */}
                                    <div className="bg-dark-950/50 rounded p-3 border border-dark-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Audio (Required)</span>
                                            <span className="text-[10px] text-slate-600">WAV/FLAC</span>
                                        </div>
                                        {trackAssets[track.id]?.audio ? (
                                            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-950/30 px-2 py-2 rounded border border-emerald-900/50 justify-between">
                                                <div className="flex items-center gap-1 overflow-hidden">
                                                    <Icons.AudioFile />
                                                    <span className="truncate">{trackAssets[track.id]!.audio!.name}</span>
                                                </div>
                                                <button onClick={() => removeTrackAsset(track.id, 'audio')} className="text-emerald-500 hover:text-white">✕</button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <input type="file" accept=".wav,.flac" id={`audio-${track.id}`} onChange={(e) => handleTrackAssetUpload(track.id, 'audio', e)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                                                <label htmlFor={`audio-${track.id}`} className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 border border-dashed border-dark-600 rounded text-xs text-slate-300 transition-colors w-full">
                                                    <Icons.Upload /> Upload Audio
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                    {/* COVER */}
                                    <div className="bg-dark-950/50 rounded p-3 border border-dark-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Cover (Optional)</span>
                                            <span className="text-[10px] text-slate-600">JPG</span>
                                        </div>
                                        {trackAssets[track.id]?.cover ? (
                                            <div className="flex items-center gap-2 text-blue-400 text-xs bg-blue-950/30 px-2 py-2 rounded border border-blue-900/50 justify-between">
                                                <div className="flex items-center gap-1 overflow-hidden">
                                                    <Icons.Image />
                                                    <span className="truncate">{trackAssets[track.id]!.cover!.name}</span>
                                                </div>
                                                <button onClick={() => removeTrackAsset(track.id, 'cover')} className="text-blue-500 hover:text-white">✕</button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <input type="file" accept="image/jpeg" id={`cover-${track.id}`} onChange={(e) => handleTrackAssetUpload(track.id, 'cover', e)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                                                <label htmlFor={`cover-${track.id}`} className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 border border-dashed border-dark-600 rounded text-xs text-slate-300 transition-colors w-full">
                                                    <Icons.Upload /> Custom Cover
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                    {/* SPLIT SHEET */}
                                    <div className="bg-dark-950/50 rounded p-3 border border-dark-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Split Sheet (Opt)</span>
                                            <span className="text-[10px] text-slate-600">PDF</span>
                                        </div>
                                        {trackAssets[track.id]?.splitSheet ? (
                                            <div className="flex items-center gap-2 text-purple-400 text-xs bg-purple-950/30 px-2 py-2 rounded border border-purple-900/50 justify-between">
                                                <div className="flex items-center gap-1 overflow-hidden">
                                                    <Icons.File />
                                                    <span className="truncate">{trackAssets[track.id]!.splitSheet!.name}</span>
                                                </div>
                                                <button onClick={() => removeTrackAsset(track.id, 'splitSheet')} className="text-purple-500 hover:text-white">✕</button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <input type="file" accept=".pdf" id={`split-${track.id}`} onChange={(e) => handleTrackAssetUpload(track.id, 'splitSheet', e)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                                                <label htmlFor={`split-${track.id}`} className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 border border-dashed border-dark-600 rounded text-xs text-slate-300 transition-colors w-full">
                                                    <Icons.Upload /> Track Split
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                             </div>
                        ))}
                    </div>

                    {/* Split Sheet (Release Level) */}
                    <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                             <div>
                                <label className="block text-sm font-bold text-slate-300">General Release Agreement</label>
                                <p className="text-[10px] text-slate-500">Global split sheet covering all tracks (if not specified individually).</p>
                             </div>
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

                <div className="flex justify-between pt-4 border-t border-dark-700 mt-4">
                    <button onClick={() => setStep(3)} className="text-slate-400 hover:text-white">Back</button>
                    <button 
                        onClick={handleFinalSubmit}
                        disabled={!validationMsg?.valid || !splitFile || !areAllTracksUploaded()}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {areAllTracksUploaded() ? 'Submit Release' : 'Upload Audio for All Tracks'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};