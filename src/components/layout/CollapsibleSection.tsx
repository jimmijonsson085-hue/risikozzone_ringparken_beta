import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  accentBorderClass?: string;
  testId?: string;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  badge,
  icon,
  defaultOpen = false,
  forceOpen = false,
  accentBorderClass = 'border-[var(--border-subtle)]',
  testId,
  children,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  return (
    <section
      data-testid={testId}
      className={`rounded-md bg-[var(--surface-card)] border ${accentBorderClass} overflow-hidden transition-colors`}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left bg-[var(--surface-card)] hover:bg-[var(--surface-overlay)] transition-colors cursor-pointer"
      >
        <div className="min-w-0 flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-[#38BDF8] shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          )}
          {icon && <span className="shrink-0 flex items-center">{icon}</span>}
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--text-primary)] truncate">{title}</div>
            {subtitle && (
              <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {badge !== undefined && badge !== null && (
            <span className="px-2 py-0.5 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)] text-[11px] font-mono font-semibold text-[#38BDF8] tabular-nums whitespace-nowrap">
              {badge}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="p-3 pt-2.5 border-t border-[var(--border-subtle)] bg-[var(--surface-panel)] space-y-3">
          {children}
        </div>
      )}
    </section>
  );
};
