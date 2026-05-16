'use client';

import { Globe, Lock, ScanBarcode, ShieldCheck, Smartphone } from 'lucide-react';
import Image from 'next/image';
import type { ImeiResult } from './imei-checker-types';

interface OgabasseyImeiResultsProps {
  currentTierName: string;
  result: ImeiResult | null;
  onReset: () => void;
}

function isBlacklistClean(status: string) {
  const s = status.toLowerCase();
  return s === 'clean' || s === 'not found' || s.includes('clean');
}

const resultTones = {
  danger: {
    border: 'border-[var(--store-danger-border,#fecaca)]',
    icon: 'bg-[var(--store-danger-bg,#fee2e2)] text-[var(--store-danger-text,#dc2626)]',
    surface: 'bg-[var(--store-danger-bg,#fef2f2)]',
    text: 'text-[var(--store-danger-text,#dc2626)]',
  },
  info: {
    icon: 'bg-[var(--store-accent-bg,#eff6ff)] text-[var(--store-accent,#2563eb)]',
  },
  safe: {
    border: 'border-[var(--store-success-border,#bbf7d0)]',
    icon: 'bg-[var(--store-success-bg,#dcfce7)] text-[var(--store-success-text,#16a34a)]',
    surface: 'bg-[var(--store-success-bg,#f0fdf4)]',
    text: 'text-[var(--store-success-text,#166534)]',
  },
  warning: {
    border: 'border-[var(--store-warning-border,#fde68a)]',
    surface: 'bg-[var(--store-warning-bg,#fefce8)]',
    text: 'text-[var(--store-warning-text,#854d0e)]',
  },
};

function verdictTone(verdictType: ImeiResult['verdictType']) {
  if (verdictType === 'safe') {
    return resultTones.safe;
  }

  if (verdictType === 'danger') {
    return resultTones.danger;
  }

  return resultTones.warning;
}

export function OgabasseyImeiResults({
  currentTierName,
  result,
  onReset,
}: OgabasseyImeiResultsProps) {
  if (!result) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto mb-16 animate-in slide-in-from-bottom-8 duration-700">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div
          className={`p-6 md:p-8 ${
            result.status === 'Clean'
              ? resultTones.safe.surface
              : resultTones.danger.surface
          }`}
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-28 h-28 shrink-0 bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
              {result.deviceImage ? (
                <Image
                  src={result.deviceImage}
                  alt={result.device}
                  fill
                  sizes="112px"
                  className="object-contain p-2"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Smartphone size={48} />
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {currentTierName} Report
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-xs font-mono text-gray-500">
                  {new Date().toLocaleString()}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                {result.device}
              </h2>
              <p className="text-sm text-gray-500 font-mono mt-1">
                IMEI: {result.imei}
              </p>
              {result.modelNumber ? (
                <p className="text-xs text-gray-400 mt-0.5">
                  Model: {result.modelNumber}
                </p>
              ) : null}
            </div>

            <div
              className={`px-4 py-2 rounded-xl border flex flex-col items-center justify-center min-w-[100px] ${
                result.status === 'Clean'
                  ? `bg-white ${resultTones.safe.border}`
                  : `bg-white ${resultTones.danger.border}`
              }`}
            >
              <span
                className={`text-2xl font-black ${
                  result.status === 'Clean'
                    ? resultTones.safe.text
                    : resultTones.danger.text
                }`}
              >
                {result.score}%
              </span>
              <span className="text-[10px] font-bold uppercase text-gray-400">
                Trust Score
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isBlacklistClean(result.blacklistStatus)
                  ? resultTones.safe.icon
                  : resultTones.danger.icon
              }`}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                Blacklist Status
              </p>
              <p
                className={`font-bold text-base ${
                  isBlacklistClean(result.blacklistStatus)
                    ? resultTones.safe.text
                    : resultTones.danger.text
                }`}
              >
                {result.blacklistStatus}
              </p>
              <p className="text-xs text-gray-500 mt-1">GSMA Database Check</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                result.icloudLock.toLowerCase() === 'off' ||
                result.icloudLock.toLowerCase() === 'unknown'
                  ? resultTones.safe.icon
                  : resultTones.danger.icon
              }`}
            >
              <Lock size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                Find My iPhone
              </p>
              <p
                className={`font-bold text-base ${
                  result.icloudLock.toLowerCase() === 'off' ||
                  result.icloudLock.toLowerCase() === 'unknown'
                    ? resultTones.safe.text
                    : resultTones.danger.text
                }`}
              >
                {result.icloudLock}
              </p>
              <p className="text-xs text-gray-500 mt-1">iCloud Lock Status</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${resultTones.info.icon}`}
            >
              <Globe size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                SIM Lock
              </p>
              <p className="font-bold text-base text-gray-900">
                {result.simLock}
              </p>
              <p className="text-xs text-gray-500 mt-1">Network Restriction</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${resultTones.info.icon}`}
            >
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                Carrier
              </p>
              <p className="font-bold text-base text-gray-900">
                {result.carrier}
              </p>
              <p className="text-xs text-gray-500 mt-1">Original Network</p>
            </div>
          </div>
        </div>

        <div
          className={`p-6 border-t text-center ${verdictTone(result.verdictType).surface} ${verdictTone(result.verdictType).border}`}
        >
          <p
            className={`font-bold text-base leading-relaxed ${verdictTone(result.verdictType).text}`}
          >
            {result.verdict}
          </p>
        </div>
      </div>

      <div className="text-center mt-8">
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-bold text-gray-500 hover:text-gray-900 inline-flex items-center gap-2"
        >
          <ScanBarcode size={16} />
          Check Another Device
        </button>
      </div>
    </div>
  );
}
