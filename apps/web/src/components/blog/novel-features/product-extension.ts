import { Extension } from '@tiptap/core';

export interface ProductExtensionOptions {
  onOpenPicker: () => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    productExtension: {
      openProductPicker: () => ReturnType;
    };
  }
}

export const ProductExtension = Extension.create<ProductExtensionOptions>({
  name: 'productExtension',

  addOptions() {
    return {
      onOpenPicker: () => {
        // Default empty handler
      },
    };
  },

  addCommands() {
    return {
      openProductPicker: () => () => {
        this.options.onOpenPicker();
        return true;
      },
    };
  },
});
