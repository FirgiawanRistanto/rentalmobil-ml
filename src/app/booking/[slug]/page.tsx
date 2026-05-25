'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DbCar, DisplayCar, getCarBySlug, formatRupiah, mapDbCarToDisplayCar } from '@/lib/data';

function ProgressBar({ step, isCentered = false }: { step: number; isCentered?: boolean }) {
  return (
    <div className={`flex flex-col w-full ${isCentered ? 'max-w-3xl mx-auto' : ''}`}>
      <div className="relative flex items-center justify-between mb-2">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 -z-10 rounded-full"></div>
        <div 
          className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 -z-10 rounded-full transition-all duration-500" 
          style={{ width: step === 0 ? '0%' : step === 1 ? '50%' : '100%' }}
        ></div>
        
        <div className="flex flex-col items-center">
          <div className={`size-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${step >= 0 ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
             {step > 0 ? <span className="material-symbols-outlined text-[18px]">done</span> : '1'}
          </div>
        </div>
        
        <div className="flex flex-col items-center">
          <div className={`size-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${step >= 1 ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
             {step > 1 ? <span className="material-symbols-outlined text-[18px]">done</span> : '2'}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className={`size-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${step >= 2 ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
             3
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-1">
        <span className={`text-xs md:text-sm font-bold ${step >= 0 ? 'text-primary' : 'text-slate-500'}`}>Detail Sewa</span>
        <span className={`text-xs md:text-sm ${step >= 1 ? 'text-primary font-bold' : 'text-slate-500 font-medium'}`}>Info Penjemputan</span>
        <span className={`text-xs md:text-sm ${step >= 2 ? 'text-primary font-bold' : 'text-slate-500 font-medium'}`}>Ringkasan</span>
      </div>
      
      {!isCentered && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-bold text-primary">Progres {step === 0 ? 'Pesanan' : step === 1 ? 'Penjemputan' : 'Selesai'}</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{step === 0 ? '33%' : step === 1 ? '66%' : '100%'}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
             <div className="h-full bg-primary transition-all duration-500" style={{ width: step === 0 ? '33%' : step === 1 ? '66%' : '100%' }}></div>
          </div>
        </>
      )}
    </div>
  );
}

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [car, setCar] = useState<DisplayCar | null>(null);
  const [isCarLoading, setIsCarLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  // Form state
  const [destinationType, setDestinationType] = useState('Dalam Kota');
  const [driverService, setDriverService] = useState('Dengan Sopir Profesional');
  const [pickupAddress, setPickupAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchCar() {
      setIsCarLoading(true);
      try {
        const response = await fetch(`/api/cars/${slug}`);
        if (response.ok) {
          const data = (await response.json()) as DbCar;
          setCar(mapDbCarToDisplayCar(data));
          return;
        }

        const staticCar = getCarBySlug(slug);
        setCar(staticCar ?? null);
      } catch {
        const staticCar = getCarBySlug(slug);
        setCar(staticCar ?? null);
      } finally {
        setIsCarLoading(false);
      }
    }

    fetchCar();
  }, [slug]);

  if (isCarLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Memuat data booking dari database...</p>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Mobil tidak ditemukan</p>
      </div>
    );
  }

  // Simulated booking data
  const startDateStr = '18 Mar 2026';
  const endDateStr = '20 Mar 2026';
  const duration = 3;
  
  // Calculate pricing logic (simulated)
  const pricePerDay = car.basePrice;
  const subtotal = pricePerDay * duration;
  const serviceFee = 25000;
  const totalPrice = subtotal + serviceFee;

  const handleSubmit = () => {
    // Redirect to payment page
    window.location.href = '/payment/BRN-0042';
  };

  return (
    <main className="flex-1 px-4 py-8 md:px-12 lg:px-20 min-h-screen bg-background-light dark:bg-background-dark max-w-7xl mx-auto w-full">
      {currentStep < 2 ? (
        <>
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              Booking {currentStep === 0 ? 'Step 1 - Rental Details' : 'Step 2 - Pickup Info'}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT COLUMN (Form + Progress) */}
            <div className="lg:col-span-8 flex flex-col gap-8">
              <ProgressBar step={currentStep} />

              <div className="animate-fade-in flex flex-col gap-6">
                {currentStep === 0 && (
                  <>
                    <section className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">info</span>
                        Detail Tambahan
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tujuan Perjalanan</label>
                          <select 
                            value={destinationType}
                            onChange={(e) => setDestinationType(e.target.value)}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-transparent py-3 px-4 focus:ring-primary focus:border-primary text-slate-900 dark:text-white outline-none"
                          >
                            <option>Dalam Kota</option>
                            <option>Luar Kota (Area Provinsi)</option>
                            <option>Antar Provinsi</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Layanan Sopir</label>
                          <select 
                            value={driverService}
                            onChange={(e) => setDriverService(e.target.value)}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-transparent py-3 px-4 focus:ring-primary focus:border-primary text-slate-900 dark:text-white outline-none"
                          >
                            <option>Dengan Sopir Profesional</option>
                            <option>Lepas Kunci (Tanpa Sopir)</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10 flex items-start gap-3">
                        <span className="material-symbols-outlined text-primary mt-0.5">help</span>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          Lanjutkan ke langkah berikutnya untuk menentukan titik penjemputan armada. Harga yang tertera pada ringkasan pesanan sudah termasuk perlindungan asuransi dasar.
                        </p>
                      </div>
                    </section>
                    
                    <div className="flex items-center justify-between">
                      <Link href={`/katalog/${slug}`} className="flex items-center gap-2 px-6 py-3 font-bold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                        Kembali
                      </Link>
                      <button 
                        onClick={() => setCurrentStep(1)}
                        className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5"
                      >
                        Lanjut ke Penjemputan
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </button>
                    </div>
                  </>
                )}

                {currentStep === 1 && (
                  <>
                    <section className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-8">
                        <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Detail Penjemputan</h3>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Alamat Penjemputan</label>
                          <textarea
                            value={pickupAddress}
                            onChange={(e) => setPickupAddress(e.target.value)}
                            placeholder="Masukkan alamat lengkap penjemputan (Hotel, Bandara, atau Rumah)"
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none placeholder:text-slate-400"
                          />
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nomor WhatsApp/HP</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                              <span className="material-symbols-outlined text-lg">call</span>
                            </div>
                            <input
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="0812xxxxxx"
                              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Catatan Khusus (Opsional)</label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Contoh: Tolong bawa papan nama, penjemputan di Gate 3"
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                    </section>
                    
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => setCurrentStep(0)}
                        className="flex items-center gap-2 px-6 py-3 font-bold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Kembali
                      </button>
                      <button 
                        onClick={() => setCurrentStep(2)}
                        disabled={!pickupAddress || !phoneNumber}
                        className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 disabled:hover:translate-y-0"
                      >
                        Lanjut ke Ringkasan
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN (Sticky Summary) */}
            <div className="lg:col-span-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden sticky top-24">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Ringkasan Pesanan</h3>
                </div>
                
                <div className="p-6">
                  <div className="w-full aspect-video rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden mb-4">
                    <img alt={car.name} className="object-cover w-full h-full" src={car.image} />
                  </div>
                  
                  <h4 className="text-lg font-bold text-primary mb-2">{car.name}</h4>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-8">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">person</span> {car.capacity} Kursi</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">settings</span> {car.transmission}</span>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Durasi Sewa</span>
                      <span className="font-bold text-slate-900 dark:text-white">{duration} Hari</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Harga per Hari</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatRupiah(pricePerDay)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Biaya Layanan</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatRupiah(serviceFee)}</span>
                    </div>
                  </div>
                  
                </div>
                
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-slate-900 dark:text-white">Total Pembayaran</span>
                    <span className="font-black text-xl text-primary">{formatRupiah(totalPrice)}</span>
                  </div>
                  <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-lg text-[10px] sm:text-xs">
                    <span className="material-symbols-outlined text-sm shrink-0">verified_user</span>
                    <p>Harga sudah termasuk asuransi dasar dan layanan darurat 24 jam.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* STEP 3 - FULL WIDTH SUMMARY LAYOUT */
        <div className="max-w-4xl mx-auto w-full animate-fade-in flex flex-col gap-10">
          <div className="text-center mb-2">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-3">
              Booking Step 3 - Summary &amp; Confirm
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Please review your booking details before proceeding to payment.
            </p>
          </div>

          <ProgressBar step={2} isCentered={true} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Car Details Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">directions_car</span>
                Car Details
              </h3>
              <div className="w-full aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden mb-4">
                <img alt={car.name} className="object-cover w-full h-full" src={car.image} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{car.name}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{car.type} • {driverService}</p>
              
              <div className="flex flex-wrap gap-3 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">person</span> {car.capacity} Seats
                </span>
                <span className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">settings</span> {car.transmission}
                </span>
                <span className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">local_gas_station</span> Included
                </span>
              </div>
            </div>

            {/* Rental Details Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">event</span>
                  Rental Period
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 mb-1">Pick-up</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{startDateStr}</p>
                    <p className="text-xs text-slate-500">09:00 WIB</p>
                  </div>
                  <div className="w-8 border-b-2 border-dashed border-slate-300 dark:border-slate-700 relative">
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] bg-white dark:bg-slate-900 px-1 text-slate-400">{duration}D</span>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-xs text-slate-500 mb-1">Drop-off</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{endDateStr}</p>
                    <p className="text-xs text-slate-500">23:59 WIB</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">location_on</span>
                  Pickup Information
                </h3>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Address</p>
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{pickupAddress}</p>
                
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Contact</p>
                <p className="text-sm text-slate-500">{phoneNumber}</p>
              </div>
            </div>
          </div>

          {/* Order Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">receipt_long</span>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Order Summary</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">Rental Cost ({formatRupiah(pricePerDay)} × {duration} Days)</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">Service Fee</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatRupiah(serviceFee)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">Deposit / DP</span>
                <span className="font-bold text-slate-900 dark:text-white">Rp 0</span>
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-white text-lg">Total Payment</span>
                <span className="font-black text-2xl text-primary">{formatRupiah(totalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Alert Box */}
          <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/50 rounded-xl p-5 flex items-start gap-4">
            <div className="bg-yellow-100 dark:bg-yellow-600/20 text-yellow-600 dark:text-yellow-500 rounded-full p-1.5 shrink-0">
              <span className="material-symbols-outlined text-[20px]">warning</span>
            </div>
            <div>
              <p className="text-sm font-bold text-yellow-800 dark:text-yellow-500 mb-1">Important Notice</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-600/80 leading-relaxed">
                Make sure all detailed information provided is correct. Prices shown are the final total including basic insurance protection. Once confirmed, you will be redirected to upload payment proof.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row shadow-sm gap-4 items-center justify-end mt-4">
            <button 
              onClick={() => setCurrentStep(1)}
              className="w-full sm:w-auto px-8 py-3.5 font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-primary px-10 py-3.5 text-white font-bold text-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5"
            >
              Confirm Booking
              <span className="material-symbols-outlined">check_circle</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
