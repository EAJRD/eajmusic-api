import React, { useState } from "react";
import { Icons } from "../utils";

interface LoginProps {
  onLogin: (role: 'artist' | 'admin') => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulación de delay de red y validación básica
    setTimeout(() => {
      setIsLoading(false);
      
      if (!email || !password) {
        setError("Please enter both email and password.");
        return;
      }

      if (email === "admin@eajmusic.com") {
        onLogin('admin');
      } else {
        // Login exitoso por defecto para demo
        onLogin('artist');
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]"></div>
        </div>

        <div className="w-full max-w-md p-8 glass-panel rounded-2xl relative z-10 animate-in zoom-in duration-300">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight mb-2">EAJ<span className="text-brand-500">Music</span></h1>
                <p className="text-slate-400 text-sm">Artist Management Portal</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Email Address</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field bg-dark-900/50 focus:bg-dark-900 transition-all"
                        placeholder="artist@label.com"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Password</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field bg-dark-900/50 focus:bg-dark-900 transition-all"
                        placeholder="••••••••"
                    />
                </div>

                {error && (
                    <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                        <Icons.Alert /> {error}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-900/50 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                           <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Authenticating...
                        </>
                    ) : (
                        "Sign In to Dashboard"
                    )}
                </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-xs text-slate-500">
                    Don't have an account? <a href="#" className="text-brand-400 hover:text-brand-300">Apply for Access</a>
                </p>
                <div className="mt-4 pt-4 border-t border-white/5">
                    <button 
                        type="button"
                        onClick={() => { setEmail('admin@eajmusic.com'); setPassword('admin123'); }} 
                        className="text-[10px] text-slate-600 hover:text-slate-400 underline"
                    >
                        Demo: Fill Admin Credentials
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};