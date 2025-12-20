import React, { useState } from 'react';
import { Shield, Lock, Smartphone, Globe, LogOut, ChevronRight, Key, AlertTriangle, CheckCircle2, X, Eye, EyeOff, Loader2 } from 'lucide-react';

export const SecurityPage: React.FC = () => {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState<{current: boolean, new: boolean, confirm: boolean}>({
      current: false, new: false, confirm: false
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const loginActivity = [
    { id: 1, device: 'iPhone 15 Pro Max', location: 'Lagos, Nigeria', time: 'Active now', status: 'current' },
    { id: 2, device: 'MacBook Pro M2', location: 'Lagos, Nigeria', time: 'Yesterday at 4:32 PM', status: 'logged_in' },
    { id: 3, device: 'Chrome on Windows', location: 'Abuja, Nigeria', time: 'Oct 24 at 10:00 AM', status: 'logged_in' },
  ];

  const handleUpdatePassword = (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError('');
      
      if (newPassword !== confirmPassword) {
          setPasswordError("New passwords don't match");
          return;
      }

      if (newPassword.length < 8) {
          setPasswordError("Password must be at least 8 characters");
          return;
      }

      setIsLoading(true);

      // Simulate API call
      setTimeout(() => {
          setIsLoading(false);
          setPasswordSuccess(true);
          // Reset form after delay
          setTimeout(() => {
              setIsPasswordModalOpen(false);
              setPasswordSuccess(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
          }, 2000);
      }, 1500);
  };

  const toggleShow = (field: 'current' | 'new' | 'confirm') => {
      setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Shield className="text-red-600 fill-red-600" />
          Security Settings
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Main Settings */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Password Section */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Key size={20} className="text-gray-400" />
                        Login & Password
                    </h2>
                    
                    <div className="space-y-6">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                            <div>
                                <p className="text-sm font-medium text-gray-900">Email Address</p>
                                <p className="text-sm text-gray-500">alex.doe@example.com</p>
                            </div>
                            <span className="bg-green-50 text-green-600 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-green-100">
                                <CheckCircle2 size={12} /> Verified
                            </span>
                        </div>

                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-gray-900">Password</p>
                                <p className="text-xs text-gray-500">Last changed 3 months ago</p>
                            </div>
                            <button 
                                onClick={() => setIsPasswordModalOpen(true)}
                                className="text-sm font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition-colors"
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2FA Section */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <Smartphone size={20} className="text-gray-400" />
                        Two-Factor Authentication
                    </h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Add an extra layer of security to your account by requiring more than just a password to log in.
                    </p>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${twoFactorEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                <Lock size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">Text Message (SMS)</p>
                                <p className="text-xs text-gray-500">{twoFactorEnabled ? 'Enabled' : 'Disabled'}</p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${twoFactorEnabled ? 'bg-green-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                {/* Login Activity */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Globe size={20} className="text-gray-400" />
                            Where You're Logged In
                        </h2>
                        <button className="text-xs font-bold text-red-600 hover:text-red-700">Sign out all devices</button>
                    </div>

                    <div className="space-y-4">
                        {loginActivity.map((session) => (
                            <div key={session.id} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500">
                                        {session.device.includes('iPhone') || session.device.includes('Android') ? <Smartphone size={20} /> : <Globe size={20} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                            {session.device}
                                            {session.status === 'current' && <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">This Device</span>}
                                        </p>
                                        <p className="text-xs text-gray-500">{session.location} • {session.time}</p>
                                    </div>
                                </div>
                                {session.status !== 'current' && (
                                    <button className="text-gray-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg">
                                        <LogOut size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Right Column: Tips & Danger Zone */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* Security Tips */}
                <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                    <h3 className="text-blue-900 font-bold mb-3 flex items-center gap-2">
                        <Shield size={18} /> Security Tips
                    </h3>
                    <ul className="space-y-3">
                        <li className="flex gap-2 text-sm text-blue-800">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></div>
                            Use a strong password with symbols and numbers.
                        </li>
                        <li className="flex gap-2 text-sm text-blue-800">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></div>
                            Enable 2FA for maximum protection.
                        </li>
                        <li className="flex gap-2 text-sm text-blue-800">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></div>
                            Log out from public devices immediately after use.
                        </li>
                    </ul>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                    <h3 className="text-red-900 font-bold mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} /> Danger Zone
                    </h3>
                    <p className="text-xs text-red-700 mb-4 leading-relaxed">
                        Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <button className="w-full border border-red-200 text-red-700 font-bold py-2.5 rounded-xl text-xs hover:bg-red-100 transition-colors">
                        Delete Account
                    </button>
                </div>

            </div>

        </div>
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPasswordModalOpen(false)}></div>
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 p-6 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-gray-900 text-lg">Change Password</h3>
                      <button onClick={() => setIsPasswordModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                          <X size={20} />
                      </button>
                  </div>

                  {passwordSuccess ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in">
                          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                              <CheckCircle2 size={32} />
                          </div>
                          <h4 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h4>
                          <p className="text-gray-500 text-sm">Your password has been changed successfully.</p>
                      </div>
                  ) : (
                      <form onSubmit={handleUpdatePassword} className="space-y-4">
                          {/* Current Password */}
                          <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Current Password</label>
                              <div className="relative">
                                  <input 
                                      type={showPassword.current ? "text" : "password"} 
                                      value={currentPassword}
                                      onChange={(e) => setCurrentPassword(e.target.value)}
                                      className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm font-medium"
                                      placeholder="Enter current password"
                                      required
                                  />
                                  <button type="button" onClick={() => toggleShow('current')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                      {showPassword.current ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </button>
                              </div>
                          </div>

                          {/* New Password */}
                          <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">New Password</label>
                              <div className="relative">
                                  <input 
                                      type={showPassword.new ? "text" : "password"} 
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm font-medium"
                                      placeholder="At least 8 characters"
                                      required
                                  />
                                  <button type="button" onClick={() => toggleShow('new')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                      {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </button>
                              </div>
                          </div>

                          {/* Confirm Password */}
                          <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Confirm Password</label>
                              <div className="relative">
                                  <input 
                                      type={showPassword.confirm ? "text" : "password"} 
                                      value={confirmPassword}
                                      onChange={(e) => setConfirmPassword(e.target.value)}
                                      className={`w-full pl-4 pr-10 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm font-medium ${passwordError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 focus:border-red-500 focus:ring-red-500/20'}`}
                                      placeholder="Re-enter new password"
                                      required
                                  />
                                  <button type="button" onClick={() => toggleShow('confirm')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                      {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </button>
                              </div>
                              {passwordError && (
                                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                                      <AlertTriangle size={12} /> {passwordError}
                                  </p>
                              )}
                          </div>

                          <div className="pt-2">
                              <button 
                                  type="submit" 
                                  disabled={isLoading}
                                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-red-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                              >
                                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Update Password'}
                              </button>
                          </div>
                      </form>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};