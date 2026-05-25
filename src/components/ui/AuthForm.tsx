'use client';

import { useState } from 'react';

interface AuthFormProps {
  type: 'login' | 'register';
}

export default function AuthForm({ type }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Redirect temp logic
    if (email.includes('admin')) {
      window.location.href = '/admin';
    } else {
      window.location.href = '/dashboard';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {type === 'register' && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Nama Lengkap</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ahmad Fauzi"
              className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-white/10 text-text-primary text-sm focus:border-brand-gold/50 focus:outline-none focus:ring-1 focus:ring-brand-gold/20 transition-all placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">No. WhatsApp</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812-3456-7890"
              className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-white/10 text-text-primary text-sm focus:border-brand-gold/50 focus:outline-none focus:ring-1 focus:ring-brand-gold/20 transition-all placeholder:text-text-muted"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ahmad@email.com"
          className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-white/10 text-text-primary text-sm focus:border-brand-gold/50 focus:outline-none focus:ring-1 focus:ring-brand-gold/20 transition-all placeholder:text-text-muted"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-sm font-medium text-text-secondary">Password</label>
          {type === 'login' && (
            <a href="#" className="text-xs text-brand-gold hover:underline">Lupa password?</a>
          )}
        </div>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-white/10 text-text-primary text-sm focus:border-brand-gold/50 focus:outline-none focus:ring-1 focus:ring-brand-gold/20 transition-all placeholder:text-text-muted tracking-widest"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-6 py-3.5 rounded-xl bg-brand-gold text-surface-dark font-heading font-700 text-sm hover:bg-brand-gold-light transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-brand-gold/20"
      >
        {isLoading ? (
           <span className="flex items-center justify-center gap-2">
             <span className="w-4 h-4 border-2 border-surface-dark/30 border-t-surface-dark rounded-full animate-spin" />
             Memproses...
           </span>
        ) : (
          type === 'login' ? 'Masuk' : 'Daftar Sekarang'
        )}
      </button>
    </form>
  );
}
