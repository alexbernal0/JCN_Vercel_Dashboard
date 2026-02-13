import { BarChart3, Globe, Home, Info, LineChart, type LucideIcon, Shield, Sprout, Zap } from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Main",
    items: [
      {
        title: "Home",
        url: "/dashboard/home",
        icon: Home,
      },
    ],
  },
  {
    id: 2,
    label: "Portfolios",
    items: [
      {
        title: "Persistent Value",
        url: "/dashboard/persistent-value",
        icon: BarChart3,
      },
      {
        title: "Olivia Growth",
        url: "/dashboard/olivia-growth",
        icon: Sprout,
      },
      {
        title: "Pure Alpha",
        url: "/dashboard/pure-alpha",
        icon: Zap,
      },
    ],
  },
  {
    id: 3,
    label: "Analysis Tools",
    items: [
      {
        title: "Stock Analysis",
        url: "/dashboard/stock-analysis",
        icon: LineChart,
      },
      {
        title: "Market Analysis",
        url: "/dashboard/market-analysis",
        icon: Globe,
      },
      {
        title: "Risk Management",
        url: "/dashboard/risk-management",
        icon: Shield,
      },
    ],
  },
  {
    id: 4,
    label: "Information",
    items: [
      {
        title: "About",
        url: "/dashboard/about",
        icon: Info,
      },
    ],
  },
];
