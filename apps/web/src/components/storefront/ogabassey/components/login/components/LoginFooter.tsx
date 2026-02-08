/**
 * LoginFooter Component
 *
 * 2026 Best Practices:
 * - Semantic HTML with footer element
 * - Clean, minimal design
 */

/**
 * Login page footer with branding
 */
export function LoginFooter() {
  return (
    <footer className="relative z-10 border-t border-gray-100 py-4 bg-white">
      <div className="container mx-auto px-4 text-center text-sm text-gray-400">
        Secure passwordless login powered by Baci
      </div>
    </footer>
  );
}
