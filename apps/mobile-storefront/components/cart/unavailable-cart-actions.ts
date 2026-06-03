function reportUnavailableCartAction(action: string) {
  console.error(
    `[CartScreen] Attempted cart action while unavailable: ${action}`
  );
}

export const unavailableCartActions = {
  clearCart: () => {
    reportUnavailableCartAction('clearCart()');
  },
  removeItem: (itemId: string) => {
    reportUnavailableCartAction(`removeItem(${itemId})`);
  },
  toggleAssurance: (itemId: string) => {
    reportUnavailableCartAction(`toggleAssurance(${itemId})`);
  },
  updateQuantity: (itemId: string, quantity: number) => {
    reportUnavailableCartAction(`updateQuantity(${itemId}, ${quantity})`);
  },
};
