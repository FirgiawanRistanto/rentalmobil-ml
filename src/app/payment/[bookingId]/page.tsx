'use client';

import { useState, useEffect } from 'react';
import { formatRupiah } from '@/lib/data';

export default function PaymentPage() {
  const [timeLeft, setTimeLeft] = useState(60 * 45); // 45 minutes
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Demo data
  const booking = {
    id: 'BRN-0042',
    name: 'Ahmad Fauzi',
    car: 'Toyota Innova Reborn',
    dates: '18 - 20 Mar 2026',
    duration: 2,
    total: 1560000,
  };

  const currentStatus: number = 1; // 0=Pending, 1=Verification, 2=Confirmed, 3=Completed

  return (
    <main className="flex-1 px-4 py-8 md:px-12 lg:px-40 flex justify-center min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        
        {/* Countdown Timer */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 text-center">
          <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-4 uppercase tracking-wider">Remaining to upload proof</h3>
          <div className="flex justify-center gap-4">
            <div className="flex flex-col items-center">
              <div className="bg-primary/5 dark:bg-primary/20 rounded-lg w-16 h-16 flex items-center justify-center">
                <span className="text-primary text-3xl font-bold">{String(minutes).padStart(2, '0')}</span>
              </div>
              <span className="text-xs mt-2 text-slate-500">Minutes</span>
            </div>
            <div className="flex items-center text-primary text-3xl font-bold pb-6">:</div>
            <div className="flex flex-col items-center">
              <div className="bg-primary/5 dark:bg-primary/20 rounded-lg w-16 h-16 flex items-center justify-center">
                <span className="text-primary text-3xl font-bold">{String(seconds).padStart(2, '0')}</span>
              </div>
              <span className="text-xs mt-2 text-slate-500">Seconds</span>
            </div>
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Invoice Summary</h3>
            <span className="text-primary font-mono font-bold text-sm">#{booking.id}</span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Customer Name</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">{booking.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Vehicle</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">{booking.car}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Rental Dates</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">{booking.dates}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Duration</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">{booking.duration} Days</p>
              </div>
            </div>
          </div>
          <div className="p-6 bg-primary/5 dark:bg-primary/10 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Total Amount</span>
              <span className="text-2xl font-bold text-primary">{formatRupiah(booking.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment Instructions */}
        <div className="bg-primary text-white rounded-xl p-6 shadow-lg relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full"></div>
          <div className="absolute -left-10 -top-10 w-24 h-24 bg-white/5 rounded-full"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined">account_balance</span>
              <h4 className="font-bold text-lg">Transfer Instructions</h4>
            </div>
            <p className="text-white/80 text-sm mb-4">Please transfer the exact amount to the bank account below:</p>
            
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs opacity-70">Bank Name</span>
                <span className="font-bold">BCA</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs opacity-70">Account Number</span>
                <span className="font-mono font-bold tracking-wider">123-456-789</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs opacity-70">Account Name</span>
                <span className="font-bold uppercase">Besan Rental</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Upload Proof of Transfer</label>
          <label 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`block border-2 border-dashed rounded-xl p-8 text-center bg-white dark:bg-slate-900 transition-colors cursor-pointer group ${
              isDragging ? 'border-primary bg-primary/5' : uploadedFile ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-primary/30 dark:border-primary/50 hover:border-primary'
            }`}
          >
            <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
            <div className="flex flex-col items-center gap-2">
              {uploadedFile ? (
                <>
                  <div className="size-12 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                  </div>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">File Selected</p>
                  <p className="text-sm text-slate-500 truncate max-w-[250px]">{uploadedFile.name}</p>
                </>
              ) : (
                <>
                  <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                  </div>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">Click to upload or drag and drop</p>
                  <p className="text-sm text-slate-500">PNG, JPG or PDF (Max. 5MB)</p>
                </>
              )}
            </div>
          </label>
        </div>

        {/* Action Button */}
        <button disabled={!uploadedFile} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100">
          <span className="material-symbols-outlined">check_circle</span>
          Upload &amp; Submit Proof
        </button>

        {/* Status Tracker */}
        <div className="mt-8 mb-12">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest text-center mb-8">Booking Status</h4>
          
          <div className="relative flex justify-between">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-0">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(currentStatus / 3) * 100}%` }}></div>
            </div>
            
            {/* Step 0 (Pending) */}
            <div className="flex flex-col items-center relative z-10 gap-2">
              <div className={`size-10 rounded-full flex items-center justify-center shadow-md transition-colors ${
                currentStatus > 0 ? 'bg-primary text-white' : currentStatus === 0 ? 'bg-white dark:bg-slate-900 border-4 border-primary text-primary' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}>
                {currentStatus > 0 ? <span className="material-symbols-outlined text-xl">done</span> : <span className="material-symbols-outlined text-xl">pending_actions</span>}
              </div>
              <span className={`text-xs font-bold ${currentStatus >= 0 ? (currentStatus > 0 ? 'text-primary' : 'text-slate-900 dark:text-white') : 'text-slate-400'}`}>Pending</span>
            </div>
            
            {/* Step 1 (Verification) */}
            <div className="flex flex-col items-center relative z-10 gap-2">
              <div className={`size-10 rounded-full flex items-center justify-center shadow-md transition-colors ${
                currentStatus > 1 ? 'bg-primary text-white' : currentStatus === 1 ? 'bg-white dark:bg-slate-900 border-4 border-primary text-primary' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}>
                {currentStatus > 1 ? <span className="material-symbols-outlined text-xl">done</span> : <span className="material-symbols-outlined text-xl">hourglass_empty</span>}
              </div>
              <span className={`text-xs font-bold ${currentStatus >= 1 ? (currentStatus > 1 ? 'text-primary' : 'text-slate-900 dark:text-white') : 'text-slate-400'}`}>Verification</span>
            </div>
            
            {/* Step 2 (Confirmed) */}
            <div className="flex flex-col items-center relative z-10 gap-2">
              <div className={`size-10 rounded-full flex items-center justify-center transition-colors ${
                currentStatus > 2 ? 'bg-primary text-white shadow-md' : currentStatus === 2 ? 'bg-white dark:bg-slate-900 border-4 border-primary text-primary shadow-md' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}>
                {currentStatus > 2 ? <span className="material-symbols-outlined text-xl">done</span> : <span className="material-symbols-outlined text-xl">verified</span>}
              </div>
              <span className={`text-xs font-medium ${currentStatus >= 2 ? (currentStatus > 2 ? 'text-primary' : 'text-slate-900 dark:text-white font-bold') : 'text-slate-400'}`}>Confirmed</span>
            </div>
            
            {/* Step 3 (Completed) */}
            <div className="flex flex-col items-center relative z-10 gap-2">
              <div className={`size-10 rounded-full flex items-center justify-center transition-colors ${
                currentStatus === 3 ? 'bg-primary text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}>
                <span className="material-symbols-outlined text-xl">key</span>
              </div>
              <span className={`text-xs font-medium ${currentStatus === 3 ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400'}`}>Completed</span>
            </div>
          </div>
        </div>
        
      </div>
    </main>
  );
}
