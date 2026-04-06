import { WIN, MAC } from "../theme/colors";

interface NavButtonsProps {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  platform?: "windows" | "macos";
}

export function NavButtons({
  onBack,
  onNext,
  nextLabel = "Next →",
  backDisabled = false,
  nextDisabled = false,
  platform = "windows",
}: NavButtonsProps) {
  if (platform === "macos") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 20px",
          borderTop: `1px solid ${MAC.borderLight}`,
          background: "rgba(28,28,30,0.8)",
        }}
      >
        <button
          onClick={onBack}
          disabled={backDisabled}
          style={{
            padding: "6px 16px",
            background: backDisabled ? "transparent" : "rgba(255,255,255,0.07)",
            border: `1px solid ${backDisabled ? "transparent" : MAC.border}`,
            borderRadius: 6,
            color: backDisabled ? "transparent" : MAC.light,
            fontSize: 12,
            fontWeight: 500,
            cursor: backDisabled ? "default" : "pointer",
            fontFamily: "-apple-system, sans-serif",
            transition: "all 0.15s",
          }}
        >
          Go Back
        </button>
        <button
          onClick={onNext}
          disabled={nextDisabled}
          style={{
            padding: "6px 20px",
            background: nextDisabled
              ? "rgba(255,255,255,0.06)"
              : `linear-gradient(135deg, ${MAC.blue}, ${MAC.teal})`,
            border: "none",
            borderRadius: 6,
            color: nextDisabled ? MAC.muted : "white",
            fontSize: 12,
            fontWeight: 600,
            cursor: nextDisabled ? "default" : "pointer",
            fontFamily: "-apple-system, sans-serif",
            boxShadow: nextDisabled ? "none" : `0 0 20px ${MAC.blue}44`,
            transition: "all 0.15s",
          }}
        >
          {nextLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        borderTop: `1px solid ${WIN.border}`,
        background: WIN.titleBg,
      }}
    >
      <button
        onClick={onBack}
        disabled={backDisabled}
        style={{
          padding: "6px 18px",
          background: "transparent",
          border: `1px solid ${backDisabled ? WIN.border : WIN.muted}`,
          borderRadius: 3,
          color: backDisabled ? WIN.border : WIN.light,
          fontSize: 12,
          cursor: backDisabled ? "default" : "pointer",
          fontFamily: "'Segoe UI', sans-serif",
          transition: "all 0.15s",
        }}
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        style={{
          padding: "6px 22px",
          background: nextDisabled
            ? WIN.surface
            : `linear-gradient(135deg, ${WIN.blue}, ${WIN.teal})`,
          border: "none",
          borderRadius: 3,
          color: nextDisabled ? WIN.muted : "white",
          fontSize: 12,
          fontWeight: 600,
          cursor: nextDisabled ? "default" : "pointer",
          fontFamily: "'Segoe UI', sans-serif",
          boxShadow: nextDisabled ? "none" : `0 0 16px ${WIN.teal}44`,
          transition: "all 0.15s",
        }}
      >
        {nextLabel}
      </button>
    </div>
  );
}
