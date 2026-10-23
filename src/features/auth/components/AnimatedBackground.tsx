'use client';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useEffect } from 'react';

/**
 * Ambient backdrop: four drifting blurred orbs (CSS keyframes), the paper-grain dot grid,
 * a spotlight that follows the pointer, and a vignette into the page background.
 */
export function AnimatedBackground() {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 50, damping: 20, mass: 0.8 });
  const y = useSpring(pointerY, { stiffness: 50, damping: 20, mass: 0.8 });
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${x}px ${y}px, var(--c-glow), transparent 65%)`;

  useEffect(() => {
    const startX = window.innerWidth * 0.6;
    const startY = window.innerHeight * 0.45;
    pointerX.jump(startX);
    pointerY.jump(startY);
    x.jump(startX);
    y.jump(startY);
    if (reduceMotion) return;
    const onMove = (e: PointerEvent) => {
      pointerX.set(e.clientX);
      pointerY.set(e.clientY);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduceMotion, pointerX, pointerY, x, y]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div className="auth-aurora absolute inset-0" />
      <div className="auth-orb auth-orb-a -left-[12%] -top-[18%] h-[40rem] w-[40rem] bg-leaf/25 blur-[120px]" />
      <div className="auth-orb auth-orb-b -right-[12%] top-[18%] h-[34rem] w-[34rem] bg-teal/20 blur-[120px]" />
      <div className="auth-orb auth-orb-c -bottom-[25%] left-[22%] h-[36rem] w-[36rem] bg-lime/20 blur-[130px]" />
      <div className="auth-orb auth-orb-d bottom-[8%] right-[18%] h-[18rem] w-[18rem] bg-sage-2/50 blur-[100px]" />
      <div className="paper-grain auth-grid-mask absolute inset-0" />
      <motion.div className="absolute inset-0" style={{ background: spotlight }} />
      <div className="auth-vignette absolute inset-0" />
    </div>
  );
}
