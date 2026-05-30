import { CreditCard } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PaymentMethod } from '../types';

const PAYMENT_OPTION_BASE_CLASS =
  'relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-store-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white';

function paymentOptionClassName(isSelected: boolean): string {
  return `${PAYMENT_OPTION_BASE_CLASS} ${
    isSelected
      ? 'border-store-primary bg-store-primary/5'
      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
  }`;
}

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
        checked ? 'border-store-primary' : 'border-gray-400'
      }`}
    >
      {checked && <div className="size-2.5 rounded-full bg-store-primary" />}
    </div>
  );
}

function Badge({ children, className }: { children: string; className: string }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function PaymentOptionCard({
  method,
  paymentMethod,
  setPaymentMethod,
  title,
  description,
  badge,
  icon,
}: {
  method: PaymentMethod;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  title: string;
  description: string;
  badge?: { label: string; className: string };
  icon: ReactNode;
}) {
  const checked = paymentMethod === method;

  return (
    <label className={paymentOptionClassName(checked)}>
      <input
        type="radio"
        name="payment"
        value={method}
        checked={checked}
        onChange={() => setPaymentMethod(method)}
        className="sr-only"
      />
      <RadioDot checked={checked} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-gray-900">{title}</span>
          {badge && <Badge className={badge.className}>{badge.label}</Badge>}
        </div>
        <span className="text-xs text-gray-500 block mt-0.5">
          {description}
        </span>
      </div>
      {icon}
    </label>
  );
}

export function InstallmentInfo({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'blue' | 'purple' | 'primary';
  items: string[];
}) {
  const styles = {
    blue: {
      box: 'bg-blue-50 border-blue-100',
      icon: 'bg-blue-100 text-blue-600',
    },
    purple: {
      box: 'bg-purple-50 border-purple-100',
      icon: 'bg-purple-100 text-purple-600',
    },
    primary: {
      box: 'bg-store-primary/5 border-store-primary/20',
      icon: 'bg-store-primary/10 text-store-primary',
    },
  }[tone];

  return (
    <div
      className={`p-4 rounded-xl border animate-in slide-in-from-top-2 ${styles.box}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${styles.icon}`}
        >
          <CreditCard size={16} />
        </div>
        <div>
          <h4 className="font-bold text-sm text-gray-900">{title}</h4>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {items.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
