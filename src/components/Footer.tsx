import { NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────
   Animated link with sliding underline + translate effect
───────────────────────────────────────────────────────── */
function FooterLink({
  to,
  href,
  children,
  delay = 0,
  visible = false,
}: {
  to?: string;
  href?: string;
  children: React.ReactNode;
  delay?: number;
  visible?: boolean;
}) {
  const style: React.CSSProperties = {
    transitionDelay: `${delay}ms`,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(16px)',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
  };

  const cls =
    'group relative inline-flex items-center gap-1 text-sm text-gray-500 dark:text-white/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-300 w-fit';

  const inner = (
    <>
      <span className="relative">
        {children}
        {/* Sliding underline */}
        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-blue-500 group-hover:w-full transition-all duration-300 ease-out" />
      </span>
      {/* Arrow that slides in on hover */}
      <span className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-blue-500 text-xs">
        →
      </span>
    </>
  );

  if (to) {
    return (
      <NavLink to={to} className={cls} style={style}>
        {inner}
      </NavLink>
    );
  }
  return (
    <a href={href ?? '#'} className={cls} style={style}>
      {inner}
    </a>
  );
}

/* ─────────────────────────────────────────────────────────
   Social icon button with scale + glow on hover
───────────────────────────────────────────────────────── */
function SocialBtn({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/30
                 hover:border-blue-500/50 hover:text-blue-500 dark:hover:border-blue-400/50 dark:hover:text-blue-400
                 hover:shadow-[0_0_16px_rgba(59,130,246,0.35)] dark:hover:shadow-[0_0_20px_rgba(96,165,250,0.3)]
                 transition-all duration-300 hover:scale-110 active:scale-95"
    >
      {children}
    </a>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Footer
───────────────────────────────────────────────────────── */
export function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <footer
      ref={footerRef}
      className="relative bg-gray-50 dark:bg-[#030303] border-t border-gray-200 dark:border-white/5 overflow-hidden transition-colors duration-300"
    >
      {/* ── Grid overlay ── */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* ── Ambient glow ── */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[300px] bg-blue-600/10 dark:bg-blue-500/20 blur-[180px] pointer-events-none rounded-full" />

      {/* ── Floating accent orbs ── */}
      <div className="absolute top-12 left-8 w-32 h-32 bg-blue-400/10 dark:bg-blue-400/5 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-8 right-16 w-24 h-24 bg-violet-400/10 dark:bg-violet-400/5 rounded-full blur-2xl pointer-events-none animate-pulse [animation-delay:1.2s]" />

      {/* ════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════ */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-0">

        {/* ── Top columns ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-16">

          {/* Brand block */}
          <div
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity 0.7s ease, transform 0.7s ease',
            }}
          >
            {/* Logo wordmark */}
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 flex items-center gap-1">
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Legal</span>
              <span>Ease</span>
              <span className="text-blue-500 text-4xl leading-none">.</span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-white/40 max-w-xs leading-relaxed mb-6">
              The intelligence layer for your legal documents.&nbsp;Secure, fast, and driven by AI.
            </p>
            {/* Tiny badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/5 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              AI-Powered Platform
            </span>
          </div>

          {/* Nav columns */}
          <div className="flex gap-16 md:justify-end">
            {/* Platform */}
            <div className="flex flex-col gap-3">
              <h3
                className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(16px)',
                  transition: 'opacity 0.6s ease 100ms, transform 0.6s ease 100ms',
                }}
              >
                Platform
              </h3>
              <FooterLink to="/dashboard" delay={150} visible={visible}>Dashboard</FooterLink>
              <FooterLink to="/documents" delay={220} visible={visible}>Documents</FooterLink>
              <FooterLink to="/chatbot" delay={290} visible={visible}>AI Chatbot</FooterLink>
            </div>

            {/* Legal */}
            <div className="flex flex-col gap-3">
              <h3
                className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(16px)',
                  transition: 'opacity 0.6s ease 200ms, transform 0.6s ease 200ms',
                }}
              >
                Legal
              </h3>
              <FooterLink href="#" delay={250} visible={visible}>Privacy Policy</FooterLink>
              <FooterLink href="#" delay={320} visible={visible}>Terms of Service</FooterLink>
              <FooterLink href="#" delay={390} visible={visible}>Security</FooterLink>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════
            GIANT WATERMARK TEXT — LEGALEASE
        ════════════════════════════════════ */}
        <div className="relative w-full overflow-hidden select-none pointer-events-none" aria-hidden="true">
          <p
            className="text-[clamp(4rem,18vw,14rem)] font-black tracking-tighter leading-none text-center"
            style={{
              /* Fade from opaque top edge to transparent bottom */
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 85%)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 85%)',
              /* Strong dark gradient fill */
              background: 'linear-gradient(180deg, #111827 0%, #4b5563 80%, transparent 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0px)' : 'translateY(40px)',
              transition: 'opacity 1s ease 400ms, transform 1s ease 400ms',
            }}
          >
            LEGALEASE
          </p>
          {/* Dark-mode version via pseudo overlay using a sibling */}
          <p
            className="hidden dark:block absolute inset-0 text-[clamp(4rem,18vw,14rem)] font-black tracking-tighter leading-none text-center"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 85%)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 85%)',
              background: 'linear-gradient(180deg, #f8fafc 0%, #94a3b8 80%, transparent 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0px)' : 'translateY(40px)',
              transition: 'opacity 1s ease 400ms, transform 1s ease 400ms',
            }}
            aria-hidden="true"
          >
            LEGALEASE
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════
          BOTTOM BAR (sits below watermark)
      ════════════════════════════════════ */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pb-6">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent mb-6" />

        <div
          className="flex flex-col md:flex-row justify-between items-center gap-4"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease 600ms',
          }}
        >
          <p className="text-xs text-gray-400 dark:text-white/25">
            © {new Date().getFullYear()} LegalEase Inc. All rights reserved.
          </p>

          <div className="flex items-center gap-3">
            {/* Twitter / X */}
            <SocialBtn href="#" label="Twitter / X">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.636 5.903-5.636Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
              </svg>
            </SocialBtn>

            {/* LinkedIn */}
            <SocialBtn href="#" label="LinkedIn">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </SocialBtn>

            {/* GitHub */}
            <SocialBtn href="https://github.com/VishnuVardhanCodes/LegalEase" label="GitHub">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            </SocialBtn>
          </div>
        </div>
      </div>

      {/* ── Inline keyframes for pulse animation ── */}
      <style>{`
        @keyframes footer-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
      `}</style>
    </footer>
  );
}