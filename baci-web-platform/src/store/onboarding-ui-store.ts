import { create } from 'zustand';

interface OnboardingUIState {
  isLogoUploaded: boolean;
  setLogoUploaded: (isUploaded: boolean) => void;
  logoDataUri: string | null;
  setLogoDataUri: (uri: string | null) => void;
  showMobilePreview: boolean;
  setShowMobilePreview: (show: boolean) => void;
  showTemplateSelector: boolean;
  setShowTemplateSelector: (show: boolean) => void;
}

export const useOnboardingUIStore = create<OnboardingUIState>((set) => ({
  isLogoUploaded: false,
  setLogoUploaded: (isUploaded) => set({ isLogoUploaded: isUploaded }),
  logoDataUri: null,
  setLogoDataUri: (uri) => set({ logoDataUri: uri }),
  showMobilePreview: false,
  setShowMobilePreview: (show) => set({ showMobilePreview: show }),
  showTemplateSelector: false,
  setShowTemplateSelector: (show) => set({ showTemplateSelector: show }),
}));
