import { Scale, FileText, AlertTriangle, UserCheck, Ban, RefreshCw, Mail } from 'lucide-react';
import { siteConfig, formatLegalDate } from '../config/site';

interface Section {
  icon: JSX.Element;
  title: string;
  color: string;
  content: string[];
}

const sections: Section[] = [
  {
    icon: <FileText size={20} />,
    title: 'Acceptance of Terms',
    color: 'blue',
    content: [
      'By accessing or using LegalEase, you agree to be bound by these Terms of Service and all applicable laws and regulations.',
      'If you do not agree with any part of these terms, you are prohibited from using or accessing our platform.',
      'These terms apply to all users including visitors, registered users, and enterprise account holders.',
      'We reserve the right to update these terms at any time. Continued use of the platform constitutes acceptance of revised terms.',
    ],
  },
  {
    icon: <UserCheck size={20} />,
    title: 'User Responsibilities',
    color: 'emerald',
    content: [
      'You are responsible for maintaining the confidentiality of your account credentials and all activity under your account.',
      'You agree to provide accurate, current, and complete information during registration and keep it updated.',
      'You must not upload documents that contain malware, illegal content, or infringe on third-party intellectual property rights.',
      'You agree not to use the platform for unauthorized legal advice, impersonation, or any fraudulent purpose.',
    ],
  },
  {
    icon: <Scale size={20} />,
    title: 'Intellectual Property',
    color: 'purple',
    content: [
      'The LegalEase platform, including its AI models, interface, and branding, is the exclusive property of LegalEase Inc.',
      'You retain full ownership of all documents and content you upload to the platform.',
      'You grant LegalEase a limited, non-exclusive license to process your uploaded documents solely to provide the requested services.',
      'You may not reproduce, distribute, or reverse-engineer any component of the LegalEase platform without written consent.',
    ],
  },
  {
    icon: <AlertTriangle size={20} />,
    title: 'Disclaimers',
    color: 'amber',
    content: [
      'LegalEase provides AI-assisted document analysis as an informational tool only. It does not constitute legal advice.',
      'The platform is provided "as is" without warranties of any kind, express or implied, including fitness for a particular purpose.',
      'We do not guarantee the accuracy, completeness, or timeliness of AI-generated analysis or summaries.',
      'Always consult a qualified legal professional before making decisions based on any output from LegalEase.',
    ],
  },
  {
    icon: <Ban size={20} />,
    title: 'Prohibited Uses',
    color: 'rose',
    content: [
      'Using the platform to process documents containing CSAM, hate speech, or content promoting illegal activities.',
      'Attempting to circumvent, disable, or interfere with any security feature of the platform.',
      'Reselling, sublicensing, or commercially redistributing LegalEase analysis outputs without explicit written authorization.',
      'Automated scraping, crawling, or bulk data extraction from the platform via bots or scripts.',
    ],
  },
  {
    icon: <RefreshCw size={20} />,
    title: 'Termination & Modifications',
    color: 'cyan',
    content: [
      'We reserve the right to suspend or terminate your account at our discretion if you violate these Terms of Service.',
      'You may terminate your account at any time by contacting support. Your data will be deleted within 30 days.',
      'We may modify or discontinue any part of the platform at any time with or without prior notice.',
      'Provisions of these terms that by their nature should survive termination will remain in effect.',
    ],
  },
];

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
};

export function TermsPage() {
  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen">
      {/* Hero */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-50/60 via-indigo-50/20 to-white dark:from-gray-900 dark:via-gray-950 dark:to-purple-950 border-b border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb60_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb60_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#8080800e_1px,transparent_1px),linear-gradient(to_bottom,#8080800e_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-purple-600/10 dark:bg-purple-600/20 rounded-full filter blur-[100px] animate-pulse pointer-events-none" />
        <div className="app-container relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-600/10 dark:bg-purple-500/10 border border-purple-600/20 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-6">
            <Scale size={12} />
            <span>Legal Document</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            Terms of Service
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-base leading-relaxed">
            Please read these terms carefully before using LegalEase. By accessing our platform you agree to be bound by the conditions outlined below.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">Last updated: {formatLegalDate(siteConfig.legalLastUpdated)}</p>
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
          <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-900/50 text-center">
            <Scale className="mx-auto text-purple-600 dark:text-purple-400 mb-3" size={28} />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Questions about our terms?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Reach out to our legal team with any questions or concerns regarding these terms.
            </p>
            <a
              href={`mailto:${siteConfig.legalEmail}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
            >
              <Mail size={14} />
              {siteConfig.legalEmail}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
