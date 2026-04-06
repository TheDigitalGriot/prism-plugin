import { MAC } from "../../theme/colors";
import { SpectralBar } from "../../components/SpectralBar";
import { COMPONENTS } from "../../constants";

export function IntroStep() {
  return (
    <div style={{ flex: 1, padding: "28px 28px 0", overflowY: "auto" }}>
      <SpectralBar style={{ marginBottom: 22 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            flexShrink: 0,
            background: `linear-gradient(135deg, ${MAC.blue}33, ${MAC.teal}33)`,
            border: `1px solid ${MAC.teal}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: `linear-gradient(135deg, ${MAC.blue}, ${MAC.teal})`,
            }}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: -0.5,
              background: `linear-gradient(90deg, ${MAC.blue}, ${MAC.teal}, ${MAC.green})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            PRISM 2.5.0
          </div>
          <div style={{ color: MAC.muted, fontSize: 12 }}>
            AI-powered development workflow system
          </div>
        </div>
      </div>

      <div
        style={{
          color: MAC.light,
          fontSize: 13,
          lineHeight: 1.7,
          marginBottom: 20,
        }}
      >
        This package will install the Prism development workflow ecosystem on
        your Mac. The installer will guide you through selecting components and
        configuring your environment.
      </div>

      <div
        style={{
          background: MAC.panel,
          border: `1px solid ${MAC.border}`,
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${MAC.borderLight}`,
          }}
        >
          <span
            style={{
              color: MAC.muted,
              fontSize: 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Package Contents
          </span>
        </div>
        {COMPONENTS.map((c, i) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 14px",
              borderBottom:
                i < COMPONENTS.length - 1
                  ? `1px solid ${MAC.borderLight}`
                  : "none",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                flexShrink: 0,
                background: `${c.color}22`,
                border: `1px solid ${c.color}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: c.color,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {c.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{ color: MAC.white, fontSize: 12, fontWeight: 500 }}
              >
                {c.name}
              </div>
              <div style={{ color: MAC.muted, fontSize: 10 }}>{c.desc}</div>
            </div>
            <span style={{ color: MAC.muted, fontSize: 10 }}>{c.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
