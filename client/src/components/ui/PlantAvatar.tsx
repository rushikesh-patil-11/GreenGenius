import React from "react";

interface PlantAvatarProps {
  src?: string;
  alt?: string;
  size?: number;
}

export const PlantAvatar: React.FC<PlantAvatarProps> = ({ src, alt, size = 40 }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1.5px solid #d1d5db",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt || "Plant"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span role="img" aria-label="plant" style={{ fontSize: size * 0.6 }}>
          🌱
        </span>
      )}
    </div>
  );
};
