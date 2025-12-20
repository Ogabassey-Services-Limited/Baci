
import React, { useEffect } from 'react';
import { Scale, ShieldAlert, Gavel, FileText, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const LegalDisputePage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      title: "Terms of Service",
      icon: FileText,
      content: (
        <div className="space-y-4">
          <p>
            By accessing and using the Ogabassey Limited website and services, you agree to comply with and be bound by these terms. If you do not agree to these terms, please do not use our services.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-600">
            <li><strong>Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your account and password.</li>
            <li><strong>Product Accuracy:</strong> We strive for accuracy, but we do not warrant that product descriptions or prices are error-free. In the event of a pricing error, we reserve the right to cancel orders.</li>
            <li><strong>"UK Used" Definition:</strong> Devices labeled as "UK Used" are pre-owned. While we ensure high quality, they may have minor cosmetic signs of use unless stated otherwise.</li>
          </ul>
        </div>
      )
    },
    {
      title: "Dispute Resolution Policy",
      icon: Scale,
      content: (
        <div className="space-y-4">
          <p>
            We believe in resolving issues quickly and fairly. In the event of a dispute, the following process applies:
          </p>
          <ol className="list-decimal pl-5 space-y-3 text-gray-600">
            <li>
              <strong>Step 1: Contact Support.</strong> Most issues can be resolved by our customer care team. Please email <a href="mailto:support@ogabassey.com" className="text-red-600 font-bold">support@ogabassey.com</a> with your Order ID and details of the complaint.
            </li>
            <li>
              <strong>Step 2: Internal Escalation.</strong> If support cannot resolve the issue within 48 hours, it will be escalated to a Management Supervisor for review.
            </li>
            <li>
              <strong>Step 3: Mediation.</strong> If a resolution is not reached amicably, both parties agree to seek mediation through the Lagos Multi-Door Courthouse (LMDC) before pursuing litigation.
            </li>
          </ol>
        </div>
      )
    },
    {
      title: "Limitation of Liability",
      icon: ShieldAlert,
      content: (
        <p>
          Ogabassey Limited shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the services. Our total liability for any claim arising out of or relating to these terms or our services shall not exceed the amount paid by you for the product or service giving rise to the claim.
        </p>
      )
    },
    {
      title: "Governing Law",
      icon: Gavel,
      content: (
        <p>
          These Terms shall be governed and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to its conflict of law provisions. Any legal action or proceeding arising under these Terms will be brought exclusively in the federal or state courts located in Lagos, Nigeria.
        </p>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Header */}
      <div className="bg-[#1a1a1a] text-white py-16 md:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/gplay.png')]"></div>
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/10">
             <Scale size={32} className="text-red-500" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">Legal & Dispute Resolution</h1>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
            Transparency, Fairness, and Trust.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 -mt-10 relative z-20">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-12 space-y-12">
          
          <div className="prose max-w-none text-gray-600">
            <p className="text-lg">
              At Ogabassey, we value our relationship with our customers. We have established these legal guidelines to ensure clarity and protection for both parties.
            </p>
          </div>

          <div className="space-y-10">
            {sections.map((section, idx) => (
              <div key={idx} className="flex gap-4 md:gap-6">
                <div className="shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-50 text-gray-700 rounded-xl flex items-center justify-center border border-gray-200">
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

          <div className="bg-red-50 rounded-2xl p-8 border border-red-100 mt-8">
            <h3 className="font-bold text-red-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={20} />
              Important Note on Returns
            </h3>
            <p className="text-red-800 text-sm mb-4 leading-relaxed">
              Please note that our <strong>7-Day Return Policy</strong> applies strictly to devices with technical defects that were not disclosed at the time of purchase. Physical damage, liquid damage, or modification of the device software by the user voids all warranties and return rights.
            </p>
            <div className="flex items-center gap-2 text-sm text-red-700 font-bold">
               <CheckCircle2 size={16} /> All serial numbers are recorded to prevent fraud.
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8 mt-8">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="text-gray-400" size={20} />
              Legal Contact
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              For official legal notices or service of process, please contact us at:
            </p>
            <div className="flex flex-col sm:flex-row gap-4 text-sm">
                <a href="mailto:support@ogabassey.com" className="text-red-600 font-bold hover:underline">
                    support@ogabassey.com
                </a>
                <span className="hidden sm:inline text-gray-300">|</span>
                <span className="text-gray-700 font-medium">
                    2 Olaide Tomori St, Ikeja, Lagos, Nigeria
                </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
