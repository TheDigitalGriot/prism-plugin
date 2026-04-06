import { Folder } from 'lucide-react';

type Props = {
  installDir: string;
  addToPath: boolean;
  onDirChange: (dir: string) => void;
  onAddToPathChange: (add: boolean) => void;
};

export function InstallLocationScreen({ installDir, addToPath, onDirChange, onAddToPathChange }: Props) {
  const handleBrowse = async () => {
    const selected = await window.setupAPI.selectDirectory(installDir);
    if (selected) onDirChange(selected);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--prism-fg-active)]">Install Location</h2>
        <p className="text-sm text-[var(--prism-fg-muted)] mt-1">
          Choose where to install the Prism CLI binary.
        </p>
      </div>

      {/* Directory picker */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-[var(--prism-fg)]">Installation directory</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={installDir}
            onChange={e => onDirChange(e.target.value)}
            className="
              flex-1 px-3 py-2 rounded text-sm
              bg-[var(--prism-bg-input)] text-[var(--prism-fg)]
              border border-[var(--prism-border-input)]
              focus:border-[var(--prism-border-focus)] focus:outline-none
              font-[var(--prism-font-mono)]
            "
          />
          <button
            onClick={handleBrowse}
            className="
              flex items-center gap-2 px-4 py-2 rounded text-sm
              bg-[var(--prism-bg-button-secondary)] text-[var(--prism-fg)]
              hover:bg-[var(--prism-bg-active)] transition-colors
            "
          >
            <Folder size={14} />
            Browse
          </button>
        </div>
        <p className="text-xs text-[var(--prism-fg-muted)]">
          The prism-cli binary will be placed in this directory.
        </p>
      </div>

      {/* PATH option */}
      <label className="flex items-center gap-3 p-3 rounded-md bg-[var(--prism-bg-surface)] border border-[var(--prism-border)] cursor-pointer">
        <input
          type="checkbox"
          checked={addToPath}
          onChange={e => onAddToPathChange(e.target.checked)}
          className="w-4 h-4 accent-[var(--prism-blue)]"
        />
        <div>
          <span className="text-sm text-[var(--prism-fg)]">Add to system PATH</span>
          <p className="text-xs text-[var(--prism-fg-muted)]">
            Allows running <code className="text-[var(--prism-blue)]">prism-cli</code> from any terminal.
          </p>
        </div>
      </label>
    </div>
  );
}
