import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          borderRadius: 44,
        }}
      >
        /
      </div>
    ),
    {
      ...size,
    }
  );
}
