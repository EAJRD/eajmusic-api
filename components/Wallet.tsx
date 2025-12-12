import React from "react";
import { User } from "../types";
import { Icons, formatCurrency, getNextAuditDate } from "../utils";

export const Wallet = ({ user }: { user: User }) => {
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