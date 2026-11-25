import React from "react";
import { Release } from "../types";
import { Icons, getStatusColor } from "../utils";

export const AdminDashboard = ({ releases, onLogout }: any) => {
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