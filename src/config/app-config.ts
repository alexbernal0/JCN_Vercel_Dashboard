import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "JCN Financial Dashboard",
  version: packageJson.version,
  copyright: `© ${currentYear}, JCN Financial & Tax Advisory Group, LLC.`,
  meta: {
    title: "JCN Financial Dashboard - Investment Portfolio Tracking & Analysis",
    description:
      "JCN Financial Dashboard provides comprehensive portfolio tracking, market analysis, and risk management tools for investment professionals. Built with Next.js, TypeScript, and modern web technologies.",
  },
};
