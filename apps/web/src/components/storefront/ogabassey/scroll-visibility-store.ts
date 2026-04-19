'use client';

import { useSyncExternalStore } from 'react';

const HIDE_SCROLL_THRESHOLD = 5;
const SHOW_SCROLL_THRESHOLD = -5;
const HIDE_AFTER_SCROLL_Y = 100;
const SHOW_AT_SCROLL_Y = 50;

let isVisible = true;
let lastScrollY = 0;
let isListening = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function updateVisibility(currentScrollY: number) {
  const scrollDelta = currentScrollY - lastScrollY;
  let nextIsVisible = isVisible;

  if (scrollDelta > HIDE_SCROLL_THRESHOLD && currentScrollY > HIDE_AFTER_SCROLL_Y) {
    nextIsVisible = false;
  } else if (
    scrollDelta < SHOW_SCROLL_THRESHOLD ||
    currentScrollY < SHOW_AT_SCROLL_Y
  ) {
    nextIsVisible = true;
  }

  lastScrollY = currentScrollY;

  if (nextIsVisible !== isVisible) {
    isVisible = nextIsVisible;
    notifyListeners();
  }
}

function handleScroll() {
  updateVisibility(window.scrollY);
}

function startListening() {
  if (isListening || typeof window === 'undefined') {
    return;
  }

  isListening = true;
  lastScrollY = window.scrollY;
  isVisible = true;
  window.addEventListener('scroll', handleScroll, { passive: true });
}

function stopListening() {
  if (!isListening || typeof window === 'undefined') {
    return;
  }

  isListening = false;
  window.removeEventListener('scroll', handleScroll);
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (listeners.size === 1) {
    startListening();
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      stopListening();
    }
  };
}

function getSnapshot() {
  return isVisible;
}

function getServerSnapshot() {
  return true;
}

export function useOgabasseyScrollVisibility() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function resetOgabasseyScrollVisibilityStoreForTests() {
  listeners.clear();
  stopListening();
  isVisible = true;
  lastScrollY = 0;
}
