'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getCarCategoryDisplayLabel } from '@/lib/carCategoryUi';
import { formatRupiah } from '@/lib/data';
import type {
  AdminCarCategory,
  AdminCarListItem,
  AdminCarsListResponse,
  AdminCarUnitStatus,
} from '@/services/adminCarsService';

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json() as { error?: { message?: string } };
      return body.error?.message || fallback;
    }

    const text = await response.text();
    return text.trim() || `${fallback} (HTTP ${response.status})`;
  } catch {
    return `${fallback} (HTTP ${response.status})`;
  }
}

export default function AdminMobilPage() {
  const [data, setData] = useState<AdminCarsListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AdminCarCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [unitPlateByCarId, setUnitPlateByCarId] = useState<Record<string, string>>({});
  const [unitStatusByCarId, setUnitStatusByCarId] = useState<Record<string, AdminCarUnitStatus>>({});
  const [creatingUnitCarId, setCreatingUnitCarId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editedPlateNumber, setEditedPlateNumber] = useState('');
  const [editedUnitStatus, setEditedUnitStatus] = useState<AdminCarUnitStatus>('ACTIVE');
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);
  const [unitErrorByCarId, setUnitErrorByCarId] = useState<Record<string, string>>({});
  const [unitMessageByCarId, setUnitMessageByCarId] = useState<Record<string, string>>({});

  async function loadCars() {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/cars');
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Data mobil belum dapat dibaca.'));
      }
      setData(await response.json() as AdminCarsListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data mobil belum dapat dibaca.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCars();
  }, []);

  const filteredCars = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (data?.cars ?? []).filter((car) => {
      const matchesSearch = !normalizedSearch ||
        car.name.toLowerCase().includes(normalizedSearch) ||
        car.slug.toLowerCase().includes(normalizedSearch) ||
        car.units.some((unit) => unit.plateNumber.toLowerCase().includes(normalizedSearch));
      const matchesCategory = categoryFilter === 'ALL' || car.category === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? car.isAvailable : !car.isAvailable);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, data?.cars, search, statusFilter]);

  async function deactivateCar(carId: string) {
    const result = await Swal.fire({
      title: 'Nonaktifkan mobil?',
      text: 'Mobil akan disembunyikan dari katalog customer, tetapi data historis tetap aman.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Nonaktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    setError('');
    setMessage('');
    const response = await fetch(`/api/admin/cars/${carId}/deactivate`, { method: 'POST' });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Mobil belum berhasil dinonaktifkan.'));
      return;
    }
    setMessage('Mobil berhasil dinonaktifkan dari katalog customer.');
    await loadCars();
  }

  async function deleteCar(carId: string) {
    const result = await Swal.fire({
      title: 'Hapus mobil permanen?',
      text: 'Mobil akan dihapus permanen jika belum memiliki riwayat transaksi. Jika sudah memiliki riwayat, gunakan Nonaktifkan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    setError('');
    setMessage('');
    const response = await fetch(`/api/admin/cars/${carId}`, { method: 'DELETE' });
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Mobil belum berhasil dihapus.'));
      return;
    }
    setMessage('Mobil berhasil dihapus permanen dari katalog.');
    await loadCars();
  }

  async function createUnit(car: AdminCarListItem) {
    if (creatingUnitCarId) return;

    const carId = car.id;
    const plateNumber = unitPlateByCarId[carId]?.trim().toUpperCase();
    if (!plateNumber) {
      setUnitErrorByCarId((current) => ({ ...current, [carId]: 'Nomor plat unit mobil wajib diisi.' }));
      return;
    }
    const duplicated = car.units.some((unit) => unit.plateNumber.trim().toUpperCase() === plateNumber);
    if (duplicated) {
      setUnitErrorByCarId((current) => ({ ...current, [carId]: 'Nomor plat unit sudah digunakan pada mobil ini.' }));
      return;
    }

    setError('');
    setUnitErrorByCarId((current) => ({ ...current, [carId]: '' }));
    setUnitMessageByCarId((current) => ({ ...current, [carId]: '' }));
    setCreatingUnitCarId(carId);
    const response = await fetch(`/api/admin/cars/${carId}/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateNumber,
        status: unitStatusByCarId[carId] ?? 'ACTIVE',
      }),
    });
    if (!response.ok) {
      const errorMessage = await readErrorMessage(response, 'Unit mobil belum berhasil ditambahkan.');
      setUnitErrorByCarId((current) => ({
        ...current,
        [carId]: errorMessage,
      }));
      setCreatingUnitCarId(null);
      return;
    }
    setUnitPlateByCarId((current) => ({ ...current, [carId]: '' }));
    setUnitStatusByCarId((current) => ({ ...current, [carId]: 'ACTIVE' }));
    setUnitMessageByCarId((current) => ({ ...current, [carId]: 'Unit mobil berhasil ditambahkan.' }));
    setCreatingUnitCarId(null);
    await loadCars();
  }

  function startEditUnit(unitId: string, plateNumber: string, status: AdminCarUnitStatus) {
    setEditingUnitId(unitId);
    setEditedPlateNumber(plateNumber);
    setEditedUnitStatus(status);
    setUnitErrorByCarId({});
    setUnitMessageByCarId({});
  }

  function cancelEditUnit() {
    setEditingUnitId(null);
    setEditedPlateNumber('');
    setEditedUnitStatus('ACTIVE');
  }

  async function updateUnit(
    car: AdminCarListItem,
    unitId: string,
    plateNumber: string,
    status: AdminCarUnitStatus,
    options: { keepEditingOnError?: boolean; successMessage?: string } = {},
  ) {
    if (savingUnitId) return;

    const unit = car.units.find((item) => item.id === unitId);
    if (!unit) return;

    const normalizedPlateNumber = plateNumber.trim().toUpperCase();
    if (!normalizedPlateNumber) {
      setUnitErrorByCarId((current) => ({ ...current, [car.id]: 'Nomor plat unit mobil wajib diisi.' }));
      return;
    }

    const duplicated = car.units.some((item) =>
      item.id !== unitId && item.plateNumber.trim().toUpperCase() === normalizedPlateNumber
    );
    if (duplicated) {
      setUnitErrorByCarId((current) => ({ ...current, [car.id]: 'Nomor plat unit sudah digunakan pada mobil ini.' }));
      return;
    }

    setSavingUnitId(unitId);
    setUnitErrorByCarId((current) => ({ ...current, [car.id]: '' }));
    setUnitMessageByCarId((current) => ({ ...current, [car.id]: '' }));
    const response = await fetch(`/api/admin/cars/${car.id}/units/${unitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plateNumber: normalizedPlateNumber, status }),
    });
    if (!response.ok) {
      const errorMessage = await readErrorMessage(response, 'Unit mobil belum berhasil diperbarui.');
      setUnitErrorByCarId((current) => ({
        ...current,
        [car.id]: errorMessage,
      }));
      setSavingUnitId(null);
      return;
    }
    if (editingUnitId === unitId && !options.keepEditingOnError) {
      setEditingUnitId(null);
      setEditedPlateNumber('');
      setEditedUnitStatus('ACTIVE');
    }
    setUnitMessageByCarId((current) => ({
      ...current,
      [car.id]: options.successMessage ?? 'Unit mobil berhasil diperbarui.',
    }));
    setSavingUnitId(null);
    await loadCars();
  }

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-black leading-tight text-slate-900 dark:text-white">Manajemen Mobil</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kelola data mobil, unit fisik, dan status katalog untuk dynamic pricing.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90"
            href="/admin/mobil/tambah"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Tambah Mobil
          </Link>
        </header>

        <div className="px-4 py-6 md:p-6">
        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {message}
          </div>
        )}

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            ['Total Mobil', data?.summary.totalCars ?? 0],
            ['Total Unit', data?.summary.totalUnits ?? 0],
            ['ACTIVE', data?.summary.activeUnits ?? 0],
            ['MAINTENANCE', data?.summary.maintenanceUnits ?? 0],
            ['INACTIVE', data?.summary.inactiveUnits ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white md:text-3xl">{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
              placeholder="Cari nama, slug, atau plat unit..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as 'ALL' | AdminCarCategory)}
            >
              <option value="ALL">Semua Kategori</option>
              <option value="passenger_car">City Car</option>
              <option value="mpv">MPV</option>
              <option value="suv">SUV</option>
            </select>
            <select
              className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            >
              <option value="ALL">Semua Status Katalog</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Memuat data mobil...
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Belum ada mobil sesuai filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            {filteredCars.map((car) => (
              <article key={car.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 xl:flex-row">
                  <div className="h-32 w-full shrink-0 overflow-hidden rounded-lg bg-slate-100 xl:w-44 dark:bg-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={car.name}
                      className="h-full w-full object-cover"
                      src={car.imageUrl || 'https://images.unsplash.com/photo-1549924231-f129b911e442?q=80&w=1200&auto=format&fit=crop'}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-xl font-black text-slate-900 dark:text-white">{car.name}</h3>
                        <p className="truncate text-xs font-semibold text-slate-500">/{car.slug}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${car.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {car.isAvailable ? 'Katalog Aktif' : 'Nonaktif'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                      <Info label="Kategori" value={getCarCategoryDisplayLabel(car.category)} />
                      <Info label="Tahun" value={String(car.year)} />
                      <Info label="Kapasitas" value={`${car.capacitySeats} kursi`} />
                      <Info label="Harga" value={formatRupiah(car.basePricePerDay)} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50" href={`/admin/mobil/${car.id}/edit`}>
                        Edit Mobil
                      </Link>
                      <button className="rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => deactivateCar(car.id)} type="button">
                        Nonaktifkan
                      </button>
                      <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50" onClick={() => deleteCar(car.id)} type="button">
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">Unit Mobil</h4>
                    <div className="flex max-w-full flex-wrap gap-2">
                      <input
                        className="w-36 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800"
                        placeholder="Plat nomor"
                        value={unitPlateByCarId[car.id] ?? ''}
                        onChange={(event) => setUnitPlateByCarId((current) => ({ ...current, [car.id]: event.target.value }))}
                      />
                      <select
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800"
                        value={unitStatusByCarId[car.id] ?? 'ACTIVE'}
                        onChange={(event) => setUnitStatusByCarId((current) => ({ ...current, [car.id]: event.target.value as AdminCarUnitStatus }))}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                      <button
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={creatingUnitCarId === car.id}
                        onClick={() => createUnit(car)}
                        type="button"
                      >
                        {creatingUnitCarId === car.id ? 'Menambah...' : 'Tambah Unit'}
                      </button>
                    </div>
                  </div>
                  {unitErrorByCarId[car.id] ? (
                    <p className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                      {unitErrorByCarId[car.id]}
                    </p>
                  ) : null}
                  {unitMessageByCarId[car.id] ? (
                    <p className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                      {unitMessageByCarId[car.id]}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {car.units.length === 0 ? (
                      <p className="text-sm text-slate-500">Belum ada unit untuk mobil ini.</p>
                    ) : car.units.map((unit) => (
                      <div key={unit.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                        {editingUnitId === unit.id ? (
                          <input
                            autoFocus
                            className="w-36 min-w-0 rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] font-bold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                            value={editedPlateNumber}
                            onChange={(event) => setEditedPlateNumber(event.target.value)}
                          />
                        ) : (
                          <span className="font-mono font-bold">{unit.plateNumber}</span>
                        )}
                        <select
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                          disabled={savingUnitId === unit.id}
                          value={editingUnitId === unit.id ? editedUnitStatus : unit.status}
                          onChange={(event) => {
                            const nextStatus = event.target.value as AdminCarUnitStatus;
                            if (editingUnitId === unit.id) {
                              setEditedUnitStatus(nextStatus);
                              return;
                            }
                            void updateUnit(car, unit.id, unit.plateNumber, nextStatus, {
                              successMessage: 'Status unit berhasil diperbarui.',
                            });
                          }}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="MAINTENANCE">MAINTENANCE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                        {editingUnitId === unit.id ? (
                          <>
                            <button
                              className="rounded border border-emerald-200 px-2 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                              disabled={savingUnitId === unit.id}
                              onClick={() => updateUnit(car, unit.id, editedPlateNumber, editedUnitStatus, {
                                successMessage: 'Plat nomor unit berhasil diperbarui.',
                              })}
                              type="button"
                            >
                              {savingUnitId === unit.id ? 'Menyimpan...' : 'Simpan'}
                            </button>
                            <button
                              className="rounded border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              disabled={savingUnitId === unit.id}
                              onClick={cancelEditUnit}
                              type="button"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <button
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            disabled={!!editingUnitId || !!savingUnitId}
                            onClick={() => startEditUnit(unit.id, unit.plateNumber, unit.status)}
                            type="button"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 truncate font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
