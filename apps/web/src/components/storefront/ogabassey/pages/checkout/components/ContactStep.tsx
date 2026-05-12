'use client';

import { Check, Eye, EyeOff } from 'lucide-react';
import { isValidPhoneNumber } from 'react-phone-number-input';

import { PhoneInput } from '@/components/ui/phone-input';

type StepName = 'contact' | 'delivery' | 'payment';

interface CompletedSteps {
  contact: boolean;
  delivery: boolean;
}

interface ContactStepProps {
  currentStep: StepName;
  completedSteps: CompletedSteps;
  firstName: string;
  lastName: string;
  customerEmail: string;
  customerPhone: string;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setCustomerEmail: (value: string) => void;
  setCustomerPhone: (value: string) => void;
  contactValidationAttempted: boolean;
  isContactValid: boolean;
  user: { id: string } | null | undefined;
  createAccount: boolean;
  setCreateAccount: (value: boolean) => void;
  accountPassword: string;
  setAccountPassword: (value: string) => void;
  showPasswordInput: boolean;
  setShowPasswordInput: (value: boolean) => void;
  isPasswordVisible: boolean;
  setIsPasswordVisible: (value: boolean) => void;
  setCurrentStep: (step: StepName) => void;
  setCompletedSteps: (
    value:
      | CompletedSteps
      | ((prev: CompletedSteps) => CompletedSteps),
  ) => void;
}

