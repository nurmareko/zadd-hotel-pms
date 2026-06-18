const monospaceStack = [
  "ui-monospace",
  '"JetBrains Mono"',
  '"SF Mono"',
  "Menlo",
  "Consolas",
  "monospace",
];

const config = {
  theme: {
    extend: {
      colors: {
        console: {
          bg: "var(--console-bg)",
          surface: "var(--console-surface)",
          ink: "var(--console-ink)",
          accent: "var(--console-accent)",
          border: "var(--console-border)",
          "border-soft": "var(--console-border-soft)",
        },
        status: {
          "vc-bg": "var(--emerald-50)",
          "vc-fg": "var(--emerald-700)",
          "vc-pip": "var(--emerald-500)",
          "oc-bg": "var(--blue-50)",
          "oc-fg": "var(--blue-700)",
          "oc-pip": "var(--blue-500)",
          "vd-bg": "var(--amber-50)",
          "vd-fg": "var(--amber-600)",
          "vd-pip": "var(--amber-500)",
          "od-bg": "var(--red-50)",
          "od-fg": "var(--red-600)",
          "od-pip": "var(--red-500)",
          "ooo-bg": "var(--slate-100)",
          "ooo-fg": "var(--slate-600)",
          "ooo-pip": "var(--slate-500)",
        },
      },
      fontFamily: {
        sans: monospaceStack,
        mono: monospaceStack,
        inter: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
};

module.exports = config;
