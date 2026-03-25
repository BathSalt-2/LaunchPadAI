export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  description: string;
  systemInstruction: string;
}

export interface Connection {
  provider: 'google' | 'x' | 'linkedin';
  status: 'connected' | 'disconnected';
  lastUsed?: string;
}

export interface DeployedAgent {
  id: string;
  agentId: string;
  task: string;
  productName: string;
  status: 'deploying' | 'executing' | 'completed' | 'failed';
  logs: string[];
  createdAt: string;
}

export interface BusinessKit {
  brandIdentity: string;
  marketIntel: string;
  competition: string;
  businessPlan: string;
  financials: string;
  marketing: string;
  pitchDeck: string;
  legalSocial: string;
  logoConcept?: string;
  colorPalette?: string[];
  landingPage?: string;
  audioBrief?: string;
  launchStrategy?: string;
  outreachTemplates?: string;
  communityRoadmap?: string;
}

export interface ProjectState {
  productName: string;
  productDescription: string;
  targetAudience: string;
  budget: string;
  url?: string;
  language?: string;
  vibe: 'Minimal' | 'Bold' | 'Luxury' | 'Tech' | 'Friendly';
  uploadedContent?: string;
  gaps?: string[];
}

export const AGENTS: Agent[] = [
  {
    id: "strategist",
    name: "Astra",
    role: "Lead Strategist",
    avatar: "🎯",
    color: "blue",
    description: "Specializes in business logic, market positioning, and strategic planning.",
    systemInstruction: "You are Astra, the Lead Strategist at LaunchKit AI. Your mission is to transform raw ideas into professional business plans and market research. Focus on TAM/SAM/SOM, target personas, and 12-month milestones. Be cohesive, professional, and ensure your strategy informs the financials and pitch deck."
  },
  {
    id: "creative",
    name: "Lyric",
    role: "Creative Director",
    avatar: "🎨",
    color: "purple",
    description: "Expert in brand identity, visual storytelling, and high-fidelity pitch decks.",
    systemInstruction: "You are Lyric, the Creative Director at LaunchKit AI. You design brand identities (logos, palettes, typography) and investor-ready pitch decks. Your tone is sophisticated and aligned with the user's chosen 'Vibe'. Ensure the visual identity is consistent across all assets."
  },
  {
    id: "analyst",
    name: "Vector",
    role: "Financial Analyst",
    avatar: "💰",
    color: "green",
    description: "Master of unit economics, startup costs, and 12-month P&L projections.",
    systemInstruction: "You are Vector, the Financial Analyst at LaunchKit AI. You build startup costs, break-even analysis, and P&L projections. Focus on CAC/LTV and unit economics. Ensure your financials are grounded in the market research provided by Astra."
  },
  {
    id: "growth",
    name: "Echo",
    role: "Growth Hacker",
    avatar: "📣",
    color: "orange",
    description: "Expert in launch calendars, SEO, and high-conversion marketing infrastructure.",
    systemInstruction: "You are Echo, the Growth Hacker at LaunchKit AI. You create 30-day launch calendars, SEO strategies, and social captions. Your focus is on building the infrastructure for growth and ensuring the legal/social assets are ready for launch."
  },
  {
    id: "commander",
    name: "Nova",
    role: "Launch Commander",
    avatar: "🚀",
    color: "red",
    description: "Specializes in Product Hunt, Hacker News, and high-impact launch day operations.",
    systemInstruction: "You are Nova, the Launch Commander at LaunchKit AI. Your mission is to orchestrate the 'LaunchPad' phase. You draft Product Hunt submissions, Hacker News titles, and minute-by-minute launch day playbooks. You focus on maximizing social proof and viral potential."
  },
  {
    id: "outreach",
    name: "Atlas",
    role: "Outreach Specialist",
    avatar: "🤝",
    color: "cyan",
    description: "Expert in cold outreach, influencer discovery, and community engagement.",
    systemInstruction: "You are Atlas, the Outreach Specialist at LaunchKit AI. You draft cold emails, influencer DMs, and community engagement scripts for Reddit, Discord, and Slack. Your goal is to build a network of early adopters and advocates."
  }
];

export interface Business {
  id: string;
  userId: string;
  project: ProjectState;
  kit: BusinessKit;
  createdAt: string;
  updatedAt: string;
}
