
import React, { useEffect } from 'react';
import { Target, Users, Award, Smile, ChevronRight, CheckCircle2, TrendingUp, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdUnit } from './AdUnit';

export const AboutUsPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const stats = [
    { label: "Happy Customers", value: "50k+", icon: Smile },
    { label: "Gadgets Sold", value: "120k+", icon: TrendingUp },
    { label: "Years of Trust", value: "5+", icon: ShieldCheck },
    { label: "Team Members", value: "45", icon: Users },
  ];

  const values = [
    {
      title: "Quality First",
      desc: "We never compromise. Every device is rigorously tested to ensure it meets our premium standards.",
      icon: Award,
      color: "bg-blue-50 text-blue-600"
    },
    {
      title: "Customer Obsession",
      desc: "Your happiness is our KPI. From pre-sales to after-support, we are with you every step.",
      icon: Users,
      color: "bg-red-50 text-red-600"
    },
    {
      title: "Accessibility",
      desc: "Tech shouldn't break the bank. We offer competitive pricing and flexible swap options.",
      icon: Target,
      color: "bg-green-50 text-green-600"
    }
  ];

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Hero Section */}
      <div className="relative bg-[#1a1a1a] text-white py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-red-600/20 text-red-400 text-xs font-bold uppercase tracking-widest mb-6 border border-red-600/30">
            Our Story
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight leading-tight">
            Making Smartphones <br className="hidden md:block" />
            <span className="text-red-600">Accessible & Affordable</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Ogabassey is Nigeria's premier destination for high-quality new and UK-used gadgets. We are bridging the digital divide, one device at a time.
          </p>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-1/2 left-10 w-24 h-24 border-4 border-white/5 rounded-full animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-red-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Stats Strip */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200/50">
            {stats.map((stat, idx) => (
              <div key={idx} className="py-8 md:py-12 flex flex-col items-center text-center px-4 hover:bg-gray-100/50 transition-colors">
                <stat.icon className="w-8 h-8 text-red-600 mb-3 opacity-80" />
                <span className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-1">{stat.value}</span>
                <span className="text-xs md:text-sm text-gray-500 font-medium uppercase tracking-wide">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-16 md:py-24">
        
        {/* Mission & Vision */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center mb-24">
          <div className="order-2 lg:order-1">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl group">
              <img 
                src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1600&auto=format&fit=crop" 
                alt="Our Team" 
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <p className="font-bold text-lg">The Ogabassey HQ</p>
                <p className="text-sm opacity-80">Lagos, Nigeria</p>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Built on Trust, <br />Driven by Technology.</h2>
            <div className="space-y-6 text-gray-600 leading-relaxed">
              <p>
                Founded with a simple yet ambitious goal: to democratize access to premium technology in Africa. We realized that many people desired high-end devices but were limited by exorbitant prices or fear of counterfeit products.
              </p>
              <p>
                Ogabassey stepped in to fill that gap. By sourcing directly from verified global suppliers and implementing a rigorous quality check process, we ensure that every "UK Used" or "Brand New" device you buy from us is authentic and reliable.
              </p>
              <ul className="space-y-3 pt-2">
                {[
                  "Certified Pre-Owned Devices",
                  "12-Month Warranty on New Items",
                  "7-Day Return Policy",
                  "Secure Payment & Wallet System"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 font-medium text-gray-900">
                    <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Ad Break */}
        <div className="mb-24">
           <AdUnit placementKey="CONTENT_BREAK" />
        </div>

        {/* Core Values */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Why We Do What We Do</h2>
          <p className="text-gray-500">Our core values guide every decision we make, ensuring you get the best experience possible.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {values.map((val, idx) => (
            <div key={idx} className="bg-gray-50 rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${val.color}`}>
                <val.icon size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{val.title}</h3>
              <p className="text-gray-600 leading-relaxed text-sm">{val.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-red-600 rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to upgrade?</h2>
            <p className="text-red-100 text-lg mb-8 max-w-xl mx-auto">Join thousands of satisfied customers and experience the Ogabassey difference today.</p>
            <Link to="/" className="inline-flex items-center gap-2 bg-white text-red-600 font-bold py-4 px-8 rounded-full hover:bg-gray-100 transition-colors shadow-lg active:scale-95">
              Start Shopping <ChevronRight size={20} />
            </Link>
          </div>
          
          {/* Background circles */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>

      </div>
    </div>
  );
};
