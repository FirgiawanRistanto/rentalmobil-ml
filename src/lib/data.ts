import { getCarCategoryDisplayLabel, type DisplayCarCategory } from './carCategoryUi';

export interface Car {
  slug: string;
  name: string;
  type: DisplayCarCategory;
  typeCode: number;
  basePrice: number;
  transmission: string;
  capacity: number;
  fuelIncluded: boolean;
  foodIncluded: boolean;
  image: string;
  status: 'available' | 'booked' | 'pending';
  description: string;
}

export interface DbCar {
  id: string;
  slug?: string;
  brand: string;
  model: string;
  category: string;
  year: number;
  transmission?: string;
  capacitySeats?: number;
  basePricePerDay: number;
  isAvailable: boolean;
  imageUrl: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type DisplayCar = Car & {
  id?: string;
};

const placeholderCarImage =
  'https://images.unsplash.com/photo-1549924231-f129b911e442?q=80&w=1200&auto=format&fit=crop';

function inferCapacity(category: Car['type']): number {
  if (category === 'City Car') return 5;
  return 7;
}

function inferTransmission(model: string): string {
  const value = model.toLowerCase();
  if (value.includes('brio') || value.includes('agya')) return 'Automatic';
  if (value.includes('pajero') || value.includes('fortuner')) return 'Automatic';
  return 'Manual';
}

export function mapDbCarToDisplayCar(car: DbCar): DisplayCar {
  const type = getCarCategoryDisplayLabel(car.category);

  return {
    id: car.id,
    slug: car.slug || car.id,
    name: `${car.brand} ${car.model}`,
    type,
    typeCode: type === 'City Car' ? 0 : type === 'MPV' ? 1 : 2,
    basePrice: car.basePricePerDay,
    transmission: car.transmission || inferTransmission(car.model),
    capacity: car.capacitySeats || inferCapacity(type),
    fuelIncluded: true,
    foodIncluded: false,
    image: car.imageUrl || placeholderCarImage,
    status: car.isAvailable ? 'available' : 'booked',
    description: `${car.brand} ${car.model} tahun ${car.year}, kategori ${type}.`,
  };
}

export const cars: Car[] = [
  {
    slug: 'honda-brio',
    name: 'Honda Brio',
    type: 'City Car',
    typeCode: 0,
    basePrice: 350000,
    transmission: 'Automatic',
    capacity: 5,
    fuelIncluded: true,
    foodIncluded: false,
    image: placeholderCarImage,
    status: 'available',
    description: 'City Car ringkas untuk perjalanan dalam kota.',
  },
  {
    slug: 'toyota-agya',
    name: 'Toyota Agya',
    type: 'City Car',
    typeCode: 0,
    basePrice: 325000,
    transmission: 'Automatic',
    capacity: 5,
    fuelIncluded: true,
    foodIncluded: false,
    image: placeholderCarImage,
    status: 'available',
    description: 'City Car ekonomis untuk mobilitas harian.',
  },
  {
    slug: 'toyota-avanza',
    name: 'Toyota Avanza',
    type: 'MPV',
    typeCode: 1,
    basePrice: 450000,
    transmission: 'Manual',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: placeholderCarImage,
    status: 'available',
    description: 'MPV keluarga untuk perjalanan harian dan luar kota.',
  },
  {
    slug: 'mitsubishi-xpander',
    name: 'Mitsubishi Xpander',
    type: 'MPV',
    typeCode: 1,
    basePrice: 550000,
    transmission: 'Manual',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: placeholderCarImage,
    status: 'available',
    description: 'MPV modern dengan kabin lega.',
  },
  {
    slug: 'toyota-innova-reborn',
    name: 'Toyota Innova Reborn',
    type: 'MPV',
    typeCode: 1,
    basePrice: 750000,
    transmission: 'Manual',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: placeholderCarImage,
    status: 'available',
    description: 'MPV nyaman untuk perjalanan keluarga.',
  },
  {
    slug: 'toyota-rush',
    name: 'Toyota Rush',
    type: 'SUV',
    typeCode: 2,
    basePrice: 600000,
    transmission: 'Manual',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: placeholderCarImage,
    status: 'available',
    description: 'SUV kompak untuk perjalanan urban dan luar kota.',
  },
  {
    slug: 'mitsubishi-pajero-sport',
    name: 'Mitsubishi Pajero Sport',
    type: 'SUV',
    typeCode: 2,
    basePrice: 1400000,
    transmission: 'Automatic',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: placeholderCarImage,
    status: 'available',
    description: 'SUV premium untuk perjalanan luar kota.',
  },
  {
    slug: 'toyota-fortuner',
    name: 'Toyota Fortuner',
    type: 'SUV',
    typeCode: 2,
    basePrice: 1500000,
    transmission: 'Automatic',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: placeholderCarImage,
    status: 'available',
    description: 'SUV tangguh dengan kabin nyaman.',
  },
];

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getCarBySlug(slug: string): Car | undefined {
  return cars.find((car) => car.slug === slug);
}
