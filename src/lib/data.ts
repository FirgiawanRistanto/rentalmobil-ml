export interface Car {
  slug: string;
  name: string;
  type: 'MPV' | 'SUV' | 'Van' | 'Premium';
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
  brand: string;
  model: string;
  category: string;
  year: number;
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

function normalizeCategory(category: string): Car['type'] {
  const value = category.toLowerCase();
  if (value.includes('suv')) return 'SUV';
  if (value.includes('van') || value.includes('hiace')) return 'Van';
  if (value.includes('premium') || value.includes('alphard')) return 'Premium';
  return 'MPV';
}

function inferCapacity(category: Car['type'], model: string): number {
  const value = model.toLowerCase();
  if (category === 'Van' || value.includes('hiace')) return 14;
  return 7;
}

function inferTransmission(model: string): string {
  const value = model.toLowerCase();
  if (value.includes('cvt')) return 'CVT';
  if (value.includes('alphard') || value.includes('fortuner')) return 'Automatic';
  return 'Manual';
}

export function mapDbCarToDisplayCar(car: DbCar): DisplayCar {
  const type = normalizeCategory(car.category);

  return {
    id: car.id,
    slug: car.id,
    name: `${car.brand} ${car.model}`,
    type,
    typeCode: type === 'MPV' ? 1 : type === 'SUV' ? 2 : type === 'Van' ? 3 : 4,
    basePrice: car.basePricePerDay,
    transmission: inferTransmission(car.model),
    capacity: inferCapacity(type, car.model),
    fuelIncluded: true,
    foodIncluded: false,
    image: car.imageUrl || placeholderCarImage,
    status: car.isAvailable ? 'available' : 'booked',
    description: `${car.brand} ${car.model} tahun ${car.year}, kategori ${car.category}.`,
  };
}

export const cars: Car[] = [
  {
    slug: 'avanza-facelift',
    name: 'Avanza Facelift',
    type: 'MPV',
    typeCode: 1,
    basePrice: 550000,
    transmission: 'Manual',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2oUX3WeiW7vGHYy5_KzlSk9gbyn5sdJSW9AwWPn51fTvtry1pNKPUgJWjjH59v1kzkwvgdIWZEcWLkzVoZkW7dyXax-DSP3mfP409s3vvkeVXAxA17TYAjdWdMSelaZVVPB0ee5CTqo7W4K4RsSojA57nISnz22A9KbmFRUXQMrIZty7kXvPdkMXb37t3qFYuXbE10AVayEJDVt61q83b5sU_TCrBIILN6x6dAQBZgJp-ezvIxY3Z6zR2958rVoKtmJh4l1xN1A',
    status: 'available',
    description: 'MPV handal dengan efisiensi bahan bakar terbaik.',
  },
  {
    slug: 'grand-xenia',
    name: 'Grand Xenia',
    type: 'MPV',
    typeCode: 1,
    basePrice: 550000,
    transmission: 'Manual',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD50CvH7eWuieKYNdrMi36MlLTQfbOUvA9KscyU6hqQwVv4_Q_esOcl7-66ECDF5TulWyuB_kdzhh7OJQJBSKJkTBUVCpZGMD31mK8nP0yr_Jn132RNR4o5rQY869mjAvPCwjwkyAuM6Rwmx5ovxB6OywDFaUfdDceRKvfzg5h1ejRdF6A6gjGU2xI4JaTul_rPtrK1G815KvBEKaCFOfPvGATJYDFiMU0lw3kYT3iceUN16COu77Qo6Ye2AFjSABu61s0T_HuanA',
    status: 'booked',
    description: 'Nyaman dan praktis untuk berbagai keperluan keluarga.',
  },
  {
    slug: 'avanza-cvt',
    name: 'Avanza CVT',
    type: 'MPV',
    typeCode: 1,
    basePrice: 600000,
    transmission: 'CVT',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA3QdvRKWBfc2mKpfr07OU9UBWlmth9ZVQp7Rwjqq44wDwIwtU8-VuJu9tPESCaPBNZFAtG9SkfSwkHC9nJC_mk9CUtUsDuVXyOYRwtHMZ2htk_N5Hj7hfMzPooO271gWNV5bc7A_UJmUSK102qfGm1v5N1KX7olTAK0eifAe67w9AgE38Xeo-qx_ExrshPolAbAC2X8ZAWiOR8RAXxCmRmHEIrheHv3kvtbQBG0EcKSUTfkGw-Vqa2AWCstuNRKoTOd1mj6vY_MA',
    status: 'available',
    description: 'Transmisi CVT canggih untuk perjalanan anti lelah.',
  },
  {
    slug: 'innova-reborn',
    name: 'Innova Reborn',
    type: 'MPV',
    typeCode: 1,
    basePrice: 750000,
    transmission: 'Manual',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPXiDrGDqhpLHwpJRhesMX1J9fX_hyA3V-P6_A7M2P-fkb43QYp7vFkfkki6cWBfPuM-nHdZ6gqZCccQSJwwYFDaDMZYxisnprl9a2Bz3W4nKxrvT6D_cdGgwxWvb8ikEXlz6eXmfHgSgPePGtD9_PkpR4bwmCdNXmpIahT4C_trVnaVDyAIKGGQCgb9Q0cL7fzzBchWajoxbimgVSIHlDO6lAx3E2XjLWKmp3vO0My2OeXH41QJpBBHlQJph_wz0Yp0YIyNKeWA',
    status: 'pending',
    description: 'Seri legendaris untuk kenyamanan tiada tanding perjalanan Anda.',
  },
  {
    slug: 'rush',
    name: 'Toyota Rush',
    type: 'SUV',
    typeCode: 2,
    basePrice: 650000,
    transmission: 'Manual',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCuiMiuB6cah-j7XcGrTrnynRd_2X2kZeMer4Ka-A1RUjTzg4SXbndJxktpB4aiKmhCqFRp54ggHbd51DbSBUzTW5N_yhVvFe0S4pGN9n60iCFtKN1GW3Y5eYUu3HWsBeSkuZH18Aq22tAGfM94UgK3FvKZheDhjOjr7jk8DAnR66y0RCPByWin7HMSxARmJlOzloKIoTrb6RYVH_RLCPs5H4bv1rJrxvb8rUHYxv1s_nUJItFvDJqAwAd1_0PP-9XbhUd7O5TPHg',
    status: 'available',
    description: 'SUV maskulin dengan fleksibilitas jalanan urban maupun luar kota.',
  },
  {
    slug: 'fortuner',
    name: 'Fortuner VRZ',
    type: 'SUV',
    typeCode: 2,
    basePrice: 1500000,
    transmission: 'Automatic',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBap9TAzHowbep8UOgeepQU42mv4FyogeiLxbF301y7yDQqTf6IAFpY_B4A20d5Dn9l_LgDmKHqx__JFx1hzGm8d3qOU5PWHB5NBuvL5amvTUICtdWTp2M5jKqeq4yB2NLgpr0ITBHmmOXQN6RWYVqAme81sZQwF0xK_rxoOoD768ro4-K2w5VJHYtTeliiJFKYVUU4V5pjOaHKnqXFWcJz3YnVws77fYh1v1su91DC22hL_YVrMwjuGnpZPwIav_DoZzOGoaEu7Q',
    status: 'available',
    description: 'Langgengkan presensi berkelas dengan SUV tangguh ini.',
  },
  {
    slug: 'hiace-commuter',
    name: 'Toyota Hiace',
    type: 'Van',
    typeCode: 3,
    basePrice: 1500000,
    transmission: 'Manual',
    capacity: 14,
    fuelIncluded: true,
    foodIncluded: false,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDE4l3Q-iEKW-x0PrJVY_SXoelhib0APqz3c_4706DLWZSgOs7xtME_JzSQz3PHCt4kEQU0anttPNZto_x2LPdhmwrd89yzT2HL07hIROQL4416bL4BVvritsxQ_gxbYRgTh5N5PIu691WtNA-5HFCTIBIASxo0ZKH823i9KZ5F4S5HakyiNuh4BklAdl4RjvIfVMpcakwzaVRmYg3f-DeAq3VvMt4sMWKZPeylKH3-xQJ3i6yShOB7h3DxI9NkzPlZNcKnUE914g',
    status: 'available',
    description: 'Minibus paling ideal untuk mengangkut jumlah massa medium/besar.',
  },
  {
    slug: 'toyota-alphard',
    name: 'Toyota Alphard',
    type: 'Premium',
    typeCode: 4,
    basePrice: 3500000,
    transmission: 'Automatic',
    capacity: 7,
    fuelIncluded: true,
    foodIncluded: false,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBFSQc9AccIPpm6ePHI4pY2QmZLH1kvdae0vv1aMBK3MqaFsTkEpePlX4ktDDljuNPw2sOgHj5BF0NTmOADWlCryHC-fT4o0qLNGXV-cL-maIf7cAnnD3KHl8xEiAj39U_h8FQuRqY2utXiuxggGEM8Da1z3q67zXXC4vACm1w4YZ9L9RyFqAIOJX30MXzrol7c9MbVKQnLqXh6Pfjl3dQjfy-Qv9kPRan_aMtOheQW7W_8cXhIBCpb3QAXrCQ9zJpAhfMmZIh0Q',
    status: 'available',
    description: 'MPV kelas Sultan dengan kemudahan bak singgasana darat yang mewah berjalan mulus.',
  }
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
