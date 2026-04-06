import { useState } from 'react';
import { Package, Monitor, Terminal, Puzzle } from 'lucide-react';
import type { ComponentId, ComponentStatus, WizardMode } from '../types';

type Props = {
  components: ComponentStatus[];
  mode: WizardMode;
  selected: ComponentId[];
  onSelectionChange: (ids: ComponentId[]) => void;
};

const ICONS: Record<ComponentId, typeof Package> = {
  'prism-cli': Terminal,
  'prism-vscode': Puzzle,
  'prism-electron': Monitor,
  'claude-plugin': Package,
};

export function ComponentSelectScreen({ components, mode, selected, onSelectionChange }: Props) {
  const toggle = (id: ComponentId) => {
    onSelectionChange(
      selected.includes(id)
        ? selected.filter(s => s !== id)
        : [...selected, id]
    );
  };

  // For uninstall mode, only show installed components
  const visibleComponents = mode === 'uninstall'
    ? components.filter(c => c.installed)
    : components;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--prism-fg-active)]">
          {mode === 'uninstall' ? 'Select Components to Remove' : 'Select Components'}
        </h2>
        <p className="text-sm text-[var(--prism-fg-muted)] mt-1">
          {mode === 'update'
            ? 'Choose which components to update.'
            : mode === 'uninstall'
              ? 'Choose which components to remove from your system.'
              : 'Choose which Prism components to install.'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {visibleComponents.map((component) => {
          const Icon = ICONS[component.id];
          const isSelected = selected.includes(component.id);
          const disabled = !component.prerequisiteMet;

          return (
            <button
              key={component.id}
              onClick={() => !disabled && toggle(component.id)}
              disabled={disabled}
              className={`
                flex items-center gap-4 p-4 rounded-lg text-left transition-all duration-200
                border ${isSelected
                  ? 'border-[var(--prism-blue)] bg-[rgba(59,130,246,0.08)]'
                  : 'border-[var(--prism-border)] bg-[var(--prism-bg-surface)] hover:border-[var(--prism-border-active)]'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Checkbox */}
              <div className={`
                w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                ${isSelected
                  ? 'bg-[var(--prism-blue)] border-[var(--prism-blue)]'
                  : 'border-[var(--prism-fg-muted)]'
                }
              `}>
                {isSelected && <span className="text-white text-xs">✓</span>}
              </div>

              {/* Icon */}
              <Icon size={20} className="text-[var(--prism-fg-muted)] shrink-0" />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--prism-fg)]">{component.name}</span>
                  {component.currentVersion && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--prism-bg-badge)] text-[var(--prism-fg-muted)]">
                      v{component.currentVersion}
                    </span>
                  )}
                  {component.updateAvailable && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(59,130,246,0.15)] text-[var(--prism-blue)]">
                      Update available
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--prism-fg-muted)] mt-0.5">{component.description}</p>
                {component.prerequisiteMessage && (
                  <p className="text-xs text-[var(--prism-warning)] mt-1">{component.prerequisiteMessage}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
