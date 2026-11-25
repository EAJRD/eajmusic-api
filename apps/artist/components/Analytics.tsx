import React from "react";
import { Icons } from "../utils";

// Simple SVG Line Chart Component
const SimpleLineChart = ({ data, color = "#0ea5e9" }: { data: number[], color?: string }) => {
    const height = 200;
    const width = 600; // SVG Viewbox width
    const max = Math.max(...data);
    const min = Math.min(...data);
    
    // Normalize points to fit svg
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / (max - min)) * height * 0.8 - (height * 0.1); // 10% padding
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            {/* Gradient Defs */}
            <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            
            {/* Fill Area */}
            <path 
                d={`M0,${height} ${points} ${width},${height} Z`} 
                fill="url(#chartGradient)" 
            />
            
            {/* Stroke Line */}
            <polyline 
                fill="none" 
                stroke={color} 
                strokeWidth="3" 
                points={points} 
                strokeLinecap="round" 
                strokeLinejoin="round"
            />
            
            {/* Points */}
            {data.map((val, i) => {
                 const x = (i / (data.length - 1)) * width;
                 const y = height - ((val - min) / (max - min)) * height * 0.8 - (height * 0.1);
                 return (
                    <circle key={i} cx={x} cy={y} r="4" fill="#0f172a" stroke={color} strokeWidth="2" className="hover:r-6 transition-all" />
                 )
            })}
        </svg>
    );
};

export const Analytics = () => {
    // Mock Data for the last 7 days
    const streamData = [12500, 14200, 13800, 15500, 18200, 17500, 21000];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
             <header className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Playback Data</h2>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs text-slate-400">Live Sync: Amuse.io</span>
                </div>
             </header>
             
             {/* Main Chart */}
             <div className="glass-panel h-80 rounded-xl p-6 relative border border-dark-700">
                 <h3 className="text-sm font-bold text-slate-300 mb-4">Streams (Last 7 Days)</h3>
                 <div className="absolute inset-x-6 bottom-6 top-12">
                     <SimpleLineChart data={streamData} />
                 </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 glass-panel rounded-xl p-6">
                    <h3 className="text-white font-medium mb-4">Top Tracks Performance</h3>
                    <div className="space-y-4">
                        {[
                            { name: "Empire State of Mind", plays: "245,001", trend: "+12%" },
                            { name: "Numb / Encore", plays: "182,440", trend: "+5%" },
                            { name: "99 Problems", plays: "156,000", trend: "-2%" },
                            { name: "Otis", plays: "120,500", trend: "+8%" }
                        ].map((track, i) => (
                            <div key={i} className="flex justify-between items-center text-sm border-b border-dark-800 pb-3 last:border-0">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded flex items-center justify-center bg-dark-800 text-slate-500 text-xs font-mono">{i + 1}</span>
                                    <span className="text-slate-300">{track.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-mono">{track.plays}</div>
                                    <div className={`text-[10px] ${track.trend.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{track.trend}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
                 <div className="glass-panel rounded-xl p-6">
                    <h3 className="text-white font-medium mb-4">Demographics</h3>
                     <div className="space-y-4">
                         {[
                             { country: "United States", pct: 45, color: "bg-blue-500" },
                             { country: "United Kingdom", pct: 15, color: "bg-indigo-500" },
                             { country: "Germany", pct: 8, color: "bg-purple-500" },
                             { country: "Brazil", pct: 12, color: "bg-emerald-500" }
                         ].map((geo, i) => (
                             <div key={i}>
                                 <div className="flex justify-between text-xs text-slate-400 mb-1">
                                     <span>{geo.country}</span>
                                     <span>{geo.pct}%</span>
                                 </div>
                                 <div className="h-2 w-full bg-dark-800 rounded-full overflow-hidden">
                                     <div className={`h-full ${geo.color}`} style={{ width: `${geo.pct}%` }}></div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
        </div>
    );
};