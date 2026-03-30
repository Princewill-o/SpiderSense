"use client";

import React, { useEffect, useState } from "react";
import { Globe, Share2, MessageCircle, Mail, Code, User, Fingerprint } from "lucide-react";

export const RadialSocialMenu: React.FC = () => {
  const icons = [
    { icon: <Globe />, label: "Website" },
    { icon: <Share2 />, label: "Share" },
    { icon: <MessageCircle />, label: "Message" },
    { icon: <Mail />, label: "Email" },
    { icon: <Code />, label: "Code" },
    { icon: <Fingerprint />, label: "Identity" },
  ];

  const radius = 140;
  const [angleOffset, setAngleOffset] = useState(0);

  useEffect(() => {
    let animationFrame: number;
    const animate = () => {
      setAngleOffset(prev => prev + 0.002);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div className="relative h-screen w-screen flex items-center justify-center">
      {/* Center Spider-Man themed icon */}
      <div className="relative z-10 flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-tr from-[#c41e3a] to-[#0066cc] shadow-xl ring-4 ring-[#c41e3a]/30 animate-pulse-slow">
        <User className="text-white w-16 h-16" />
      </div>

      {/* Orbital path */}
      <div
        className="absolute rounded-full border-2 border-dashed border-[#c41e3a]/30"
        style={{
          width: `${radius * 2}px`,
          height: `${radius * 2}px`,
          top: `calc(50% - ${radius}px)`,
          left: `calc(50% - ${radius}px)`,
        }}
      />

      {/* Orbiting icons */}
      {icons.map((item, index) => {
        const angle = (index / icons.length) * 2 * Math.PI + angleOffset;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        return (
          <button
            key={index}
            className="absolute flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#0066cc] to-[#c41e3a] border-2 border-white shadow-lg hover:scale-125 hover:shadow-2xl hover:shadow-[#c41e3a]/50 transition-all duration-300 animate-float group"
            style={{
              transform: `translate(${x}px, ${y}px)`,
            }}
            aria-label={item.label}
          >
            {React.cloneElement(item.icon, { 
              size: 24, 
              className: "text-white group-hover:scale-110 transition-transform" 
            })}
          </button>
        );
      })}
    </div>
  );
};
