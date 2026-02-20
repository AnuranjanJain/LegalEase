import { useState } from 'react';
import { Search, Book, FileText, Scale, Gavel, Building2, Download } from 'lucide-react';

interface DocCategory {
    id: string;
    name: string;
    icon: React.ElementType;
    description: string;
    documents: Document[];
}

interface Document {
    id: string;
    title: string;
    type: 'PDF' | 'DOCX' | 'TXT';
    size: string;
    date: string;
}

export function DocumentationPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const categories: DocCategory[] = [
        {
            id: 'civil',
            name: 'Civil Law',
            icon: Scale,
            description: 'Contracts, property disputes, and family law documents.',
            documents: [
                { id: 'c1', title: 'Standard Lease Agreement', type: 'PDF', size: '2.4 MB', date: '2024-02-15' },
                { id: 'c2', title: 'Divorce Petition Template', type: 'DOCX', size: '1.1 MB', date: '2024-01-20' },
                { id: 'c3', title: 'Property Sale Deed', type: 'PDF', size: '3.5 MB', date: '2023-12-10' },
            ]
        },
        {
            id: 'criminal',
            name: 'Criminal Law',
            icon: Gavel,
            description: 'Penal codes, procedural guidelines, and case law summaries.',
            documents: [
                { id: 'cr1', title: 'Criminal Procedure Code Summary', type: 'PDF', size: '5.2 MB', date: '2024-02-01' },
                { id: 'cr2', title: 'Bail Application Format', type: 'DOCX', size: '0.8 MB', date: '2024-01-15' },
            ]
        },
        {
            id: 'corporate',
            name: 'Corporate Law',
            icon: Building2,
            description: 'Company incorporation, compliance, and regulatory documents.',
            documents: [
                { id: 'co1', title: 'Articles of Incorporation', type: 'PDF', size: '1.8 MB', date: '2024-02-10' },
                { id: 'co2', title: 'Board Resolution Template', type: 'DOCX', size: '0.5 MB', date: '2024-02-05' },
                { id: 'co3', title: 'Non-Disclosure Agreement (NDA)', type: 'PDF', size: '3.1 MB', date: '2024-01-30' },
            ]
        },
        {
            id: 'constitutional',
            name: 'Constitutional Law',
            icon: Book,
            description: 'Constitution articles, amendments, and landmark judgments.',
            documents: [
                { id: 'cn1', title: 'Constitution of India - Full Text', type: 'PDF', size: '12.5 MB', date: '2023-11-26' },
                { id: 'cn2', title: 'Fundamental Rights Overview', type: 'PDF', size: '1.5 MB', date: '2024-01-01' },
            ]
        },
    ];

    const filteredCategories = activeCategory === 'all'
        ? categories
        : categories.filter(c => c.id === activeCategory);

    // Further filter documents by search query
    const displayCategories = filteredCategories.map(cat => ({
        ...cat,
        documents: cat.documents.filter(doc =>
            doc.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(cat => cat.documents.length > 0 || searchQuery === '');

    return (
        <div className="app-container py-8">
            {/* Header Section */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Legal Documentation</h1>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
                    Access a comprehensive library of legal documents, templates, and references across various domains of law.
                </p>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <button
                        onClick={() => setActiveCategory('all')}
                        className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${activeCategory === 'all'
                            ? 'bg-primary text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        All Categories
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${activeCategory === cat.id
                                ? 'bg-primary text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <cat.icon size={16} />
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Grid */}
            <div className="space-y-8">
                {displayCategories.map((category) => (
                    <div key={category.id} className="animate-fade-in">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <category.icon size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{category.name}</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {category.documents.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="group bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                            <FileText size={20} />
                                        </div>
                                        <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                            {doc.type}
                                        </span>
                                    </div>

                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-primary transition-colors line-clamp-1">
                                        {doc.title}
                                    </h3>

                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-4">
                                        <span>{doc.size} • {doc.date}</span>
                                        <button className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {category.documents.length === 0 && (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                No documents found matching your search.
                            </div>
                        )}
                    </div>
                ))}

                {displayCategories.length === 0 && (
                    <div className="text-center py-12">
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                            <Search size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No results found</h3>
                        <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or category filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
