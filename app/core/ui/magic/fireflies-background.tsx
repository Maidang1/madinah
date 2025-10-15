"use client";

import { cn } from "~/core/utils";
import { motion } from "motion/react";
import React, { useEffect, useId, useRef, useState } from "react";

/**
 * FirefliesBackground Component Props
 *
 * @param {number} [count=50] - Number of fireflies
 * @param {string} [className] - Additional CSS classes to apply to the container
 * @param {string} [color="white"] - Color of the fireflies
 */
interface FirefliesBackgroundProps {
  count?: number;
  className?: string;
  color?: string;
}

interface Firefly {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  moveX: number;
  moveY: number;
}

/**
 * FirefliesBackground Component
 *
 * A React component that creates floating fireflies effect with glowing dots
 * that move around the screen randomly and pulse with light.
 *
 * @component
 *
 * @example
 * // Basic usage
 * <FirefliesBackground />
 *
 * // With custom count and color
 * <FirefliesBackground count={80} color="yellow" />
 */
export function FirefliesBackground({
  count = 50,
  className,
  color = "white",
}: FirefliesBackgroundProps) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [fireflies, setFireflies] = useState<Firefly[]>([]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (dimensions.width && dimensions.height) {
      const newFireflies: Firefly[] = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        size: Math.random() * 3 + 1, // 1-4px
        duration: Math.random() * 3 + 2, // 2-5s for glow
        delay: Math.random() * 5, // 0-5s delay
        moveX: (Math.random() - 0.5) * 100, // -50px to 50px movement
        moveY: (Math.random() - 0.5) * 100, // -50px to 50px movement
      }));
      setFireflies(newFireflies);
    }
  }, [dimensions, count]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full overflow-hidden",
        className,
      )}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <stop offset="25%" stopColor={color} stopOpacity="0.4" />
            <stop offset="50%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-blur`}>
            <feGaussianBlur stdDeviation="1" />
          </filter>
        </defs>
        
        {fireflies.map((firefly) => (
          <g key={firefly.id}>
            {/* Glow effect */}
            <motion.circle
              cx={firefly.x}
              cy={firefly.y}
              r={firefly.size * 3}
              fill={`url(#${id}-glow)`}
              filter={`url(#${id}-blur)`}
              initial={{ opacity: 0.2 }}
              animate={{
                opacity: [0.2, 0.8, 0.3, 0.9, 0.2],
                scale: [1, 1.2, 0.8, 1.3, 1],
                x: [0, firefly.moveX * 0.3, firefly.moveX * -0.2, firefly.moveX * 0.5, 0],
                y: [0, firefly.moveY * 0.4, firefly.moveY * -0.3, firefly.moveY * 0.2, 0],
              }}
              transition={{
                duration: firefly.duration * 2,
                repeat: Infinity,
                delay: firefly.delay,
                ease: "easeInOut",
              }}
            />
            
            {/* Core dot */}
            <motion.circle
              cx={firefly.x}
              cy={firefly.y}
              r={firefly.size}
              fill={color}
              initial={{ opacity: 0.6 }}
              animate={{
                opacity: [0.6, 1, 0.4, 1, 0.6],
                scale: [1, 1.1, 0.9, 1.2, 1],
                x: [0, firefly.moveX * 0.3, firefly.moveX * -0.2, firefly.moveX * 0.5, 0],
                y: [0, firefly.moveY * 0.4, firefly.moveY * -0.3, firefly.moveY * 0.2, 0],
              }}
              transition={{
                duration: firefly.duration * 2,
                repeat: Infinity,
                delay: firefly.delay,
                ease: "easeInOut",
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
