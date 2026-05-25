'use client';

const filters = ['Semua', 'MPV', 'SUV', 'Van', 'Premium'] as const;

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function FilterBar({ activeFilter, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onFilterChange(f)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            activeFilter === f
              ? 'bg-brand-gold text-surface-dark shadow-md shadow-brand-gold/20'
              : 'bg-surface-card text-text-secondary border border-white/5 hover:border-brand-gold/20 hover:text-text-primary'
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
