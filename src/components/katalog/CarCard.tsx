import Link from 'next/link';
import { DisplayCar } from '@/lib/data';

interface CarCardProps {
  car: DisplayCar;
}

export default function CarCard({ car }: CarCardProps) {
  const isAvailable = car.status === 'available';
  const isBooked = car.status === 'booked';
  
  // Format short price (e.g. 550000 -> 550k, 1500000 -> 1.5M)
  const formatShortPrice = (price: number) => {
    if (price >= 1000000) {
      return `Rp ${price / 1000000}M`;
    }
    return `Rp ${price / 1000}k`;
  };

  return (
    <div className={`group flex flex-col bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 transition-all ${isBooked ? 'opacity-80' : 'hover:shadow-xl'}`}>
      <div className="relative w-full aspect-[4/3] bg-slate-200 overflow-hidden">
        <div 
          className={`w-full h-full bg-center bg-cover ${isBooked ? 'grayscale' : 'transition-transform duration-500 group-hover:scale-110'}`} 
          style={{ backgroundImage: `url("${car.image}")` }}
        />
        
        {car.status === 'available' && (
          <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">Available</div>
        )}
        {car.status === 'booked' && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">Booked</div>
        )}
        {car.status === 'pending' && (
          <div className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">Pending</div>
        )}
      </div>
      
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-slate-900 dark:text-white text-lg font-bold">{car.name}</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{car.type} • {car.transmission} • {car.capacity} Seater</p>
        
        <div className="mt-4 flex items-center justify-between">
          <p className="text-primary dark:text-blue-400 font-bold text-lg">
            {formatShortPrice(car.basePrice)}<span className="text-xs text-slate-400 font-normal">/hari</span>
          </p>
        </div>
        
        {isAvailable ? (
          <Link href={`/katalog/${car.id ?? car.slug}`} className="mt-5 w-full flex items-center justify-center py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white text-sm font-bold rounded-lg transition-all">
            Lihat Detail
          </Link>
        ) : isBooked ? (
          <button className="mt-5 w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-sm font-bold rounded-lg cursor-not-allowed" disabled>
            Tidak Tersedia
          </button>
        ) : (
          <Link href={`/katalog/${car.id ?? car.slug}`} className="mt-5 w-full flex items-center justify-center py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Cek Status
          </Link>
        )}
      </div>
    </div>
  );
}
