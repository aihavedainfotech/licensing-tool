import React from 'react';

export default function AnimatedLogo({ size = 40 }: { size?: number }) {
  return (
    <div className="logo-container" style={{ width: size, height: size, position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
      <style>
        {`
          .pillar-left {
            transform-origin: center;
            animation: assembleLeft 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .pillar-right {
            transform-origin: center;
            animation: assembleRight 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .check-mark {
            transform-origin: center;
            animation: assembleCheck 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
            opacity: 0;
            stroke-dasharray: 120;
            stroke-dashoffset: 120;
          }

          @keyframes assembleLeft {
            0% { transform: translateX(-20px) translateY(-10px) rotate(-15deg); opacity: 0; }
            100% { transform: translateX(0) translateY(0) rotate(0); opacity: 1; }
          }
          @keyframes assembleRight {
            0% { transform: translateX(20px) translateY(10px) rotate(15deg); opacity: 0; }
            100% { transform: translateX(0) translateY(0) rotate(0); opacity: 1; }
          }
          @keyframes assembleCheck {
            0% { opacity: 0; stroke-dashoffset: 120; transform: scale(0.8) translateY(-10px); }
            50% { opacity: 1; stroke-dashoffset: 0; transform: scale(1.05) translateY(2px); }
            100% { opacity: 1; stroke-dashoffset: 0; transform: scale(1) translateY(0); }
          }

          /* Hover interaction: Dismantle and assemble */
          .logo-container:hover .pillar-left {
            animation: dismantleLeft 1.2s ease-in-out forwards;
          }
          .logo-container:hover .pillar-right {
            animation: dismantleRight 1.2s ease-in-out forwards;
          }
          .logo-container:hover .check-mark {
            animation: dismantleCheck 1.2s ease-in-out forwards;
          }

          @keyframes dismantleLeft {
            0%, 100% { transform: translateX(0) translateY(0) rotate(0); }
            50% { transform: translateX(-12px) translateY(-6px) rotate(-10deg); }
          }
          @keyframes dismantleRight {
            0%, 100% { transform: translateX(0) translateY(0) rotate(0); }
            50% { transform: translateX(12px) translateY(6px) rotate(10deg); }
          }
          @keyframes dismantleCheck {
            0%, 100% { transform: scale(1) translateY(0); }
            50% { transform: scale(1.15) translateY(-8px); }
          }
        `}
      </style>
      <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Left Pillar */}
        <rect className="pillar-left" x="24" y="20" width="16" height="60" fill="#084d6e" />
        
        {/* Right Pillar */}
        <rect className="pillar-right" x="60" y="20" width="16" height="60" fill="#084d6e" />
        
        {/* Checkmark */}
        <path 
          className="check-mark" 
          d="M 12 46 L 42 66 L 90 18" 
          stroke="#8ac149" 
          strokeWidth="15" 
          strokeLinecap="square" 
          strokeLinejoin="miter" 
        />
      </svg>
    </div>
  );
}
