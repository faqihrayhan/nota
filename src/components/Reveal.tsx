"use client";

import { motion, useInView, type Variants } from "framer-motion";
import { useRef } from "react";

interface RevealProps {
  children: React.ReactNode;
  width?: "fit-content" | "100%";
  delay?: number;
  duration?: number;
  y?: number;
  x?: number;
  className?: string;
}

/**
 * Reveal Component — Gaya Motion
 * Efek halus saat elemen masuk ke viewport.
 */
export function Reveal({
  children,
  width = "fit-content",
  delay = 0,
  duration = 0.5,
  y = 25,
  x = 0,
  className,
}: RevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const variants: Variants = {
    hidden: { 
      opacity: 0, 
      y, 
      x,
      filter: "blur(8px)" 
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      x: 0,
      filter: "blur(0px)",
      transition: {
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1], // easeOutExpo
      }
    },
  };

  return (
    <div ref={ref} style={{ position: "relative", width, overflow: "visible" }} className={className}>
      <motion.div
        variants={variants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * TextReveal — Reveal khusus untuk baris teks atau heading.
 */
export function TextReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(" ");
  
  return (
    <div className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em] pb-[0.1em]">
          <motion.span
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{
              duration: 0.8,
              delay: delay + i * 0.05,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="inline-block"
          >
            {word}
          </motion.span>
        </span>
      ))}
    </div>
  );
}
