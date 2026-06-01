import { Shield, Lock, Server, Key, Activity, CheckCircle2, Mail } from 'lucide-react';
import { siteConfig } from '../config/site';

const { compliance } = siteConfig;

interface Section {
  icon: JSX.Element;
  title: string;
  color: string;
  content: string[];
}

const sections: Section[] = [
  {
    icon: <Lock size={20} />,
    title: 'Encryption Standards',
    color: 'blue',
    content: [
      'All data in transit is protected using TLS 1.3, the latest and most secure transport layer protocol available.',
      'Data at rest is encrypted using AES-256, the same standard trusted by banks and government institutions worldwide.',
      'Document uploads are encrypted client-side before transmission, ensuring zero-knowledge processing on our servers.',
      'Encryption keys are rotated on a 90-day cycle and stored in hardware security modules (HSMs) isolated from application infrastructure.',
    ],
  },
  {
    icon: <Server size={20} />,
    title: 'Infrastructure Security',
    color: 'emerald',
    content: [
      compliance.soc2Certified
        ? `LegalEase operates on SOC-2 ${compliance.soc2Type} certified cloud infrastructure with dedicated network isolation per tenant.`
        : 'LegalEase operates on secure cloud infrastructure with dedicated network isolation per tenant.',
      'Each document is processed in an ephemeral, sandboxed container that is destroyed immediately after analysis completes.',
      `We perform ${compliance.vulnScanFrequency} automated vulnerability scans and ${compliance.penTestFrequency} third-party penetration testing of all production systems.`,
      'Infrastructure is distributed across multiple availability zones with automatic failover to ensure 99.99% uptime SLAs.',
    ],
  },
  {
    icon: <Key size={20} />,
    title: 'Access Control',
    color: 'purple',
    content: [
      'Role-based access control (RBAC) ensures employees can only access systems required for their specific job function.',
      'Multi-factor authentication (MFA) is enforced for all internal LegalEase employee accounts and administrative consoles.',
      'All access to production systems is logged, monitored in real-time, and subject to automated anomaly detection.',
      'User sessions expire after 30 minutes of inactivity. Privileged sessions expire after 15 minutes.',
    ],
  },
  {
    icon: <Activity size={20} />,
    title: 'Monitoring & Incident Response',
    color: 'amber',
    content: [
      'Our Security Operations Center (SOC) monitors all platform activity 24/7 for suspicious patterns and anomalies.',
      'In the event of a security incident, our response team is alerted within 60 seconds via automated alerting pipelines.',
      `Affected customers are notified within ${compliance.breachNotificationHours} hours of any confirmed data breach, in compliance with GDPR Article 33.`,
      'We conduct full post-incident reviews and publish security advisories to keep our users informed and protected.',
    ],
  },
  {
    icon: <Shield size={20} />,
    title: 'Compliance & Certifications',
    color: 'rose',
    content: [
      compliance.soc2Certified
        ? `LegalEase is SOC-2 ${compliance.soc2Type} certified, demonstrating our commitment to availability, confidentiality, and processing integrity.`
        : 'LegalEase follows industry-standard security practices to ensure availability, confidentiality, and processing integrity.',
      'We are fully compliant with GDPR (EU), CCPA (California), HIPAA (healthcare data), and ISO/IEC 27001 information security standards.',
      'Our compliance posture is audited annually by independent third-party assessors.',
      'We maintain a detailed audit trail of all document processing activity for a minimum of 7 years.',
    ],
  },
];

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
};

interface TrustBadge {
  label: string;
  sub: string;
  color: string;
}

const trustBadges: TrustBadge[] = [
  ...(compliance.soc2Certified
    ? [{ label: `SOC-2 ${compliance.soc2Type}`, sub: 'Certified', color: 'text-blue-600 dark:text-blue-400' }]
    : []),
  { label: 'GDPR', sub: 'Compliant', color: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'HIPAA', sub: 'Compliant', color: 'text-purple-600 dark:text-purple-400' },
  { label: 'ISO 27001', sub: 'Certified', color: 'text-amber-600 dark:text-amber-400' },
];

export function SecurityPage() {
  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen">
      {/* Hero */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-emerald-50/60 via-teal-50/20 to-white dark:from-gray-900 dark:via-gray-950 dark:to-emerald-950 border-b border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb60_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb60_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#8080800e_1px,transparent_1px),linear-gradient(to_bottom,#8080800e_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-emerald-600/10 dark:bg-emerald-600/20 rounded-full filter blur-[100px] animate-pulse pointer-events-none" />
        <div className="app-container relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600/10 dark:bg-emerald-500/10 border border-emerald-600/20 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-6">
            <Shield size={12} />
            <span>Enterprise Grade</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            Security at LegalEase
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-base leading-relaxed">
            Your legal documents are among your most sensitive assets. We've built our entire infrastructure around protecting them with the highest security standards in the industry.
          </p>

          {/* Trust badges */}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex flex-col items-center px-6 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm"
              >
                <CheckCircle2 size={18} className={`mb-1 ${badge.color}`} />
                <span className={`text-sm font-bold ${badge.color}`}>{badge.label}</span>
                <span className="text-xs text-gray-400">{badge.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="app-container max-w-4xl">
          <div className="space-y-10">
            {sections.map((section) => (
              <div
                key={section.title}
                className="group p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[section.color]}`}>
                    {section.icon}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{section.title}</h2>
                </div>
                <ul className="space-y-3">
                  {section.content.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center">
            <Shield className="mx-auto text-emerald-600 dark:text-emerald-400 mb-3" size={28} />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Found a security vulnerability?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              We take all security reports seriously. Please disclose responsibly and we will respond within 24 hours.
            </p>
            <a
              href={`mailto:${siteConfig.securityEmail}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
            >
              <Mail size={14} />
              {siteConfig.securityEmail}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
