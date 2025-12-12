import React from "react";
import { Icons } from "../utils";

export const Analytics = () => {
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