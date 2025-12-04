import { create } from 'zustand';

interface OnboardingUIState {
  isLogoUploaded: boolean;
  setLogoUploaded: (isUploaded: boolean) => void;
  logoDataUri: string | null;
  setLogoDataUri: (uri: string | null) => void;
}

export const useOnboardingUIStore = create<OnboardingUIState>((set) => ({
  isLogoUploaded: false,
  setLogoUploaded: (isUploaded) => set({ isLogoUploaded: isUploaded }),
  logoDataUri: null,
  setLogoDataUri: (uri) => set({ logoDataUri: uri }),
}));
