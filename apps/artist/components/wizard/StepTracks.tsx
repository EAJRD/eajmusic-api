import React from "react";
import { Release, Track } from "../../types";

interface StepTracksProps {
  formData: Partial<Release>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Release>>>;
  setStep: (step: number) => void;
}

export const StepTracks = ({ formData, setFormData, setStep }: StepTracksProps) => {
  
  const handleTrackChange = (index: number, field: keyof Track, value: any) => {
    const newTracks = [...(formData.tracks || [])];
    
    // Logic for toggles
    if (field === 'hasFeaturedArtists') {
        newTracks[index] = { 
            ...newTracks[index], 
            hasFeaturedArtists: value === true,
            featuredArtists: value === true ? newTracks[index].featuredArtists : '' 
        };
    } else {
        newTracks[index] = { ...newTracks[index], [field]: value };
    }
    
    setFormData(prev => ({...prev, tracks: newTracks}));
  };

  const addTrack = () => {
    setFormData(prev => ({
        ...prev,
        tracks: [...(prev.tracks || []), { 
          id: Math.random().toString(), 
          title: '',
          version: 'Original',
          hasFeaturedArtists: false,
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
    setFormData(prev => ({ ...prev, tracks: newTracks }));
  };

  return (
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
                                <p className="text-[10px] text-brand-400 mt-1">If more than 1, separate with commas.</p>
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
  );
};