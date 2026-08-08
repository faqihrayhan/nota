"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

/**
 * Reveal Component — Animasi standar muncul saat di-scroll
 */
export function Reveal({
  children,
  delay = 0,
  duration = 0.6,
  y = 20,
  x = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  x?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y, x }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y, x }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * TextReveal — Menggantikan logika per kata/karakter dengan animasi blok halus
 * agar layout tidak lagi terpotong (clipped) di HP.
 */
export function TextReveal({
  text,
  className,
  delay = 0,
  as: Component = "span",
}: {
  text: string | string[];
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "span" | "p";
}) {
  const content = Array.isArray(text) ? text : [text];

  return (
    <span className={className} style={{ display: "block", overflow: "hidden" }}>
      {content.map((item, index) => (
        <motion.span
          key={index}
          initial={{ y: "120%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: 0.9,
            delay: delay + index * 0.15,
            ease: [0.16, 1, 0.3, 1], // easeOutExpo
          }}
          style={{ display: "block" }}
        >
          {item}
        </motion.span>
      ))}
    </span>
  );
}
