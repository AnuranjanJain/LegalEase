import { ExternalLink, FileText, BookOpen, ShieldCheck, ClipboardList, Globe, Info, HelpCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const RESOURCES = [
  {
    title: 'IPC / BNS Section Directory',
    description: 'Browse a curated section directory that maps legal issues to Indian Penal Code and Business Network Services references for fast context.',
    icon: Info,
  },
  {
    title: 'Legal Terminology Glossary',
    description: 'Search plain-language definitions for contract terms, obligation clauses, statutory phrases, and frequently used legal jargon.',
    icon: BookOpen,
  },
  {
    title: 'Frequently Asked Legal Questions',
    description: 'Get instant answers to common legal questions about contracts, privacy, rights, liability, and compliance.',
    icon: HelpCircle,
  },
  {
    title: 'Legal Rights Awareness Guides',
    description: 'Learn your rights with easy guides for employment, tenancy, consumer protection, intellectual property, and more.',
    icon: ShieldCheck,
  },
  {
    title: 'Downloadable Legal Templates',
    description: 'Access sample agreements, notices, consent forms, and letters to use as a starting point for your documents.',
    icon: ClipboardList,
  },
  {
    title: 'Government Legal Resource Links',
    description: 'Find official portals, public notices, and government guidance for accurate legal support and forms.',
    icon: Globe,
  },
];

const GLOSSARY = [
  { term: 'Indemnity', description: 'A contractual commitment to compensate another party for losses or damages that arise from specified events.' },
  { term: 'Force Majeure', description: 'A clause that excuses performance when extraordinary events outside a party’s control prevent fulfillment.' },
  { term: 'Arbitration', description: 'A process for resolving disputes privately through a neutral third party instead of litigation.' },
  { term: 'Confidentiality', description: 'An agreement to keep certain information private and not disclose it to unauthorized parties.' },
];

const FAQS = [
  {
    question: 'Can I use LegalEase resources without starting a chatbot session?',
    answer: 'Yes. The Legal Resources hub gives you self-service legal content without the need to open a chatbot conversation first.',
  },
  {
    question: 'Where can I find downloadable templates?',
    answer: 'The Templates section contains sample forms and letters. Use them as a starting point and customize them with your own details.',
  },
  {
    question: 'Are the government links official?',
    answer: 'We link to trusted public government portals and legal awareness sites for direct access to official guidance and forms.',
  },
];

const GUIDES = [
  { title: 'Know Your Consumer Rights', description: 'Understand basic protections available under consumer law and how to file a complaint.' },
  { title: 'Tenant Rights & Responsibilities', description: 'Learn what landlords and renters are entitled to under rental agreements and housing rules.' },
  { title: 'Employment Terms Simplified', description: 'Review core employee rights, notice periods, and workplace compliance basics.' },
  { title: 'Protecting Intellectual Property', description: 'Discover how copyrights, trademarks, and trade secrets work to secure creative and business assets.' },
];

const TEMPLATES = [
  { name: 'Non-Disclosure Agreement (NDA)', href: '#' },
  { name: 'Notice of Termination', href: '#' },
  { name: 'Service Agreement Summary', href: '#' },
  { name: 'Consent Letter Template', href: '#' },
];

const GOVERNMENT_LINKS = [
  { label: 'Ministry of Law and Justice', href: 'https://lawmin.gov.in' },
  { label: 'Govt. e-Repository', href: 'https://egazette.nic.in' },
  { label: 'Consumer Helpline', href: 'https://consumerhelpline.gov.in' },
  { label: 'Intellectual Property India', href: 'https://ipindia.gov.in' },
];

export function LegalResourcesPage() {
  return (
    <div className="app-container py-16">
      <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/80">Legal Resources</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
            A centralized hub for legal knowledge, guides, and templates.
          </h1>
          <p className="mt-4 max-w-2xl text-gray-600 dark:text-gray-300 leading-7">
            Explore curated resources across terminology, rights awareness, frequently asked questions, and official government links — all in one place for easier legal self-service.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {RESOURCES.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm hover:shadow-lg transition-shadow">
                  <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-primary/10 text-primary mb-4">
                    <Icon size={20} />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{card.title}</h2>
                  <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Quick start</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Jump to the section you need most.</p>
              </div>
              <ExternalLink size={18} className="text-primary" />
            </div>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <NavLink to="#glossary" className="block rounded-xl px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">Glossary</NavLink>
              <NavLink to="#guides" className="block rounded-xl px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">Rights Guides</NavLink>
              <NavLink to="#faq" className="block rounded-xl px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">FAQs</NavLink>
              <NavLink to="#templates" className="block rounded-xl px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">Templates</NavLink>
              <NavLink to="#government" className="block rounded-xl px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">Government Links</NavLink>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <FileText size={20} className="text-primary" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Need faster help?</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Use the chatbot floating button anytime.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-6">
              The chatbot stays available on every page via the action button in the lower right corner. It is perfect for follow-up questions, document clarification, and conversational guidance.
            </p>
          </div>
        </aside>
      </div>

      <section id="glossary" className="mt-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/80">Glossary</p>
            <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">Legal terminology made simple</h2>
          </div>
          <p className="max-w-xl text-sm text-gray-600 dark:text-gray-400">Learn common legal terms and meanings without jargon.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {GLOSSARY.map((item) => (
            <div key={item.term} className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{item.term}</h3>
              <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mt-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/80">FAQs</p>
            <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">Frequently asked legal questions</h2>
          </div>
          <p className="max-w-xl text-sm text-gray-600 dark:text-gray-400">Explore answers tailored for users seeking clarity before they consult a lawyer.</p>
        </div>

        <div className="mt-8 space-y-4">
          {FAQS.map((item) => (
            <div key={item.question} className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm">
              <p className="text-base font-semibold text-gray-900 dark:text-white mb-2">{item.question}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-6">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="guides" className="mt-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/80">Guides</p>
            <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">Rights awareness guides</h2>
          </div>
          <p className="max-w-xl text-sm text-gray-600 dark:text-gray-400">Trusted summaries to help you understand your rights and options.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {GUIDES.map((guide) => (
            <div key={guide.title} className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{guide.title}</h3>
                <ShieldCheck size={18} className="text-primary" />
              </div>
              <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">{guide.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="templates" className="mt-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/80">Templates</p>
            <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">Downloadable legal templates</h2>
          </div>
          <p className="max-w-xl text-sm text-gray-600 dark:text-gray-400">Ready-to-use documents to help you create legal notices, agreements, and consent letters.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TEMPLATES.map((template) => (
            <a key={template.name} href={template.href} className="block rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-sm hover:border-primary hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{template.name}</p>
                </div>
                <ExternalLink size={18} className="text-gray-500 dark:text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Download the template and personalize it for your use case.</p>
            </a>
          ))}
        </div>
      </section>

      <section id="government" className="mt-16 pb-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/80">Government Links</p>
            <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">Official legal portals</h2>
          </div>
          <p className="max-w-xl text-sm text-gray-600 dark:text-gray-400">Direct access to trusted government legal resources and public forms.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {GOVERNMENT_LINKS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm hover:border-primary hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{item.label}</p>
                </div>
                <ExternalLink size={18} className="text-primary" />
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
