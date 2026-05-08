import {
  Apple,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Music,
  Phone,
  Twitter,
  Youtube,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { Logo } from './logo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0a0a0a] text-white pt-20 pb-10 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-gray-800 to-transparent" />
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

      {/* Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: '140px 140px',
        }}
      />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {/* Column 1: Brand Info (Compact) */}
          <div className="space-y-4">
            <Link
              href="/"
              className="flex items-center cursor-pointer select-none"
            >
              <Logo className="h-8 w-auto" />
            </Link>
            <p className="text-gray-400 text-xs leading-relaxed max-w-xs">
              Making Smartphones Accessible and Affordable
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <a
                href="https://instagram.com/ogabasseyy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
              <a
                href="https://facebook.com/ogabasseyy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={20} />
              </a>
              <a
                href="https://www.tiktok.com/@ogabasseyy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="TikTok"
              >
                <Music size={20} />
              </a>
              <a
                href="https://twitter.com/ogabasseyy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={20} />
              </a>
              <a
                href="https://youtube.com/@ogabasseyy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="YouTube"
              >
                <Youtube size={20} />
              </a>
              <a
                href="https://ng.linkedin.com/company/ogabasseyy?trk=public_post_feed-actor-name"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links (Merged) */}
          <div className="flex justify-between md:justify-start gap-12">
            <div>
              <h3 className="text-sm font-bold mb-4 text-white uppercase tracking-wider">
                Company
              </h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li>
                  <Link href="/about" className="hover:text-red-500">
                    About Us
                  </Link>
                </li>
                <li>
                  <a href="#" className="hover:text-red-500">
                    Careers
                  </a>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-red-500">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-red-500">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/legal" className="hover:text-red-500">
                    Legal & Disputes
                  </Link>
                </li>
                <li>
                  <Link href="/sustainability" className="hover:text-red-500">
                    Sustainability
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-4 text-white uppercase tracking-wider">
                Services
              </h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li>
                  <Link href="/repairs" className="hover:text-red-500">
                    Repairs
                  </Link>
                </li>
                <li>
                  <Link href="/swap" className="hover:text-red-500">
                    Sell Device
                  </Link>
                </li>
                <li>
                  <Link href="/orders" className="hover:text-red-500">
                    Track Order
                  </Link>
                </li>
                <li>
                  <Link href="/help" className="hover:text-red-500">
                    Support
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Column 3: Contact (Compact) */}
          <div>
            <h3 className="text-sm font-bold mb-4 text-white uppercase tracking-wider">
              Contact
            </h3>
            <ul className="space-y-3 text-xs text-gray-400">
              <li className="flex items-start gap-2">
                <MapPin className="shrink-0 text-red-600" size={16} />
                <span>2 Olaide Tomori St, Ikeja, Lagos</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="shrink-0 text-red-600" size={16} />
                <span>+234 814 697 8921</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="shrink-0 text-red-600" size={16} />
                <a
                  href="mailto:support@ogabassey.com"
                  className="hover:text-white transition-colors"
                >
                  support@ogabassey.com
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: App & Payment (Horizontal) */}
          <div>
            <h3 className="text-sm font-bold mb-4 text-white uppercase tracking-wider">
              Download App
            </h3>
            <div className="flex gap-2 mb-6">
              <button className="flex items-center gap-2 bg-black border border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-900 transition-colors group">
                <Apple size={22} className="text-white fill-current" />
                <div className="text-left leading-none">
                  <div className="text-[9px] text-gray-400 font-medium group-hover:text-gray-300">
                    Download on the
                  </div>
                  <div className="text-[13px] font-bold text-white tracking-wide">
                    App Store
                  </div>
                </div>
              </button>
              <button className="flex items-center gap-2 bg-black border border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-900 transition-colors group">
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path
                    fill="#4285F4"
                    d="M23.64 12.48l-2.95-3.07L16.2 13.9l4.49 4.49c.87-.93 1.35-2.22.95-3.55zM.65 1.57C.24 2.21 0 3.06 0 4.13v15.74c0 1.07.24 1.92.65 2.56l.06.05L13.1 10.09v-.19L.71 1.52l-.06.05z"
                  />
                  <path
                    fill="#34A853"
                    d="M14.39 12.1L2.09 24.4c.39.11.83.07 1.19-.13l16.29-9.28-5.18-5.18v2.29z"
                  />
                  <path
                    fill="#EA4335"
                    d="M2.09-.4c-.36-.2-.8-.24-1.19-.13L14.39 11.9l5.18-5.18L3.28-.53c-.39-.2-.79-.2-1.19.13z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M.65 1.57C.24 2.21 0 3.06 0 4.13v15.74c0 1.07.24 1.92.65 2.56l.06.05L13.1 10.09v-.19L.71 1.52l-.06.05z"
                  />
                </svg>
                <div className="text-left leading-none">
                  <div className="text-[9px] text-gray-400 font-medium group-hover:text-gray-300 uppercase">
                    Get it on
                  </div>
                  <div className="text-[13px] font-bold text-white tracking-wide">
                    Google Play
                  </div>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-3 opacity-70 grayscale hover:grayscale-0 transition-all">
              <span className="text-xs font-bold text-white">Secured by:</span>
              <div className="h-4 w-auto bg-white/20 rounded px-1 flex items-center justify-center text-[8px] font-bold text-white tracking-tighter px-2">
                PAYSTACK
              </div>
              <div className="h-4 w-auto bg-white/20 rounded px-1 flex items-center justify-center text-[8px] font-bold text-white tracking-tighter px-2">
                FLUTTERWAVE
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-800 text-center text-[10px] text-gray-500">
          <span suppressHydrationWarning>&copy; {new Date().getFullYear()} Ogabassey Ltd. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
};
