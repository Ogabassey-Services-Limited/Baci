
import React, { useEffect } from 'react';
import { Shield, Lock, Eye, Database, Share2, Cookie, Mail, FileText } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      title: "Information We Collect",
      icon: Database,
      content: (
        <>
          <p className="mb-4">We collect information to provide better services to all our users. This includes:</p>
          <ul className="list-disc pl-5 space-y-2 text-gray-600">
            <li><strong>Personal Information:</strong> Name, email address, phone number, and shipping address provided during checkout or account creation.</li>
            <li><strong>Payment Information:</strong> We do not store your credit card details. All transactions are processed securely through our payment partners (e.g., Paystack, Flutterwave).</li>
            <li><strong>Usage Data:</strong> Information about how you use our website, such as products viewed, search queries, and device information (IP address, browser type).</li>
          </ul>
        </>
      )
    },
    {
      title: "How We Use Your Information",
      icon: Eye,
      content: (
        <>
          <p className="mb-4">We use the information we collect for the following purposes:</p>
          <ul className="list-disc pl-5 space-y-2 text-gray-600">
            <li>To process and fulfill your orders, including sending emails to confirm your order status and shipment.</li>
            <li>To communicate with you about products, services, offers, promotions, and rewards.</li>
            <li>To improve our website functionality and user experience based on usage patterns.</li>
            <li>To detect and prevent fraud, abuse, and security incidents.</li>
          </ul>
        </>
      )
    },
    {
      title: "Data Security",
      icon: Lock,
      content: (
        <p>
          We implement a variety of security measures to maintain the safety of your personal information. Your personal data is contained behind secured networks and is only accessible by a limited number of persons who have special access rights to such systems, and are required to keep the information confidential. All sensitive/credit information you supply is encrypted via Secure Socket Layer (SSL) technology.
        </p>
      )
    },
    {
      title: "Sharing Your Information",
      icon: Share2,
      content: (
        <p>
          We do not sell, trade, or otherwise transfer to outside parties your Personally Identifiable Information unless we provide users with advance notice. This does not include website hosting partners and other parties who assist us in operating our website, conducting our business, or serving our users, so long as those parties agree to keep this information confidential. We may also release information when it's release is appropriate to comply with the law, enforce our site policies, or protect ours or others' rights, property or safety.
        </p>
      )
    },
    {
      title: "Cookies",
      icon: Cookie,
      content: (
        <p>
          Yes, we use cookies. Cookies are small files that a site or its service provider transfers to your computer's hard drive through your Web browser (if you allow) that enables the site's or service provider's systems to recognize your browser and capture and remember certain information. For instance, we use cookies to help us remember and process the items in your shopping cart. They are also used to help us understand your preferences based on previous or current site activity, which enables us to provide you with improved services.
        </p>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#1a1a1a] text-white py-16 md:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/security.png')]"></div>
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/10">
             <Shield size={32} className="text-red-500" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">Privacy Policy</h1>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
            Last Updated: May 20, 2024
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 -mt-10 relative z-20">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-12 space-y-12">
          
          <div className="prose max-w-none text-gray-600">
            <p className="lead text-lg">
              At <strong>Ogabassey Limited</strong>, accessible from ogabassey.com, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by Ogabassey and how we use it.
            </p>
            <p>
              If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us.
            </p>
          </div>

          <div className="space-y-10">
            {sections.map((section, idx) => (
              <div key={idx} className="flex gap-4 md:gap-6">
                <div className="shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100">
                    <section.icon size={20} />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">{section.title}</h2>
                  <div className="text-gray-600 text-sm md:text-base leading-relaxed">
                    {section.content}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 mt-8">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="text-red-600" size={20} />
              Contact Us regarding Privacy
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              If you have any questions about this Privacy Policy, the practices of this site, or your dealings with this site, please contact us at:
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
                <a href="mailto:support@ogabassey.com" className="text-red-600 font-bold hover:underline">
                    support@ogabassey.com
                </a>
                <span className="hidden sm:inline text-gray-300">|</span>
                <span className="text-gray-700 font-medium">
                    2 Olaide Tomori St, Ikeja, Lagos
                </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
