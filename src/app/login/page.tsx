'use client';

import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark antialiased">
      {/* Left Side: Professional Image & Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary/40 z-10"></div>
        <div 
          className="absolute inset-0 bg-cover bg-center" 
          style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB2gUcSYv-OLRzo48CKNde7fyCGnSDvKgVSvG_LTmNlNRcXfXk09AqPkCmtAdx9b_226dj8_Iq5syYVUn2jHb9LN95XX0lcHEu1ceVHvSYRFQB3GXftqoA64Zob5NFjW6XG7ggJN07S7rNyysYHzfiz9N0Vl8K5-EUH-szY--NCd9MEkU7SW9jlCUcvDyjbGQNy6pPlprgQic6t-eg79APw4DYfgSP6ir9xs7QEsLnz2PqIEVz82OUo84vKnnFWWvLcLZp5PbLTGw')" }}
        />
        <div className="relative z-20 flex flex-col justify-between p-12 w-full h-full text-white">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <div className="bg-white p-2 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-3xl font-bold">directions_car</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">Besan Rental</span>
          </Link>
          <div>
            <h1 className="text-5xl font-black leading-tight mb-6">Layanan Rental Mobil Premium di Lampung</h1>
            <p className="text-lg text-slate-200 max-w-md">Nikmati kenyamanan dan kemewahan dengan berbagai pilihan kendaraan kami yang disesuaikan untuk kebutuhan profesional dan pribadi Anda.</p>
          </div>
          <div className="flex gap-8 text-sm text-slate-300">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-white text-base">verified</span> Armada Terverifikasi</div>
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-white text-base">support_agent</span> Layanan 24/7</div>
          </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-20 bg-background-light dark:bg-background-dark">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile Logo */}
          <Link href="/" className="lg:hidden flex items-center gap-3 mb-10 w-fit">
            <div className="bg-primary p-2 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">directions_car</span>
            </div>
            <span className="text-xl font-bold text-primary dark:text-white">Besan Rental</span>
          </Link>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Selamat datang kembali</h2>
            <p className="text-slate-600 dark:text-slate-400">Silakan masukkan detail Anda untuk mengakses akun</p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={(e) => { e.preventDefault(); window.location.href = '/katalog'; }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="email">Alamat Email</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">mail</span>
                  <input autoComplete="email" className="block w-full rounded-lg border border-slate-200 bg-white px-10 py-3 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:text-sm outline-none transition-colors" id="email" name="email" placeholder="name@company.com" required type="email"/>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">Kata Sandi</label>
                  <a className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors" href="#">Lupa kata sandi?</a>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">lock</span>
                  <input autoComplete="current-password" className="block w-full rounded-lg border border-slate-200 bg-white px-10 py-3 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:text-sm outline-none transition-colors" id="password" name="password" placeholder="••••••••" required type="password"/>
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" type="button">
                    <span className="material-symbols-outlined text-xl">visibility</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              <input className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800" id="remember-me" name="remember-me" type="checkbox"/>
              <label className="ml-2 block text-sm text-slate-700 dark:text-slate-300" htmlFor="remember-me">Ingat saya selama 30 hari</label>
            </div>
            
            <div className="space-y-4">
              <button className="group relative flex w-full justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:-translate-y-0.5 active:scale-95" type="submit">
                Masuk
              </button>
              
              <div className="relative">
                <div aria-hidden="true" className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background-light dark:bg-background-dark px-2 text-slate-500">Atau lanjut dengan</span>
                </div>
              </div>
              
              <button className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors" type="button">
                <img alt="google logo" className="h-5 w-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBPWzMzOamAzwurtQ0SENeMZf12etqjB2B1FyuR7oFGtsMvT4g3621IVZoQUVC4QWX8ohtuM7zGdQegho_FaNmqfSmuMgeo7DZ4IDWTx-baRNeEF_l-rsqDmW4AkOEXbpcRWatX84ZpmCT45UTXPlzMFeXR8nPgFBxwFZ9VUZLIyS1a3IEsAjYp_m72Hr_S7m9mvVuVhIiG8ysMtaHbLrDhoz4SBRXAFn5rAig5pnTKyY7XNwefvLkOdh33HJt-j89ENu6bpT4yng"/>
                Google
              </button>
            </div>
          </form>
          
          <p className="mt-10 text-center text-sm text-slate-600 dark:text-slate-400">
            Belum punya akun? <Link className="font-bold text-primary hover:text-primary/80 transition-colors ml-1" href="/register">Daftar akun baru</Link>
          </p>
          
          <div className="pt-8 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-center gap-6">
              <Link className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" href="#">Kebijakan Privasi</Link>
              <Link className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" href="#">Ketentuan Layanan</Link>
              <Link className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" href="#">Hubungi Kami</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
