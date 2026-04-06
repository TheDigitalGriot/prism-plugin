import { CSSProperties } from "react";

interface SpectralBarProps {
  width?: string | number;
  height?: number;
  style?: CSSProperties;
}

export function SpectralBar({ width = "100%", height = 4, style }: SpectralBarProps) {
  return (
    <div
      style={{
        width,
        height,
        background:
          "linear-gradient(90deg, #4A9EFF 0%, #2DD4BF 33%, #4ADE80 66%, #FBB040 100%)",
        borderRadius: height / 2,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
