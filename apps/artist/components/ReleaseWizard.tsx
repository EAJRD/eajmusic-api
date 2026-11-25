import React, { useState, useEffect } from "react";
import { Release } from "../types";
import { CURRENT_USER } from "../utils";
import { StepBasicInfo } from "./wizard/StepBasicInfo";
import { StepProduction } from "./wizard/StepProduction";
import { StepTracks } from "./wizard/StepTracks";
import { StepAssets, TrackAssetsMap } from "./wizard/StepAssets";

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
        hasFeaturedArtists: false,
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

  // State lifted from what was previously inside the monolithic file
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [trackAssets, setTrackAssets] = useState<TrackAssetsMap>({}); 
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
        
        {step === 1 && (
            <StepBasicInfo 
                formData={formData} 
                setFormData={setFormData} 
                setStep={setStep} 
                minDateStr={minDateStr} 
            />
        )}

        {step === 2 && (
            <StepProduction 
                formData={formData} 
                setFormData={setFormData} 
                setStep={setStep} 
            />
        )}

        {step === 3 && (
            <StepTracks 
                formData={formData} 
                setFormData={setFormData} 
                setStep={setStep} 
            />
        )}

        {step === 4 && (
            <StepAssets
                formData={formData}
                setFormData={setFormData}
                setStep={setStep}
                trackAssets={trackAssets}
                setTrackAssets={setTrackAssets}
                setCoverFile={setCoverFile}
                setSplitFile={setSplitFile}
                splitFile={splitFile}
                coverPreview={coverPreview}
                setCoverPreview={setCoverPreview}
                validationMsg={validationMsg}
                setValidationMsg={setValidationMsg}
                onSubmit={handleFinalSubmit}
            />
        )}
      </div>
    </div>
  );
};