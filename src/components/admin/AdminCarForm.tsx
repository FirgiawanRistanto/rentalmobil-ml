'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getCarCategoryDisplayLabel } from '@/lib/carCategoryUi';
import type { AdminCarCategory, AdminCarListItem, AdminCarTransmission } from '@/services/adminCarsService';

const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface AdminCarFormProps {
  mode: 'create' | 'edit';
  carId?: string;
}

interface FormState {
  name: string;
  category: AdminCarCategory;
  year: number;
  transmission: AdminCarTransmission;
  capacitySeats: number;
  basePricePerDay: number;
  isAvailable: boolean;
  initialPlateNumber: string;
}

const defaultFormState: FormState = {
  name: '',
  category: 'mpv',
  year: new Date().getFullYear(),
  transmission: 'Manual',
  capacitySeats: 7,
  basePricePerDay: 450000,
  isAvailable: true,
  initialPlateNumber: '',
};

function normalizeTransmission(value: string): AdminCarTransmission {
  if (value === 'Automatic') return 'Otomatis';
  if (value === 'Otomatis' || value === 'Manual' || value === 'Hybrid') return value;
  return 'Manual';
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export default function AdminCarForm({ mode, carId }: AdminCarFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [existingCar, setExistingCar] = useState<AdminCarListItem | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'edit' || !carId) return;

    async function loadCar() {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/cars/${carId}`);
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, 'Data mobil belum dapat dibaca.'));
        }

        const car = await response.json() as AdminCarListItem;
        setExistingCar(car);
        setForm({
          name: car.name,
          category: car.category,
          year: car.year,
          transmission: normalizeTransmission(car.transmission),
          capacitySeats: car.capacitySeats,
          basePricePerDay: car.basePricePerDay,
          isAvailable: car.isAvailable,
          initialPlateNumber: '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Data mobil belum dapat dibaca.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadCar();
  }, [carId, mode]);

  function handleImageChange(file: File | null) {
    setError('');
    if (!file) {
      setImageFile(null);
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageFile(null);
      setError('Format gambar harus JPG, PNG, atau WEBP.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageFile(null);
      setError('Ukuran gambar maksimal 3 MB.');
      return;
    }

    setImageFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.set('name', form.name);
    formData.set('category', form.category);
    formData.set('year', String(form.year));
    formData.set('transmission', form.transmission);
    formData.set('capacitySeats', String(form.capacitySeats));
    formData.set('basePricePerDay', String(form.basePricePerDay));
    formData.set('isAvailable', String(form.isAvailable));
    if (mode === 'edit' && existingCar?.slug) {
      formData.set('slug', existingCar.slug);
      if (existingCar.imageUrl) {
        formData.set('imageUrl', existingCar.imageUrl);
      }
    }
    if (mode === 'create' && form.initialPlateNumber.trim()) {
      formData.set('initialPlateNumber', form.initialPlateNumber);
    }
    if (imageFile) {
      formData.set('imageFile', imageFile);
    }

    try {
      const response = await fetch(
        mode === 'edit' && carId ? `/api/admin/cars/${carId}` : '/api/admin/cars',
        {
          method: mode === 'edit' ? 'PATCH' : 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Data mobil belum berhasil disimpan.'));
      }

      router.push('/admin/mobil');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data mobil belum berhasil disimpan.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-4 py-8 md:p-8">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-6">
            <button
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
              onClick={() => router.push('/admin/mobil')}
              type="button"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Kembali ke Manajemen Mobil
            </button>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {mode === 'edit' ? 'Edit Mobil' : 'Tambah Mobil'}
            </h2>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {mode === 'edit'
                ? 'Perubahan harga dasar hanya berlaku untuk quote baru dan tidak mengubah snapshot lama.'
                : 'Slug dibuat otomatis dari nama mobil. Gambar disimpan sebagai aset demo lokal.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Memuat data mobil...
            </div>
          ) : (
            <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Nama Mobil">
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                    required
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </Field>

                {existingCar && (
                  <Field label="Slug">
                    <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                      /{existingCar.slug}
                    </div>
                  </Field>
                )}

                <Field label="Kategori">
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as AdminCarCategory }))}
                  >
                    <option value="passenger_car">{getCarCategoryDisplayLabel('passenger_car')}</option>
                    <option value="mpv">MPV</option>
                    <option value="suv">SUV</option>
                  </select>
                </Field>

                <Field label="Transmisi">
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                    value={form.transmission}
                    onChange={(event) => setForm((current) => ({ ...current, transmission: event.target.value as AdminCarTransmission }))}
                  >
                    <option value="Otomatis">Otomatis</option>
                    <option value="Manual">Manual</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </Field>

                <Field label="Tahun">
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                    min={1990}
                    required
                    type="number"
                    value={form.year}
                    onChange={(event) => setForm((current) => ({ ...current, year: Number(event.target.value) }))}
                  />
                </Field>

                <Field label="Kapasitas Kursi">
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                    min={1}
                    required
                    type="number"
                    value={form.capacitySeats}
                    onChange={(event) => setForm((current) => ({ ...current, capacitySeats: Number(event.target.value) }))}
                  />
                </Field>

                <Field label="Harga Dasar per Hari">
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                    min={1}
                    required
                    type="number"
                    value={form.basePricePerDay}
                    onChange={(event) => setForm((current) => ({ ...current, basePricePerDay: Number(event.target.value) }))}
                  />
                </Field>

                <Field label="Status Katalog">
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                    value={form.isAvailable ? 'active' : 'inactive'}
                    onChange={(event) => setForm((current) => ({ ...current, isAvailable: event.target.value === 'active' }))}
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </Field>

                {mode === 'create' && (
                  <Field label="Plat Unit Awal (Opsional)">
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                      value={form.initialPlateNumber}
                      onChange={(event) => setForm((current) => ({ ...current, initialPlateNumber: event.target.value }))}
                    />
                  </Field>
                )}

                <Field label="Gambar Mobil">
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                    type="file"
                    onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1 text-xs text-slate-500">JPG, PNG, atau WEBP. Maksimal 3 MB.</p>
                </Field>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Menyimpan...' : mode === 'edit' ? 'Simpan Perubahan' : 'Tambah Mobil'}
                </button>
                <button
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  onClick={() => router.push('/admin/mobil')}
                  type="button"
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}
