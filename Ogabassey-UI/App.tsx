
import React, { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './components/Home';
import { ProductDetails } from './components/ProductDetails';
import { CategoryPage } from './components/CategoryPage';
import { SavedPage } from './components/SavedPage';
import { Footer } from './components/Footer';
import { CartPage } from './components/CartPage';
import { WalletPage } from './components/WalletPage';
import { ProfilePage } from './components/ProfilePage';
import { ReviewsPage } from './components/ReviewsPage';
import { MemberStatusPage } from './components/MemberStatusPage';
import { ReceiptsPage } from './components/ReceiptsPage';
import { AddressBookPage } from './components/AddressBookPage';
import { OrdersPage } from './components/OrdersPage';
import { OrderDetailsPage } from './components/OrderDetailsPage';
import { PurchaseHistoryPage } from './components/PurchaseHistoryPage';
import { RepairsPage } from './components/RepairsPage';
import { SwapPage } from './components/SwapPage';
import { ImeiCheckerPage } from './components/ImeiCheckerPage';
import { NotificationsPage } from './components/NotificationsPage';
import { SecurityPage } from './components/SecurityPage';
import { HelpSupportPage } from './components/HelpSupportPage';
import { AboutUsPage } from './components/AboutUsPage';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { SustainabilityPage } from './components/SustainabilityPage';
import { BlogPage } from './components/BlogPage';
import { LegalDisputePage } from './components/LegalDisputePage';
import { CartProvider } from './contexts/CartContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SavedProvider } from './contexts/SavedContext';
import { ComparisonProvider } from './contexts/ComparisonContext';
import { AdUnit } from './components/AdUnit';
import { ChatWidget } from './components/ChatWidget';
import { MobileFooter } from './components/MobileFooter';
import { PopupSystem } from './components/PopupSystem';
import { OfflineNotice } from './components/OfflineNotice';
import { UpsellToast } from './components/UpsellToast';
import { SavedToast } from './components/SavedToast';
import { SnowEffect } from './components/SnowEffect';
import { Product } from './types';

// Wrapper component to consume CartContext inside Router
const AppContent: React.FC = () => {
    
    return (
        <div className="w-full min-h-screen bg-white font-sans text-gray-900 relative">
          <Navbar />
          <SnowEffect />
          
          <ChatWidget />
          <PopupSystem />
          <OfflineNotice />

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/category/:categoryName" element={<CategoryPage />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/member-status" element={<MemberStatusPage />} />
            <Route path="/receipts" element={<ReceiptsPage />} />
            <Route path="/addresses" element={<AddressBookPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/order/:orderId" element={<OrderDetailsPage />} />
            <Route path="/purchase-history" element={<PurchaseHistoryPage />} />
            <Route path="/repairs" element={<RepairsPage />} />
            <Route path="/swap" element={<SwapPage />} />
            <Route path="/imei-check" element={<ImeiCheckerPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/help" element={<HelpSupportPage />} />
            <Route path="/about" element={<AboutUsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/legal" element={<LegalDisputePage />} />
            <Route path="/sustainability" element={<SustainabilityPage />} />
            <Route path="/blog" element={<BlogPage />} />
          </Routes>
          
          <div className="max-w-[1400px] mx-auto px-4 md:px-6">
             <AdUnit placementKey="FOOTER_BANNER" />
          </div>
          
          <Footer />
          <MobileFooter />
          
          <UpsellManager />
          <SavedToastManager />
        </div>
    );
}

// Inner component to hook into Cart Context updates
import { useCart } from './contexts/CartContext';
import { useSaved } from './contexts/SavedContext';

const UpsellManager = () => {
    const { lastAddedProduct, showUpsell, dismissUpsell } = useCart();
    
    return (
        <UpsellToast 
            isVisible={showUpsell} 
            triggerProduct={lastAddedProduct} 
            onClose={dismissUpsell} 
        />
    );
};

const SavedToastManager = () => {
    const { toastState, dismissToast } = useSaved();
    return (
        <SavedToast 
            isVisible={toastState.show} 
            message={toastState.message} 
            type={toastState.type}
            onClose={dismissToast} 
        />
    );
}

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <CartProvider>
          <SavedProvider>
            <ComparisonProvider>
                <HashRouter>
                <AppContent />
                </HashRouter>
            </ComparisonProvider>
          </SavedProvider>
        </CartProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;
