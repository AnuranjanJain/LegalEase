import { Shield, Lock, Eye, Database, Globe, Mail } from 'lucide-react';

interface Section {
  icon: JSX.Element;
  title: string;
  color: string;
  content: string[];
}

const sections: Section[] = [
  {
    icon: <Eye size={20} />,
    title: 'Information We Collect',
    color: 'blue',
    content: [
      'Account information such as your name, email address, and password when you register.',
      'Documents and files you upload for analysis — processed in isolated sandbox environments and never used for model training.',
      'Usage data including page visits, feature interactions, and session metadata to improve platform performance.',
      'Device information such as browser type, IP address, and operating system for security and analytics purposes.',
    ],
  },
  {
    icon: <Database size={20} />,
    title: 'How We Use Your Data',
    color: 'emerald',
    content: [
      'To provide, operate, and maintain the LegalEase platform and its AI-powered document analysis services.',
      'To personalize your experience and deliver relevant insights based on your document history.',
      'To communicate important product updates, security alerts, and service announcements.',
      'To comply with applicable legal obligations and enforce our Terms of Service.',
    ],
  },
  {
    icon: <Lock size={20} />,
    title: 'Data Security',
    color: 'purple',
    content: [
      'All data is encrypted in transit using TLS 1.3 and at rest using AES-256 bank-grade encryption.',
      'Your uploaded documents are processed in isolated pipelines and are never exposed to shared infrastructure.',
      'We enforce strict role-based access controls — only authorized personnel can access operational logs.',
      'LegalEase is SOC-2 Type II certified and undergoes regular third-party penetration testing.',
    ],
  },
  {
    icon: <Globe size={20} />,
    title: 'Data Sharing',
    color: 'amber',
    content: [
      'We do not sell, rent, or trade your personal information or document data to third parties.',
      'We may share anonymized, aggregated usage statistics with trusted analytics partners.',
      'Data may be disclosed to law enforcement only when required by a valid legal order or court subpoena.',
      'Service providers acting on our behalf are contractually bound to confidentiality and data protection obligations.',
    ],
  },
  {
    icon: <Shield size={20} />,
    title: 'Your Rights',
    color: 'rose',
    content: [
      'You have the right to access, correct, or delete your personal data at any time from your Profile settings.',
      'You may request a full export of your data in a machine-readable format by contacting our support team.',
      'You can opt out of non-essential communications via your notification preferences in Settings.',
      'Residents of the EU/EEA have additional rights under GDPR including the right to data portability and erasure.',
    ],
  },
];

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  emerald:
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  purple:
    'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
};

export function PrivacyPage() {
  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen">
      {/* Hero */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50/60 via-indigo-50/20 to-white dark:from-gray-900 dark:via-gray-950 dark:to-blue-950 border-b border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb60_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb60_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#8080800e_1px,transparent_1px),linear-gradient(to_bottom,#8080800e_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-600/10 dark:bg-blue-600/20 rounded-full filter blur-[100px] animate-pulse pointer-events-none" />
        <div className="app-container relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 dark:bg-blue-500/10 border border-blue-600/20 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-6">
            <Shield size={12} />
            <span>Legal Document</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-base leading-relaxed">
            We are committed to protecting your personal information and your
            right to privacy. This policy outlines how LegalEase collects, uses,
            and safeguards your data.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Last updated: May 22, 2026
          </p>
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
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[section.color]}`}
                  >
                    {section.icon}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {section.title}
                  </h2>
                </div>
                <ul className="space-y-3">
                  {section.content.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed"
                    >
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/50 text-center">
            <Mail
              className="mx-auto text-blue-600 dark:text-blue-400 mb-3"
              size={28}
            />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Questions about this policy?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Our Data Protection Officer is available to address any concerns
              you may have.
            </p>
            <a
              href="mailto:privacy@legalease.io"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
            >
              <Mail size={14} />
              privacy@legalease.io
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
