import React, { useState } from "react";
import { Release, SplitContributor } from "../../types";
import { Icons, validateCoverArt } from "../../utils";
import { AudioPreviewPlayer } from "../AudioPreviewPlayer";
import { SplitsModal } from "../SplitsModal";
import { Users } from "lucide-react";

export type TrackAssetsMap = Record<string, { audio?: File, cover?: File, splitSheet?: File }>;

interface StepAssetsProps {
  formData: Partial<Release>;
  setFormData?: React.Dispatch<React.SetStateAction<Partial<Release>>>;
  setStep: (step: number) => void;
  // Asset State Handlers passed from parent
  trackAssets: TrackAssetsMap;
  setTrackAssets: React.Dispatch<React.SetStateAction<TrackAssetsMap>>;
  setCoverFile: React.Dispatch<React.SetStateAction<File | null>>;
  setSplitFile: React.Dispatch<React.SetStateAction<File | null>>;
  splitFile: File | null;
  coverPreview: string | null;
  setCoverPreview: React.Dispatch<React.SetStateAction<string | null>>;
  validationMsg: {valid: boolean, message: string} | null;
  setValidationMsg: React.Dispatch<React.SetStateAction<{valid: boolean, message: string} | null>>;
  onSubmit: () => void;
}

export const StepAssets = ({
  formData,
  setFormData,
  setStep,
  trackAssets,
  setTrackAssets,
  setCoverFile,
  setSplitFile,
  splitFile,
  coverPreview,
  setCoverPreview,
  validationMsg,
  setValidationMsg,
  onSubmit
}: StepAssetsProps) => {
  const [activeSplitTrackId, setActiveSplitTrackId] = useState<string | null>(null);

  const handleSaveSplits = (trackId: string, splits: SplitContributor[]) => {
    if (setFormData) {
      setFormData(prev => ({
        ...prev,
        tracks: (prev.tracks || []).map(t => (t.id === trackId ? { ...t, splits } : t))
      }));
    }
  };

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

  const areAllTracksUploaded = () => {
      if (!formData.tracks) return false;
      return formData.tracks.every(t => trackAssets[t.id]?.audio);
  };

  return (
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
                 <p className="text-[10px] text-slate-400">Audio is required. Cover/Split sheet are optional.</p>
                
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
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-950/30 px-2 py-2 rounded border border-emerald-900/50 justify-between">
                                            <div className="flex items-center gap-1 overflow-hidden">
                                                <Icons.AudioFile />
                                                <span className="truncate">{trackAssets[track.id]!.audio!.name}</span>
                                            </div>
                                            <button onClick={() => removeTrackAsset(track.id, 'audio')} className="text-emerald-500 hover:text-white">✕</button>
                                        </div>
                                        <AudioPreviewPlayer
                                            src={URL.createObjectURL(trackAssets[track.id]!.audio!)}
                                            trackTitle={track.title || `Track ${i + 1}`}
                                            artistName={formData.mainArtist || "EAJ Artist"}
                                        />
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
                            {/* SPLIT SHEET & DIGITAL SPLITS */}
                            <div className="bg-dark-950/50 rounded p-3 border border-dark-800 flex flex-col justify-between">
                                <div>
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="text-[10px] uppercase font-bold text-slate-400">Splits & Regalías</span>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        {track.splits?.length ? `${track.splits.length} pers.` : 'Auto 100%'}
                                      </span>
                                  </div>
                                  <button
                                      type="button"
                                      onClick={() => setActiveSplitTrackId(track.id)}
                                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#121212] hover:bg-[#1C1C1C] text-sky-400 border border-[#262626] hover:border-sky-500/50 rounded text-xs font-semibold transition-all mb-2 shadow-sm"
                                  >
                                      <Users className="w-3.5 h-3.5" />
                                      {track.splits?.length ? 'Editar Splits' : 'Configurar Splits'}
                                  </button>
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
                                        <label htmlFor={`split-${track.id}`} className="cursor-pointer flex items-center justify-center gap-2 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 border border-dashed border-dark-600 rounded text-[11px] text-slate-400 transition-colors w-full">
                                            <Icons.Upload /> Split Sheet PDF (Opt)
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
                onClick={onSubmit}
                disabled={!validationMsg?.valid || !splitFile || !areAllTracksUploaded()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {areAllTracksUploaded() ? 'Submit Release' : 'Upload Audio for All Tracks'}
            </button>
        </div>

        {/* Modal de Configuración de Splits */}
        {activeSplitTrackId && (
            <SplitsModal
                isOpen={!!activeSplitTrackId}
                onClose={() => setActiveSplitTrackId(null)}
                onSave={(splits) => handleSaveSplits(activeSplitTrackId, splits)}
                trackTitle={
                    formData.tracks?.find(t => t.id === activeSplitTrackId)?.title ||
                    'Track Seleccionado'
                }
                initialSplits={
                    formData.tracks?.find(t => t.id === activeSplitTrackId)?.splits || []
                }
            />
        )}
    </div>
  );
};