export function ContactStep({
  currentStep,
  completedSteps,
  firstName,
  lastName,
  customerEmail,
  customerPhone,
  setFirstName,
  setLastName,
  setCustomerEmail,
  setCustomerPhone,
  contactValidationAttempted,
  isContactValid,
  user,
  createAccount,
  setCreateAccount,
  accountPassword,
  setAccountPassword,
  showPasswordInput,
  setShowPasswordInput,
  isPasswordVisible,
  setIsPasswordVisible,
  setCurrentStep,
  setCompletedSteps,
}: ContactStepProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border ${currentStep === 'contact' ? 'border-store-primary ring-1 ring-store-primary/20' : 'border-gray-100'} overflow-hidden transition-all duration-300`}
    >
      <button
        type="button"
        onClick={() => setCurrentStep('contact')}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${completedSteps.contact ? 'bg-green-100 text-green-600' : currentStep === 'contact' ? 'bg-store-primary/10 text-store-primary' : 'bg-gray-100 text-gray-500'}`}
          >
            {completedSteps.contact ? <Check size={14} /> : '1'}
          </div>
          Contact Information
        </h2>
        {completedSteps.contact && currentStep !== 'contact' && (
          <span className="text-sm font-medium text-store-primary hover:text-store-primary">
            Edit
          </span>
        )}
      </button>

      {/* Collapsible Content */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${currentStep === 'contact' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="p-6 pt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:outline-hidden text-sm text-gray-900 placeholder:text-gray-400 ${
                    contactValidationAttempted && !firstName.trim()
                      ? 'border-red-500 focus:border-red-500 bg-store-primary/5'
                      : 'border-gray-200 focus:border-red-500'
                  }`}
                  required
                />
                {contactValidationAttempted && !firstName.trim() && (
                  <p className="text-red-500 text-xs mt-1">
                    First name is required
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:outline-hidden text-sm text-gray-900 placeholder:text-gray-400 ${
                    contactValidationAttempted && !lastName.trim()
                      ? 'border-red-500 focus:border-red-500 bg-store-primary/5'
                      : 'border-gray-200 focus:border-red-500'
                  }`}
                  required
                />
                {contactValidationAttempted && !lastName.trim() && (
                  <p className="text-red-500 text-xs mt-1">
                    Last name is required
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="john@example.com"
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:outline-hidden text-sm text-gray-900 placeholder:text-gray-400 ${
                    contactValidationAttempted &&
                    (!customerEmail.trim() ||
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                        customerEmail.trim(),
                      ))
                      ? 'border-red-500 focus:border-red-500 bg-store-primary/5'
                      : 'border-gray-200 focus:border-red-500'
                  }`}
                  required
                />
                {contactValidationAttempted && !customerEmail.trim() && (
                  <p className="text-red-500 text-xs mt-1">
                    Email address is required
                  </p>
                )}
                {contactValidationAttempted &&
                  customerEmail.trim() &&
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    customerEmail.trim(),
                  ) && (
                    <p className="text-red-500 text-xs mt-1">
                      Please enter a valid email address
                    </p>
                  )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                Phone Number *
              </label>
              <div
                className={
                  contactValidationAttempted &&
                  (!customerPhone || !isValidPhoneNumber(customerPhone))
                    ? 'rounded-lg border border-red-500'
                    : ''
                }
              >
                <PhoneInput
                  value={customerPhone}
                  onChange={(value) => setCustomerPhone(value || '')}
                  placeholder="+234 800 000 0000"
                  defaultCountry="NG"
                  className="w-full text-sm"
                />
              </div>
              {contactValidationAttempted && !customerPhone && (
                <p className="text-red-500 text-xs mt-1">
                  Phone number is required
                </p>
              )}
              {contactValidationAttempted &&
                customerPhone &&
                !isValidPhoneNumber(customerPhone) && (
                  <p className="text-red-500 text-xs mt-1">
                    Please enter a valid phone number
                  </p>
                )}
            </div>

            {/* Guest Account Creation & Newsletter (2026 Conversion Pattern) */}
            {!user && (
              <div className="md:col-span-2 space-y-4 pt-4">
                {/* Account Creation Checkbox (Retention) */}
                <div
                  className={`bg-gray-50 rounded-xl p-4 border transition-all duration-300 ${createAccount ? 'border-store-primary/30 bg-store-primary/5' : 'border-gray-100 hover:border-store-primary/20'}`}
                >
                  <label className="flex items-start gap-3 cursor-pointer group mb-2">
                    <div className="relative flex items-center pt-0.5">
                      <input
                        type="checkbox"
                        checked={createAccount}
                        onChange={(e) => {
                          setCreateAccount(e.target.checked);
                          setShowPasswordInput(e.target.checked);
                        }}
                        className="peer h-5 w-5 rounded border-gray-300 text-store-primary focus:ring-store-primary"
                      />
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-gray-900 group-hover:text-store-primary transition-colors">
                        Save my information for a faster checkout next
                        time
                      </span>
                      <span className="text-xs text-gray-500 mt-0.5 block">
                        Securely save your address details for future
                        orders.
                      </span>
                    </div>
                  </label>

                  {/* Sliding Password Input */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${showPasswordInput ? 'max-h-24 opacity-100 mt-3 pl-8' : 'max-h-0 opacity-0'}`}
                  >
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                      Create a Password
                    </label>
                    <div className="relative">
                      <input
                        type={isPasswordVisible ? 'text' : 'password'}
                        value={accountPassword}
                        onChange={(e) =>
                          setAccountPassword(e.target.value)
                        }
                        placeholder="Min. 6 characters"
                        className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-hidden text-sm text-gray-900 placeholder:text-gray-400 pr-12 ${
                          contactValidationAttempted &&
                          createAccount &&
                          accountPassword.length < 6
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 focus:border-store-primary'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setIsPasswordVisible(!isPasswordVisible)
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {isPasswordVisible ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                    {contactValidationAttempted &&
                      createAccount &&
                      accountPassword.length < 6 && (
                        <p className="text-red-500 text-xs mt-1">
                          Password must be at least 6 characters
                        </p>
                      )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setCompletedSteps((prev) => ({
                    ...prev,
                    contact: true,
                  }));
                  setCurrentStep('delivery');
                }}
                disabled={
                  !isContactValid ||
                  (createAccount && accountPassword.length < 6)
                }
                className="px-6 py-3 bg-store-primary text-white font-bold rounded-xl hover:bg-store-primary/90 transition-colors w-full md:w-auto disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg disabled:shadow-none"
              >
                Continue to Delivery
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
