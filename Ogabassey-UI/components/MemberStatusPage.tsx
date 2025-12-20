import React from 'react';
import { Crown, Check, Zap, Truck, ShieldCheck, Star, TrendingUp, Gift, UserCheck } from 'lucide-react';

const TIERS = [
  {
    id: 'bronze',
    name: 'Bronze',
    minPoints: 0,
    color: 'from-orange-700 to-orange-900', // Bronze-ish
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/50',
    benefits: ['Standard Delivery', 'Member-only Newsletter']
  },
  {
    id: 'silver',
    name: 'Silver',
    minPoints: 10000,
    color: 'from-slate-400 to-slate-600', // Silver
    textColor: 'text-slate-300',
    borderColor: 'border-slate-400/50',
    benefits: ['2% Discount on Accessories', 'Birthday Gift']
  },
  {
    id: 'gold',
    name: 'Gold',
    minPoints: 50000,
    color: 'from-yellow-600 to-yellow-800', // Gold
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/50',
    benefits: ['Free Delivery > ₦500k', 'Early Access to Sales', 'Priority Support']
  },
  {
    id: 'platinum',
    name: 'Platinum',
    minPoints: 100000,
    color: 'from-cyan-700 to-blue-900', // Platinum/Blueish
    textColor: 'text-cyan-300',
    borderColor: 'border-cyan-400/50',
    benefits: ['5% Discount on Accessories', 'Extended Warranty (+3 Months)', 'Skip the Queue']
  },
  {
    id: 'diamond',
    name: 'Diamond',
    minPoints: 500000,
    color: 'from-purple-900 to-black', // Diamond/Dark
    textColor: 'text-purple-300',
    borderColor: 'border-purple-500/50',
    benefits: ['Dedicated Account Manager', 'Same-day Delivery', 'Exclusive Event Invites', 'Wholesale Pricing']
  }
];

export const MemberStatusPage: React.FC = () => {
  // Mock User Data
  const userPoints = 35000;
  
  // Determine current tier
  const currentTierIndex = TIERS.reduce((acc, tier, index) => {
    return userPoints >= tier.minPoints ? index : acc;
  }, 0);
  
  const currentTier = TIERS[currentTierIndex];
  const nextTier = TIERS[currentTierIndex + 1];
  
  // Calculate Progress
  let progress = 100;
  let pointsToNext = 0;
  
  if (nextTier) {
    const range = nextTier.minPoints - currentTier.minPoints;
    const gained = userPoints - currentTier.minPoints;
    progress = Math.min(100, Math.max(0, (gained / range) * 100));
    pointsToNext = nextTier.minPoints - userPoints;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Crown className="text-red-600 fill-red-600" />
          Member Status
        </h1>

        {/* Current Tier Card */}
        <div className={`bg-gradient-to-r ${currentTier.color} rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden mb-8 transition-all duration-500`}>
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <Crown size={120} />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <span className={`bg-black/20 backdrop-blur-md ${currentTier.textColor} ${currentTier.borderColor} border px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider`}>
                        {currentTier.name} Member
                    </span>
                </div>
                <h2 className="text-3xl font-bold mb-1">Alex Doe</h2>
                <p className="text-white/70 text-sm mb-6 font-medium">
                   {userPoints.toLocaleString()} Points Collected
                </p>

                {/* Progress Bar */}
                {nextTier ? (
                    <div>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                            <span>Current: {currentTier.name}</span>
                            <span>Next: {nextTier.name}</span>
                        </div>
                        <div className="h-3 bg-black/20 rounded-full overflow-hidden mb-2 backdrop-blur-sm border border-white/10">
                            <div 
                                className="h-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.5)] rounded-full transition-all duration-1000 ease-out" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="text-right text-xs text-white/80 font-medium">
                            {pointsToNext.toLocaleString()} points to level up
                        </p>
                    </div>
                ) : (
                    <div className="mt-4 p-3 bg-white/10 rounded-lg border border-white/20">
                        <p className="text-sm font-bold flex items-center gap-2">
                            <Star className="fill-current text-yellow-400" /> 
                            You've reached the top!
                        </p>
                    </div>
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left: How to Move Up */}
            <div className="lg:col-span-7 space-y-6">
                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <TrendingUp className="text-red-600" /> How to Level Up
                </h3>
                
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                                <Gift size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">Shop & Earn</h4>
                                <p className="text-xs text-gray-500 mb-2">Earn 1 point for every ₦1,000 spent on any product.</p>
                                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 inline-block">
                                    <span className="text-xs font-bold text-gray-700">Next Target: Spend ₦{(pointsToNext * 1000).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center shrink-0">
                                <UserCheck size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">Refer a Friend</h4>
                                <p className="text-xs text-gray-500 mb-2">Earn 5,000 points when a friend makes their first purchase over ₦100k.</p>
                                <button className="text-xs font-bold text-green-600 hover:text-green-700 hover:underline">
                                    Copy Referral Link
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center shrink-0">
                                <Star size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">Write Reviews</h4>
                                <p className="text-xs text-gray-500 mb-2">Earn 500 points for every verified purchase review with photos.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Current Benefits */}
                <h3 className="font-bold text-lg text-gray-900 mt-8 mb-4">Your Silver Benefits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentTier.benefits.map((benefit, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-3 shadow-sm">
                            <Check size={16} className="text-green-600" strokeWidth={3} />
                            <span className="text-sm font-medium text-gray-700">{benefit}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Tier Roadmap */}
            <div className="lg:col-span-5">
                <h3 className="font-bold text-lg text-gray-900 mb-4">Membership Tiers</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {TIERS.map((tier, index) => {
                        const isUnlocked = index <= currentTierIndex;
                        const isNext = index === currentTierIndex + 1;

                        return (
                            <div 
                                key={tier.id} 
                                className={`p-5 border-b border-gray-50 last:border-0 relative ${isUnlocked ? 'bg-white' : 'bg-gray-50/50'}`}
                            >
                                {isUnlocked && (
                                    <div className="absolute right-5 top-5 text-green-600">
                                        <Check size={20} strokeWidth={3} />
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${tier.color}`}></div>
                                    <h4 className={`font-bold ${isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>{tier.name}</h4>
                                    {isNext && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">Next Goal</span>}
                                </div>
                                
                                <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
                                    {tier.minPoints.toLocaleString()} Points
                                </p>

                                <ul className="space-y-2">
                                    {tier.benefits.map((benefit, i) => (
                                        <li key={i} className={`text-xs flex items-start gap-2 ${isUnlocked ? 'text-gray-600' : 'text-gray-400'}`}>
                                            <span className="mt-0.5 w-1 h-1 rounded-full bg-gray-300 shrink-0"></span>
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};