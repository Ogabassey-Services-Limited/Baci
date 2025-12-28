/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 content paths
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Synced from web tailwind.config.ts
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F3F4F6",
          foreground: "#6B7280",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#111827",
        },
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
      },
      fontFamily: {
        // Use system serif font (matches web font-serif class)
        serif: ["Georgia", "Times New Roman", "serif"],
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
