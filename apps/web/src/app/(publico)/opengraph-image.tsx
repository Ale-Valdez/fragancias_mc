import { ImageResponse } from "next/og";

export const alt = "Fragancias MC, catálogo de perfumes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A192F",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", color: "#D3AE37", fontSize: 22, letterSpacing: 8 }}>CATÁLOGO DE PERFUMES</div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 84, letterSpacing: 6 }}>FRAGANCIAS MC</div>
      <div style={{ display: "flex", width: 120, height: 2, marginTop: 32, background: "#D3AE37" }} />
      <div style={{ display: "flex", marginTop: 32, color: "#C5CEDA", fontSize: 28 }}>Extractos de 60 ml</div>
    </div>,
    { ...size },
  );
}
