import React from "react";
import { Release } from "../../types";

interface StepBasicInfoProps {
  formData: Partial<Release>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Release>>>;
  setStep: (step: number) => void;
  minDateStr: string;
}

export const StepBasicInfo = ({ formData, setFormData, setStep, minDateStr }: StepBasicInfoProps) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h3 className="text-lg font-medium text-white border-b border-dark-700 pb-2">1. Basic Info</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs text-slate-400">Release Title</label>
          <input 
            type="text" 
            className="input-field" 
            value={formData.title} 
            onChange={e => setFormData(prev => ({...prev, title: e.target.value}))} 
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Main Artist</label>
          <input 
            type="text" 
            disabled 
            className="input-field opacity-60 cursor-not-allowed" 
            value={formData.mainArtist} 
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Release Type</label>
          <select 
            className="input-field" 
            value={formData.type} 
            onChange={e => setFormData(prev => ({...prev, type: e.target.value as any}))}
          >
            <option value="Single">Single</option>
            <option value="EP">EP</option>
            <option value="Album">Album</option>
          </select>
          <p className="text-[10px] text-slate-500 mt-1">{formData.type === 'Single' ? 'Strictly 1 Track' : 'Multiple Tracks Allowed'}</p>
        </div>
        <div>
          <label className="text-xs text-slate-400">Genre</label>
          <input 
            type="text" 
            className="input-field" 
            value={formData.genre} 
            onChange={e => setFormData(prev => ({...prev, genre: e.target.value}))} 
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Release Date</label>
          <input 
            type="date" 
            min={minDateStr} 
            className="input-field" 
            value={formData.releaseDate} 
            onChange={e => setFormData(prev => ({...prev, releaseDate: e.target.value}))} 
          />
          <p className="text-[10px] text-amber-500 mt-1">Min 21 days lead time.</p>
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={() => setStep(2)} disabled={!formData.title} className="btn-primary">Next: Details</button>
      </div>
    </div>
  );
};