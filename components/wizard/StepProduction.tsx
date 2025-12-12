import React from "react";
import { Release } from "../../types";

interface StepProductionProps {
  formData: Partial<Release>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Release>>>;
  setStep: (step: number) => void;
}

export const StepProduction = ({ formData, setFormData, setStep }: StepProductionProps) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h3 className="text-lg font-medium text-white border-b border-dark-700 pb-2">2. Production Credits</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400">Sound Engineer(s)</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Names separated by commas" 
            value={formData.soundEngineers} 
            onChange={e => setFormData(prev => ({...prev, soundEngineers: e.target.value}))} 
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Mixing Engineer(s)</label>
          <input 
            type="text" 
            className="input-field" 
            value={formData.mixingEngineers} 
            onChange={e => setFormData(prev => ({...prev, mixingEngineers: e.target.value}))} 
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Mastering Engineer(s)</label>
          <input 
            type="text" 
            className="input-field" 
            value={formData.masteringEngineers} 
            onChange={e => setFormData(prev => ({...prev, masteringEngineers: e.target.value}))} 
          />
        </div>
      </div>
      <div className="flex justify-between">
        <button onClick={() => setStep(1)} className="text-slate-400 hover:text-white">Back</button>
        <button onClick={() => setStep(3)} className="btn-primary">Next: Tracks</button>
      </div>
    </div>
  );
};