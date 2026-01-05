export interface SetupItem {
    id: string;
    label: string;
    description: string;
    completed: boolean;
    href: string; // This will now be a React Native route string
    priority: 'required' | 'recommended' | 'optional';
    category: 'payments' | 'products' | 'store' | 'legal' | 'marketing';
}

export interface StoreReadiness {
    isReady: boolean;
    isPublished: boolean;
    completedRequired: number;
    totalRequired: number;
    completedRecommended: number;
    totalRecommended: number;
    overallProgress: number;
    items: SetupItem[];
}
