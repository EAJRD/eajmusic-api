import React from "react";
import { User } from "../types";
import { formatCurrency } from "../utils";

export const Dashboard = ({ user }: { user: User }) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header>
                <h2 className="text-2xl font-bold text-white">Welcome, {user.displayName}</h2>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-dark-900 p-6 rounded-xl border border-dark-800">
                     <p className="text-slate-400 text-sm">Total Streams</p>
                     <p className="text-2xl font-bold text-white mt-1">1,204,500</p>
                     <p className="text-emerald-400 text-xs mt-2">+12% this month</p>
                </div>
                 <div className="bg-dark-900 p-6 rounded-xl border border-dark-800">
                     <p className="text-slate-400 text-sm">Active Releases</p>
                     <p className="text-2xl font-bold text-white mt-1">12</p>
                </div>
                 <div className="bg-dark-900 p-6 rounded-xl border border-dark-800">
                     <p className="text-slate-400 text-sm">Wallet</p>
                     <p className="text-2xl font-bold text-white mt-1">{formatCurrency(user.walletBalance)}</p>
                </div>
            </div>
        </div>
    );
};