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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080c12",
          borderRadius: 40,
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: "rgba(29,78,216,0.25)",
            filter: "blur(24px)",
            display: "flex",
          }}
        />
        {/* Card */}
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 28,
            background: "rgba(14,20,32,0.95)",
            border: "1.5px solid rgba(29,78,216,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Bot SVG inlined as shapes */}
          <svg
            width="58"
            height="58"
            viewBox="0 0 24 24"
            fill="none"
          >
            <rect x="3" y="11" width="18" height="10" rx="3" stroke="#60a5fa" strokeWidth="1.4" />
            <path d="M9 11V8a3 3 0 0 1 6 0v3" stroke="#60a5fa" strokeWidth="1.4" />
            <circle cx="9" cy="16" r="1.5" fill="#60a5fa" />
            <circle cx="15" cy="16" r="1.5" fill="#60a5fa" />
            <path d="M12 4v2" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    ),
    { ...size }
  );
}
