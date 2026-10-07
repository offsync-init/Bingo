import React from "react";

interface DhakaBorderProps {
  className?: string;
  variant?: "horizontal" | "vertical";
}

export const DhakaBorder: React.FC<DhakaBorderProps> = ({
  className = "",
  variant = "horizontal",
}) => {
  if (variant === "vertical") {
    return (
      <div className={`theme-ornament w-3 flex flex-col overflow-hidden select-none opacity-85 ${className}`}>
        <svg
          className="w-full h-full"
          preserveAspectRatio="repeat"
          xmlns="http://www.w3.org/2000/svg"
        >
          <pattern
            id="dhaka-pattern-v"
            width="12"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            {/* Dark background */}
            <rect width="12" height="24" fill="#8A1538" />
            {/* Diamond shape */}
            <polygon points="6,0 12,12 6,24 0,12" fill="#D4AF37" />
            <polygon points="6,4 10,12 6,20 2,12" fill="#1E293B" />
            <polygon points="6,7 8,12 6,17 4,12" fill="#C8102E" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#dhaka-pattern-v)" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`theme-ornament h-3 w-full overflow-hidden select-none opacity-90 shadow-sm ${className}`}>
      <svg
        className="w-full h-full"
        preserveAspectRatio="repeat"
        xmlns="http://www.w3.org/2000/svg"
      >
        <pattern
          id="dhaka-pattern-h"
          width="24"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          {/* Crimson Base */}
          <rect width="24" height="12" fill="#8A1538" />
          {/* Outer Gold Diamond */}
          <polygon points="0,6 12,0 24,6 12,12" fill="#E5A93C" />
          {/* Inner Navy Diamond */}
          <polygon points="4,6 12,2 20,6 12,10" fill="#0F172A" />
          {/* Red center spark */}
          <polygon points="7,6 12,4 17,6 12,8" fill="#C8102E" />
          {/* Corner triangles */}
          <polygon points="0,0 6,0 0,3" fill="#D4AF37" />
          <polygon points="24,0 18,0 24,3" fill="#D4AF37" />
          <polygon points="0,12 6,12 0,9" fill="#D4AF37" />
          <polygon points="24,12 18,12 24,9" fill="#D4AF37" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#dhaka-pattern-h)" />
      </svg>
    </div>
  );
};

export const NepaliMandalaBadge: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = "",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`theme-ornament animate-spin-slow ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="46" stroke="#D4AF37" strokeWidth="2" strokeDasharray="4 2" />
      <circle cx="50" cy="50" r="38" stroke="#C8102E" strokeWidth="2" />
      <polygon
        points="50,15 80,75 20,75"
        stroke="#E5A93C"
        strokeWidth="2"
        fill="rgba(212, 175, 55, 0.15)"
      />
      <polygon
        points="50,85 80,25 20,25"
        stroke="#E5A93C"
        strokeWidth="2"
        fill="rgba(200, 16, 46, 0.15)"
      />
      <circle cx="50" cy="50" r="10" fill="#8A1538" stroke="#D4AF37" strokeWidth="2" />
      <circle cx="50" cy="50" r="4" fill="#D4AF37" />
    </svg>
  );
};

export const NepalSunMoonIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Traditional Sun/Moon stylization of Nepali flag */}
      <path
        d="M20 5C11.716 5 5 11.716 5 20C5 28.284 11.716 35 20 35C28.284 35 35 28.284 35 20C35 11.716 28.284 5 20 5Z"
        fill="#8A1538"
      />
      {/* Crescent Moon */}
      <path
        d="M13 18C13 14 16 11 20 11C18 13 17 16 18 19C19 22 22 23 24 23C21 25 16 25 14 21C13.3 19.8 13 18.9 13 18Z"
        fill="#FFFBEB"
      />
      {/* 8-ray sun */}
      <circle cx="25" cy="16" r="3" fill="#FFFBEB" />
    </svg>
  );
};
