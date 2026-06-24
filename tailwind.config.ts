const sansStack = ["var(--font-plus-jakarta-sans)", "ui-sans-serif", "system-ui", "sans-serif"];
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
          "vc-bg": "var(--status-vc-bg)",
          "vc-fg": "var(--status-vc-fg)",
          "vc-pip": "var(--status-vc)",
          "oc-bg": "var(--status-oc-bg)",
          "oc-fg": "var(--status-oc-fg)",
          "oc-pip": "var(--status-oc)",
          "vd-bg": "var(--status-vd-bg)",
          "vd-fg": "var(--status-vd-fg)",
          "vd-pip": "var(--status-vd)",
          "od-bg": "var(--status-od-bg)",
          "od-fg": "var(--status-od-fg)",
          "od-pip": "var(--status-od)",
          "vcu-bg": "var(--status-vcu-bg)",
          "vcu-fg": "var(--status-vcu-fg)",
          "vcu-pip": "var(--status-vcu)",
          "ooo-bg": "var(--status-ooo-bg)",
          "ooo-fg": "var(--status-ooo-fg)",
          "ooo-pip": "var(--status-ooo)",
          "oos-bg": "var(--status-oos-bg)",
          "oos-fg": "var(--status-oos-fg)",
          "oos-pip": "var(--status-oos)",
        },
      },
      fontFamily: {
        sans: sansStack,
        mono: monospaceStack,
        inter: sansStack,
        jakarta: sansStack,
      },
    },
  },
};

module.exports = config;
