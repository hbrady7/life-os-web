import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #EE9A3F 0%, #A47FF0 62%, #6C7FF2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 112,
          fontWeight: 800,
          letterSpacing: "-0.04em",
        }}
      >
        /
      </div>
    ),
    { ...size }
  );
}
