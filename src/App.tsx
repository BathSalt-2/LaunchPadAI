/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import { 
  Rocket, 
  Target, 
  PenTool, 
  BarChart3, 
  Zap, 
  MessageSquare, 
  Send, 
  Loader2, 
  ChevronRight, 
  RefreshCcw,
  CheckCircle2,
  Terminal as TerminalIcon,
  Cpu,
  Globe,
  Users,
  Image as ImageIcon,
  Volume2,
  Code,
  Video,
  Mail,
  ListChecks,
  Palette,
  LayoutDashboard,
  Search,
  Languages,
  Menu,
  X,
  Play,
  Pause,
  Copy,
  Download,
  Layout,
  CheckCircle,
  Share2,
  Settings,
  Activity,
  Link as LinkIcon,
  Bot,
  ShieldCheck,
  ExternalLink,
  Plus,
  Upload,
  FileText,
  AlertCircle,
  Sparkles,
  DollarSign,
  FileCode,
  Presentation,
  Folder,
  Trash2,
  LogIn,
  LogOut,
  Trash
} from 'lucide-react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { AGENTS, Agent, ProjectState, BusinessKit, Connection, DeployedAgent, Business } from './types';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc,
  User
} from './firebase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type TabType = 'brand' | 'market' | 'competition' | 'plan' | 'financials' | 'marketing' | 'pitch' | 'legal' | 'landing' | 'launchpad' | 'outreach' | 'connections' | 'live-agents';

export default function App() {
  const [step, setStep] = useState<'landing' | 'loading' | 'input' | 'processing' | 'results'>('landing');
  const [activeTab, setActiveTab] = useState<TabType>('brand');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [connections, setConnections] = useState<Connection[]>([
    { provider: 'google', status: 'disconnected' },
    { provider: 'x', status: 'disconnected' },
    { provider: 'linkedin', status: 'disconnected' }
  ]);
  const [deployedAgents, setDeployedAgents] = useState<DeployedAgent[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [savedBusinesses, setSavedBusinesses] = useState<Business[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);

  const pcmToWav = (base64Pcm: string, sampleRate: number = 24000) => {
    try {
      const binaryString = window.atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const buffer = new ArrayBuffer(44 + len);
      const view = new DataView(buffer);
      
      // RIFF chunk descriptor
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + len, true);    // file length
      view.setUint32(8, 0x57415645, false); // "WAVE"
      
      // FMT sub-chunk
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true);          // sub-chunk size
      view.setUint16(20, 1, true);           // PCM format
      view.setUint16(22, 1, true);           // mono
      view.setUint32(24, sampleRate, true);  // sample rate
      view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * numChannels * bitsPerSample/8)
      view.setUint16(32, 2, true);           // block align (numChannels * bitsPerSample/8)
      view.setUint16(34, 16, true);          // bits per sample
      
      // Data sub-chunk
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, len, true);         // data size
      
      // Write PCM data
      const pcmData = new Uint8Array(buffer, 44);
      pcmData.set(bytes);
      
      const blob = new Blob([buffer], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("PCM to WAV conversion failed:", err);
      return "";
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedBusinesses([]);
      return;
    }

    const path = 'businesses';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const businesses = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Business[];
      setSavedBusinesses(businesses);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setStep('landing');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const saveBusiness = async () => {
    if (!user) {
      handleLogin();
      return;
    }

    setIsSaving(true);
    const path = 'businesses';
    try {
      const businessId = kit.brandIdentity ? `${project.productName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}` : `draft-${Date.now()}`;
      const now = new Date().toISOString();
      
      const businessData: Business = {
        id: businessId,
        userId: user.uid,
        project,
        kit,
        createdAt: now,
        updatedAt: now
      };

      await setDoc(doc(db, path, businessId), businessData);
      addLog('system', "Business saved successfully to your profile.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const loadBusiness = (business: Business) => {
    setProject(business.project);
    setKit(business.kit);
    setStep('results');
    setShowSavedModal(false);
    addLog('system', `Loaded business: ${business.project.productName}`);
  };

  const deleteBusiness = async (id: string) => {
    const path = 'businesses';
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const [project, setProject] = useState<ProjectState>({
    productName: '',
    productDescription: '',
    targetAudience: '',
    budget: '0',
    url: '',
    language: 'English',
    vibe: 'Tech',
    gaps: []
  });
  
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [logs, setLogs] = useState<{ agentId: string; message: string; timestamp: Date }[]>([]);
  const [kit, setKit] = useState<BusinessKit>({
    brandIdentity: '',
    marketIntel: '',
    competition: '',
    businessPlan: '',
    financials: '',
    marketing: '',
    pitchDeck: '',
    legalSocial: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsParsing(true);
    addLog('system', `Parsing document: ${file.name}...`);

    try {
      const text = await file.text();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this document and extract core business logic. Be extremely critical and identify missing critical info.
        Document Content: ${text.substring(0, 10000)}
        
        Return JSON with: 
        - productName: string
        - productDescription: string
        - targetAudience: string
        - budget: string (if mentioned, otherwise "0")
        - language: string (if mentioned, otherwise "English")
        - gaps: string[] (Identify missing critical info like pricing, acquisition, unit economics, competition, or legal risks).`,
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING },
              productDescription: { type: Type.STRING },
              targetAudience: { type: Type.STRING },
              budget: { type: Type.STRING },
              language: { type: Type.STRING },
              gaps: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setProject(prev => ({
        ...prev,
        productName: data.productName || prev.productName,
        productDescription: data.productDescription || prev.productDescription,
        targetAudience: data.targetAudience || prev.targetAudience,
        budget: data.budget || prev.budget,
        language: data.language || prev.language,
        uploadedContent: text,
        gaps: data.gaps || []
      }));
      addLog('system', "Magic Import complete. Smart form autofilled with gap analysis.");
    } catch (error) {
      console.error("Parsing error:", error);
      addLog('system', "Failed to parse document.");
    } finally {
      setIsParsing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'text/*': ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.css', '.html'] },
    multiple: false
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { provider } = event.data;
        setConnections(prev => prev.map(c => 
          c.provider === provider ? { ...c, status: 'connected', lastUsed: new Date().toISOString() } : c
        ));
        addLog('system', `Successfully connected to ${provider.toUpperCase()}.`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    let interval: any;
    if (deployedAgents.length > 0) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/agents');
          if (res.ok) {
            const data = await res.json();
            setDeployedAgents(data);
          }
        } catch (e) {
          console.error("Failed to fetch agents", e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [deployedAgents.length]);

  const handleConnect = async (provider: string) => {
    try {
      const res = await fetch(`/api/auth/url?provider=${provider}`);
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, 'oauth_popup', 'width=600,height=700');
      }
    } catch (e) {
      console.error("OAuth error", e);
    }
  };

  const handleDeploy = async (agentId: string, task: string) => {
    setIsDeploying(true);
    try {
      const res = await fetch('/api/agents/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, task, productName: project.productName })
      });
      if (res.ok) {
        const newAgent = await res.json();
        setDeployedAgents(prev => [...prev, newAgent]);
        setActiveTab('live-agents');
        addLog('system', `Autonomous agent ${agentId} deployed for task: ${task.substring(0, 30)}...`);
      }
    } catch (e) {
      console.error("Deployment error", e);
    } finally {
      setIsDeploying(false);
    }
  };

  const addLog = (agentId: string, message: string) => {
    setLogs(prev => [...prev, { agentId, message, timestamp: new Date() }]);
  };

  const analyzeUrl = async () => {
    if (!project.url) return;
    setIsAnalyzing(true);
    addLog('system', `Analyzing URL: ${project.url}...`);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this URL: ${project.url}. Extract product name, description, target audience, and identify any gaps in the business logic. Return JSON.`,
        config: { 
          tools: [{ urlContext: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING },
              productDescription: { type: Type.STRING },
              targetAudience: { type: Type.STRING },
              gaps: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });
      const data = JSON.parse(response.text || '{}');
      setProject(prev => ({
        ...prev,
        productName: data.productName || prev.productName,
        productDescription: data.productDescription || prev.productDescription,
        targetAudience: data.targetAudience || prev.targetAudience,
        gaps: data.gaps || []
      }));
      addLog('system', "URL analysis complete. Form updated.");
    } catch (error) {
      console.error(error);
      addLog('system', "Failed to analyze URL.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runAgency = async () => {
    setIsGenerating(true);
    setStep('processing');
    setLogs([]);
    
    try {
      let currentProject = { ...project };

      // 1. Astra: Business Plan
      setActiveAgentIndex(0);
      addLog('strategist', `Synthesizing executive business plan for ${currentProject.productName}...`);
      const planResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Product: ${currentProject.productName}\nDescription: ${currentProject.productDescription}\nAudience: ${currentProject.targetAudience}\nUploaded Context: ${currentProject.uploadedContent || 'None'}\n\nGenerate a detailed Executive Business Plan (15-page structure). Include mission, vision, core problem, unique value proposition, and 12-month milestones.`,
        config: { systemInstruction: AGENTS[0].systemInstruction }
      });
      const businessPlan = planResponse.text || '';
      setKit(prev => ({ ...prev, businessPlan }));
      addLog('strategist', "Business plan finalized.");

      // 1.1 Astra: Market Intel
      addLog('strategist', "Analyzing market intelligence (TAM/SAM/SOM)...");
      const marketResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Business Plan Summary: ${businessPlan.substring(0, 4000)}\n\nGenerate Market Intel: TAM/SAM/SOM analysis, detailed target personas, and market trends.`,
        config: { 
          systemInstruction: AGENTS[0].systemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });
      const marketIntel = marketResponse.text || '';
      setKit(prev => ({ ...prev, marketIntel }));
      addLog('strategist', "Market intelligence synthesized.");

      // 1.2 Astra: Competition Analysis
      addLog('strategist', "Mapping competitive landscape and SWOT analysis...");
      const competitionResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Business Plan Summary: ${businessPlan.substring(0, 2000)}\nMarket Intel: ${marketIntel.substring(0, 2000)}\n\nGenerate Competition Analysis: SWOT map of top 3-5 competitors, your competitive advantage, and a 'Competitive Edge' summary.`,
        config: { 
          systemInstruction: AGENTS[0].systemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });
      const competition = competitionResponse.text || '';
      setKit(prev => ({ ...prev, competition }));
      addLog('strategist', "Competition analysis complete.");

      // 2. Lyric: Brand Identity
      setActiveAgentIndex(1);
      addLog('creative', `Designing brand identity with '${currentProject.vibe}' vibe...`);
      const brandResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Business Plan Summary: ${businessPlan.substring(0, 2000)}\nVibe: ${currentProject.vibe}\n\nGenerate Brand Identity: Logo concept, color palette (hex codes), and typography choices.`,
        config: { systemInstruction: AGENTS[1].systemInstruction }
      });
      const brandIdentity = brandResponse.text || '';
      setKit(prev => ({ ...prev, brandIdentity }));
      addLog('creative', "Brand identity finalized.");

      // 2.1 AI Image Generation (Logo Concept)
      try {
        addLog('creative', "Generating visual logo concept...");
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `A professional, high-fidelity logo concept for ${currentProject.productName}. Vibe: ${currentProject.vibe}. Minimalist, modern, vector style, white background.` }] },
          config: { imageConfig: { aspectRatio: "1:1" } }
        });
        const imagePart = imageResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart) {
          setKit(prev => ({ ...prev, logoConcept: `data:image/png;base64,${imagePart.inlineData?.data}` }));
        }
      } catch (e) { console.error("Logo gen failed", e); }

      // 2.2 Lyric: Pitch Deck
      addLog('creative', "Crafting investor pitch deck structure...");
      const pitchResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Brand Identity: ${brandIdentity.substring(0, 2000)}\nBusiness Plan Summary: ${businessPlan.substring(0, 2000)}\n\nGenerate Pitch Deck: 10-12 slide structure with content for each slide.`,
        config: { systemInstruction: AGENTS[1].systemInstruction }
      });
      const pitchDeck = pitchResponse.text || '';
      setKit(prev => ({ ...prev, pitchDeck }));
      addLog('creative', "Pitch deck finalized.");

      // 2.3 Lyric: Landing Page
      addLog('creative', "Generating high-conversion landing page mockup...");
      const landingResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Brand Identity: ${brandIdentity.substring(0, 2000)}\nBusiness Plan Summary: ${businessPlan.substring(0, 1000)}\n\nGenerate Landing Page: HTML/Tailwind mockup code for a high-conversion landing page. Use modern, clean components and ensure it matches the '${currentProject.vibe}' vibe. Keep the code concise.`,
        config: { systemInstruction: AGENTS[1].systemInstruction }
      });
      const landingPage = landingResponse.text || '';
      setKit(prev => ({ ...prev, landingPage }));
      addLog('creative', "Landing page mockup ready.");

      // 3. Vector: Financials
      setActiveAgentIndex(2);
      addLog('analyst', "Calculating unit economics and 12-month projections...");
      const financialResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Business Plan Summary: ${businessPlan.substring(0, 2000)}\nMarket Intel: ${marketIntel.substring(0, 2000)}\n\nGenerate Financial Projections: Startup costs, break-even analysis, 12-month P&L, and detailed CAC/LTV estimates based on unit economics.`,
        config: { systemInstruction: AGENTS[2].systemInstruction }
      });
      setKit(prev => ({ ...prev, financials: financialResponse.text || '' }));
      addLog('analyst', "Financial model validated.");

      // 4. Echo: Marketing Strategy
      setActiveAgentIndex(3);
      addLog('growth', "Building 30-day launch calendar and SEO strategy...");
      const marketingResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Business Plan Summary: ${businessPlan.substring(0, 2000)}\nBrand Identity: ${brandIdentity.substring(0, 1000)}\n\nGenerate Marketing Strategy: 30-day launch calendar, SEO keywords, and organic acquisition channels. Focus on $0 budget growth hacks.`,
        config: { systemInstruction: AGENTS[3].systemInstruction }
      });
      const marketing = marketingResponse.text || '';
      setKit(prev => ({ ...prev, marketing }));
      addLog('growth', "Marketing strategy finalized.");

      // 4.1 Echo: Legal & Social
      addLog('growth', "Generating legal framework and social media assets...");
      const legalResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Marketing Strategy Summary: ${marketing.substring(0, 2000)}\n\nGenerate Legal & Social: Privacy Policy summary, Terms of Service summary, and 14 days of social media captions (concise).`,
        config: { systemInstruction: AGENTS[3].systemInstruction }
      });
      setKit(prev => ({ ...prev, legalSocial: legalResponse.text || '' }));
      addLog('growth', "Legal and social assets finalized.");

      // 5. Nova: LaunchPad Strategy
      setActiveAgentIndex(4);
      addLog('commander', "Orchestrating LaunchPad operations (Product Hunt, HN)...");
      const launchResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Business Plan Summary: ${businessPlan.substring(0, 2000)}\nBrand Identity: ${brandIdentity.substring(0, 1000)}\n\nGenerate LaunchPad Strategy: Product Hunt tagline, description, first comment, Hacker News titles, and a minute-by-minute Launch Day Playbook.`,
        config: { systemInstruction: AGENTS[4].systemInstruction }
      });
      setKit(prev => ({ ...prev, launchStrategy: launchResponse.text || '' }));
      addLog('commander', "LaunchPad playbook ready for execution.");

      // 6. Atlas: Outreach & Community
      setActiveAgentIndex(5);
      addLog('outreach', "Drafting outreach templates and community roadmap...");
      const outreachResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Target Audience: ${currentProject.targetAudience}\nBusiness Plan Summary: ${businessPlan.substring(0, 2000)}\n\nGenerate Outreach & Community: Cold email templates, influencer DM scripts, and a community roadmap for Reddit/Discord/Slack.`,
        config: { systemInstruction: AGENTS[5].systemInstruction }
      });
      setKit(prev => ({ ...prev, outreachTemplates: outreachResponse.text || '' }));
      addLog('outreach', "Outreach infrastructure complete.");

      // 7. Audio Brief Generation
      addLog('system', "Generating audio brief for the executive team...");
      try {
        const audioResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Executive Summary for ${currentProject.productName}: 
          Business Plan Summary: ${businessPlan.substring(0, 500)}
          Market Opportunity: ${marketIntel.substring(0, 300)}
          Competitive Edge: ${competition.substring(0, 200)}
          Vibe: ${currentProject.vibe}. 
          Keep it under 60 seconds and make it sound like a high-energy startup pitch.` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });
        const part = audioResponse.candidates?.[0]?.content?.parts?.[0];
        const base64Audio = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType || '';
        
        if (base64Audio) {
          console.log("Audio data received. MIME:", mimeType, "Length:", base64Audio.length);
          // Reset existing audio if any
          if (audioRef.current) {
            console.log("Resetting existing audio player...");
            audioRef.current.pause();
            if (audioRef.current.src.startsWith('blob:')) {
              URL.revokeObjectURL(audioRef.current.src);
            }
            audioRef.current = null;
          }
          setIsPlayingAudio(false);
          setAudioProgress(0);
          setAudioDuration(0);
          
          let audioUrl = '';
          if (mimeType.includes('pcm') || !mimeType) {
            console.log("Converting PCM to WAV...");
            audioUrl = pcmToWav(base64Audio, 24000);
          } else {
            console.log("Using direct base64 audio URL.");
            audioUrl = `data:${mimeType};base64,${base64Audio}`;
          }
          
          console.log("Audio URL generated:", audioUrl.substring(0, 50) + "...");
          setKit(prev => ({ ...prev, audioBrief: audioUrl }));
          addLog('system', "Audio brief generated successfully.");
        } else {
          console.warn("No audio data found in AI response parts.");
          addLog('system', "Audio brief generation skipped (no data).");
        }
      } catch (e) {
        console.error("Audio brief gen failed", e);
        addLog('system', "Audio brief generation skipped.");
      }

      setStep('results');
    } catch (error) {
      console.error(error);
      addLog('system', "Error in LaunchKit pipeline. Please check API configuration.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAudio = () => {
    if (!kit.audioBrief) {
      console.warn("No audio brief available to play.");
      return;
    }

    if (!audioRef.current) {
      console.log("Initializing new Audio object...");
      audioRef.current = new Audio(kit.audioBrief);
      audioRef.current.onended = () => {
        console.log("Audio playback ended.");
        setIsPlayingAudio(false);
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) setAudioProgress(audioRef.current.currentTime);
      };
      audioRef.current.onloadedmetadata = () => {
        console.log("Audio metadata loaded. Duration:", audioRef.current?.duration);
        if (audioRef.current) {
          setAudioDuration(audioRef.current.duration);
          setAudioError(null);
        }
      };
      audioRef.current.oncanplay = () => {
        console.log("Audio can play. Duration:", audioRef.current?.duration);
        if (audioRef.current && audioDuration === 0) setAudioDuration(audioRef.current.duration);
      };
      audioRef.current.onerror = (e) => {
        console.error("Audio element error:", e);
        setAudioError("Playback failed.");
        setIsPlayingAudio(false);
      };
      audioRef.current.load();
    }
    
    if (isPlayingAudio) {
      console.log("Pausing audio...");
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      console.log("Starting audio playback...");
      setAudioError(null);
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log("Playback started successfully.");
          setIsPlayingAudio(true);
        }).catch(e => {
          console.error("Audio playback failed:", e);
          setAudioError("Playback blocked.");
          setIsPlayingAudio(false);
          if (e.name === 'NotSupportedError' || e.name === 'InvalidStateError') {
             console.log("Resetting audio object due to error.");
             audioRef.current = null;
          }
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E4E4E7] font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setStep('landing')}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              LaunchKit AI
            </h1>
          </div>
          
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-4 text-xs font-mono text-white/40 uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  System Online
                </span>
              </div>

              {user ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowSavedModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Folder className="w-3.5 h-3.5 text-blue-400" />
                    Saved
                  </button>
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  <div className="flex items-center gap-2">
                    {user.photoURL && (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-6 h-6 rounded-full border border-white/20" referrerPolicy="no-referrer" />
                    )}
                    <button
                      onClick={handleLogout}
                      className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors text-white/40"
                      title="Logout"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </button>
              )}

              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 hover:bg-white/5 rounded-lg md:hidden"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black/95 pt-20 px-6 md:hidden"
          >
            <nav className="space-y-6">
              <button onClick={() => { setStep('input'); setIsMenuOpen(false); }} className="block text-2xl font-bold text-white">New Project</button>
              <button onClick={() => setIsMenuOpen(false)} className="block text-2xl font-bold text-white/60">Dashboard</button>
              <button onClick={() => setIsMenuOpen(false)} className="block text-2xl font-bold text-white/60">Settings</button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {step === 'landing' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-[85vh] flex flex-col items-center justify-center text-center space-y-12 py-20 relative overflow-hidden"
          >
            {/* Background Glows */}
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-blue-500/20 blur-3xl rounded-full"></div>
              <Rocket className="w-24 h-24 text-blue-500 relative z-10 mx-auto mb-8 animate-bounce" style={{ animationDuration: '3s' }} />
            </motion.div>

            <div className="space-y-6 max-w-4xl mx-auto relative z-10">
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-6xl sm:text-9xl font-black tracking-tighter text-white leading-[0.85] uppercase"
              >
                Launch <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">Free</span> <br />
                Scale <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600">Organic</span>
              </motion.h1>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xl sm:text-3xl text-white/60 font-medium max-w-3xl mx-auto tracking-tight"
              >
                The world's first $0 budget AI marketing agency. 
                Get your first 100 customers with zero ad spend.
              </motion.p>
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 w-full max-w-md relative z-10"
            >
              <button 
                onClick={() => {
                  setStep('loading');
                  setTimeout(() => setStep('input'), 2500);
                }}
                className="flex-1 bg-white text-black font-black py-6 px-10 rounded-2xl transition-all flex items-center justify-center gap-3 group shadow-2xl shadow-white/10 text-xl uppercase tracking-widest hover:scale-[1.02] active:scale-95"
              >
                Enter War Room
                <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-12 pt-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-1000 relative z-10"
            >
              <div className="flex flex-col items-center gap-2">
                <Target className="w-6 h-6 text-blue-400" />
                <span className="font-black text-[10px] tracking-[0.2em] uppercase">Strategy</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <PenTool className="w-6 h-6 text-purple-400" />
                <span className="font-black text-[10px] tracking-[0.2em] uppercase">Creative</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <BarChart3 className="w-6 h-6 text-green-400" />
                <span className="font-black text-[10px] tracking-[0.2em] uppercase">Media</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Zap className="w-6 h-6 text-orange-400" />
                <span className="font-black text-[10px] tracking-[0.2em] uppercase">Growth</span>
              </div>
            </motion.div>
          </motion.div>
        )}

        {step === 'loading' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-[70vh] flex flex-col items-center justify-center space-y-12"
          >
            <div className="relative w-32 h-32">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-blue-500/20 border-t-blue-500 rounded-full"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-4 border-4 border-purple-500/20 border-t-purple-500 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Cpu className="w-10 h-10 text-white animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-black tracking-widest uppercase text-white">Initializing Agents</h2>
              <div className="flex gap-2 justify-center">
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 bg-blue-500 rounded-full" />
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-blue-500 rounded-full" />
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-blue-500 rounded-full" />
              </div>
              <p className="text-white/40 font-mono text-xs uppercase tracking-widest">Establishing secure neural uplink...</p>
            </div>
          </motion.div>
        )}

        {step === 'input' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-8 sm:space-y-12"
          >
            <div className="space-y-4 text-center">
              <h2 className="text-3xl sm:text-6xl font-black tracking-tighter text-white leading-tight uppercase">
                From <span className="text-blue-500">Shower Idea</span> <br />
                To <span className="text-purple-500">Investor Ready</span>
              </h2>
              <p className="text-base sm:text-xl text-white/60 font-medium">
                Upload your README, brain-dump, or tech spec. <br />
                LaunchKit transforms it into a cohesive business infrastructure.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <Sparkles className="w-6 h-6 text-blue-500/40" />
                  </div>

                  {/* Magic Import Area */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">1. The Magic Import (AI-Driven)</label>
                    <div 
                      {...getRootProps()} 
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer group",
                        isDragActive ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:border-white/20 bg-black/40",
                        isParsing && "opacity-50 cursor-wait"
                      )}
                    >
                      <input {...getInputProps()} />
                      {isParsing ? (
                        <div className="space-y-4">
                          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                          <p className="text-sm font-bold text-white">AI is parsing your document...</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                            <Upload className="w-8 h-8 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Drop README, Tech Spec, or Notes</p>
                            <p className="text-xs text-white/40 mt-1">AI will extract Problem, Solution, and Pricing</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/5"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                      <span className="bg-[#0A0A0B] px-4 text-white/20">or enter details manually</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Product Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Orbit - AI Task Manager"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm font-medium"
                        value={project.productName}
                        onChange={e => setProject({...project, productName: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Product Description</label>
                      <textarea 
                        placeholder="What problem are you solving?"
                        rows={4}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none text-sm font-medium"
                        value={project.productDescription}
                        onChange={e => setProject({...project, productDescription: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Target Audience</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Solo Founders"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm font-medium"
                          value={project.targetAudience}
                          onChange={e => setProject({...project, targetAudience: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Vibe / Aesthetic</label>
                        <select 
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm font-medium appearance-none"
                          value={project.vibe}
                          onChange={e => setProject({...project, vibe: e.target.value as any})}
                        >
                          <option>Tech</option>
                          <option>Minimal</option>
                          <option>Bold</option>
                          <option>Luxury</option>
                          <option>Friendly</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={runAgency}
                    disabled={(!project.productName || !project.productDescription) && !project.url}
                    className="w-full bg-white text-black font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 group shadow-2xl shadow-white/10 uppercase tracking-widest text-sm hover:scale-[1.01] active:scale-95"
                  >
                    Generate Business Kit
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Gap Detection & Real-time Info */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-orange-400" /> Gap Detection
                  </h4>
                  
                  {project.gaps && project.gaps.length > 0 ? (
                    <div className="space-y-3">
                      {project.gaps.map((gap, i) => (
                        <div key={i} className="flex gap-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                          <div className="w-5 h-5 bg-orange-500/20 rounded-full flex items-center justify-center shrink-0">
                            <Plus className="w-3 h-3 text-orange-400" />
                          </div>
                          <p className="text-xs text-white/80 leading-relaxed font-medium">{gap}</p>
                        </div>
                      ))}
                      <p className="text-[10px] text-white/40 italic">AI will attempt to fill these gaps using market data, but manual input improves accuracy.</p>
                    </div>
                  ) : (
                    <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl">
                      <CheckCircle className="w-8 h-8 text-white/10 mx-auto mb-2" />
                      <p className="text-xs text-white/40">No critical gaps detected yet. Upload a document to trigger analysis.</p>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Zap className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Logic Engine Status</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-white/40">Cohesive Data Flow</span>
                      <span className="text-green-400">Active</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="h-full w-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                      />
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed font-medium">
                      LaunchKit ensures your <span className="text-white">Market Research</span> informs your <span className="text-white">Financials</span>, which informs your <span className="text-white">Pitch Deck</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-auto lg:h-[calc(100vh-200px)]">
            {/* Agency Status */}
            <div className="lg:col-span-2 space-y-6 flex flex-col">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex-1 flex flex-col overflow-hidden min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Cpu className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="font-bold">Agency War Room</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                      {isGenerating ? 'Processing' : 'Idle'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                  {AGENTS.map((agent, idx) => (
                    <div 
                      key={agent.id}
                      className={cn(
                        "p-3 rounded-xl border transition-all duration-500",
                        activeAgentIndex === idx 
                          ? "bg-blue-500/10 border-blue-500/50 scale-105 shadow-lg shadow-blue-500/10" 
                          : "bg-white/5 border-white/10 opacity-40"
                      )}
                    >
                      <div className="text-xl mb-1">{agent.avatar}</div>
                      <div className="font-bold text-xs truncate">{agent.name}</div>
                      <div className="text-[9px] uppercase tracking-wider text-white/40 truncate">{agent.role}</div>
                    </div>
                  ))}
                </div>

                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar font-mono text-xs sm:text-sm"
                >
                  {logs.map((log, i) => {
                    const agent = AGENTS.find(a => a.id === log.agentId);
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i} 
                        className="flex gap-2 sm:gap-3"
                      >
                        <span className="text-white/20 shrink-0">[{log.timestamp.toLocaleTimeString([], { hour12: false })}]</span>
                        <span className={cn(
                          "font-bold shrink-0",
                          agent?.id === 'strategist' && "text-blue-400",
                          agent?.id === 'copywriter' && "text-purple-400",
                          agent?.id === 'analyst' && "text-green-400",
                          agent?.id === 'growth' && "text-orange-400",
                          log.agentId === 'system' && "text-red-400"
                        )}>
                          {agent?.name || 'SYSTEM'}:
                        </span>
                        <span className="text-white/80 break-words">{log.message}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Launch Configuration</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/60">Vibe</span>
                    <select 
                      className="bg-transparent text-xs font-bold text-blue-400 focus:outline-none"
                      value={project.vibe}
                      onChange={e => {
                        setProject({...project, vibe: e.target.value as any});
                      }}
                    >
                      <option>Tech</option>
                      <option>Minimal</option>
                      <option>Bold</option>
                      <option>Luxury</option>
                      <option>Friendly</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/60">Ad Spend</span>
                    <span className="text-xs font-bold text-green-400">$0 (Organic)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/60">Deliverables</span>
                    <span className="text-xs font-bold">12 Assets</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-blue-400">
                  <Zap className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Logic Engine</span>
                </div>
                <p className="text-xs text-white/80 italic leading-relaxed">
                  "All assets are cross-referenced for consistency. Your branding informs your pitch, which informs your growth plan."
                </p>
                <div className="pt-4 border-t border-white/5">
                  <button className="w-full py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-all">
                    Download Full Kit (.ZIP)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'results' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/5 border border-white/10 p-6 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Launch Engine Ready</h2>
                  <p className="text-sm text-white/60">Autonomous agency has completed all deliverables.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {user ? (
                  <button
                    onClick={saveBusiness}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Folder className="w-4 h-4 text-blue-400" />
                    )}
                    {isSaving ? 'Saving...' : 'Save Project'}
                  </button>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-xl text-sm font-bold text-blue-400 transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    Login to Save
                  </button>
                )}
                
                {kit.audioBrief && (
                  <div className="flex flex-col gap-1.5 min-w-[180px] sm:min-w-[240px]">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={toggleAudio}
                        className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-600/20"
                      >
                        {isPlayingAudio ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                      </button>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase">
                          <span className="text-blue-400">Audio Brief</span>
                          {audioError ? (
                            <span className="text-red-400 font-mono">{audioError}</span>
                          ) : (
                            <span className="text-white/40 font-mono">{formatTime(audioProgress)} / {formatTime(audioDuration)}</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${(audioProgress / (audioDuration || 1)) * 100}%` }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => setStep('input')}
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                >
                  <RefreshCcw className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Results Navigation (Tabs) */}
            <div className="space-y-6">
              <div className="flex flex-wrap gap-8 items-center border-b border-white/5 pb-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 block">Strategy</span>
                  <div className="flex gap-2">
                    <TabButton active={activeTab === 'market'} onClick={() => setActiveTab('market')} icon={<Search className="w-4 h-4" />} label="Market Intel" />
                    <TabButton active={activeTab === 'competition'} onClick={() => setActiveTab('competition')} icon={<Target className="w-4 h-4" />} label="Competition" />
                    <TabButton active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} icon={<FileText className="w-4 h-4" />} label="Business Plan" />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 block">Creative</span>
                  <div className="flex gap-2">
                    <TabButton active={activeTab === 'brand'} onClick={() => setActiveTab('brand')} icon={<Palette className="w-4 h-4" />} label="Brand Identity" />
                    <TabButton active={activeTab === 'pitch'} onClick={() => setActiveTab('pitch')} icon={<Presentation className="w-4 h-4" />} label="Pitch Deck" />
                    <TabButton active={activeTab === 'landing'} onClick={() => setActiveTab('landing')} icon={<FileCode className="w-4 h-4" />} label="Landing Page" />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 block">Operations</span>
                  <div className="flex gap-2">
                    <TabButton active={activeTab === 'financials'} onClick={() => setActiveTab('financials')} icon={<DollarSign className="w-4 h-4" />} label="Financials" />
                    <TabButton active={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} icon={<Zap className="w-4 h-4" />} label="Marketing" />
                    <TabButton active={activeTab === 'legal'} onClick={() => setActiveTab('legal')} icon={<ShieldCheck className="w-4 h-4" />} label="Legal & Social" />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 block">Management</span>
                  <div className="flex gap-2">
                    <TabButton active={activeTab === 'launchpad'} onClick={() => setActiveTab('launchpad')} icon={<Rocket className="w-4 h-4" />} label="LaunchPad" />
                    <TabButton active={activeTab === 'outreach'} onClick={() => setActiveTab('outreach')} icon={<Users className="w-4 h-4" />} label="Outreach" />
                    <TabButton active={activeTab === 'connections'} onClick={() => setActiveTab('connections')} icon={<LinkIcon className="w-4 h-4" />} label="Connections" />
                    <TabButton active={activeTab === 'live-agents'} onClick={() => setActiveTab('live-agents')} icon={<Activity className="w-4 h-4" />} label="Live Agents" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 min-h-[500px]"
                  >
                    {activeTab === 'brand' && (
                      <div className="space-y-8">
                        <div className="flex justify-between items-center">
                          <SectionHeader title="Brand Identity" agent={AGENTS[1]} />
                          <button 
                            onClick={() => handleDeploy('Lyric', kit.brandIdentity)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold transition-all"
                          >
                            <Bot className="w-4 h-4" /> Deploy Lyric
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">Visual Identity</h4>
                            <MarkdownContent content={kit.brandIdentity} />
                          </div>
                          {kit.logoConcept && (
                            <div className="space-y-4">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Logo Concept</h4>
                              <div className="aspect-square rounded-2xl overflow-hidden border border-white/10 bg-white/5 shadow-2xl">
                                <img src={kit.logoConcept} alt="AI Generated Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                <Download className="w-3 h-3" /> Download Vector
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'market' && (
                      <div className="space-y-8">
                        <SectionHeader title="Market Intelligence" agent={AGENTS[0]} />
                        <MarkdownContent content={kit.marketIntel} />
                      </div>
                    )}

                    {activeTab === 'competition' && (
                      <div className="space-y-8">
                        <SectionHeader title="Competition Analysis" agent={AGENTS[0]} />
                        <MarkdownContent content={kit.competition} />
                      </div>
                    )}

                    {activeTab === 'plan' && (
                      <div className="space-y-8">
                        <div className="flex justify-between items-center">
                          <SectionHeader title="Business Plan" agent={AGENTS[0]} />
                          <button 
                            onClick={() => handleDeploy('Astra', kit.businessPlan)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-all"
                          >
                            <Bot className="w-4 h-4" /> Deploy Astra
                          </button>
                        </div>
                        <MarkdownContent content={kit.businessPlan} />
                      </div>
                    )}

                    {activeTab === 'financials' && (
                      <div className="space-y-8">
                        <SectionHeader title="Financial Projections" agent={AGENTS[2]} />
                        <MarkdownContent content={kit.financials} />
                      </div>
                    )}

                    {activeTab === 'marketing' && (
                      <div className="space-y-8">
                        <div className="flex justify-between items-center">
                          <SectionHeader title="Marketing Strategy" agent={AGENTS[3]} />
                          <button 
                            onClick={() => handleDeploy('Echo', kit.marketing)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-bold transition-all"
                          >
                            <Bot className="w-4 h-4" /> Deploy Echo
                          </button>
                        </div>
                        <MarkdownContent content={kit.marketing} />
                      </div>
                    )}

                    {activeTab === 'pitch' && (
                      <div className="space-y-8">
                        <SectionHeader title="Pitch Deck Structure" agent={AGENTS[1]} />
                        <MarkdownContent content={kit.pitchDeck} />
                        <div className="flex gap-4">
                          <button className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                            <Presentation className="w-4 h-4" /> Export to Slides
                          </button>
                          <button className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                            <Download className="w-4 h-4" /> Download PDF
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === 'landing' && (
                      <div className="space-y-8">
                        <SectionHeader title="Landing Page Mockup" agent={AGENTS[1]} />
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                          <div className="flex items-center justify-between mb-6">
                        <div className="flex gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500/50" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                          <div className="w-3 h-3 rounded-full bg-green-500/50" />
                        </div>
                        <div className="px-4 py-1 bg-white/5 rounded-full text-[10px] text-white/40 font-mono">
                          {project.productName.toLowerCase().replace(/\s+/g, '-')}.launchkit.ai
                        </div>
                          </div>
                          <div className="prose prose-invert max-w-none">
                            <pre className="bg-black/40 p-6 rounded-2xl overflow-x-auto font-mono text-xs text-blue-400">
                              <code>{kit.landingPage}</code>
                            </pre>
                          </div>
                          <div className="mt-6 flex justify-end">
                            <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all">
                              <ExternalLink className="w-4 h-4" />
                              Deploy Preview
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'legal' && (
                      <div className="space-y-8">
                        <SectionHeader title="Legal & Social Infrastructure" agent={AGENTS[3]} />
                        <MarkdownContent content={kit.legalSocial} />
                      </div>
                    )}

                    {activeTab === 'launchpad' && (
                      <div className="space-y-8">
                        <div className="flex justify-between items-center">
                          <SectionHeader title="LaunchPad Strategy" agent={AGENTS[4]} />
                          <button 
                            onClick={() => handleDeploy('Nova', kit.launchStrategy || '')}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold transition-all"
                          >
                            <Bot className="w-4 h-4" /> Deploy Nova
                          </button>
                        </div>
                        <MarkdownContent content={kit.launchStrategy || ''} />
                      </div>
                    )}

                    {activeTab === 'outreach' && (
                      <div className="space-y-8">
                        <div className="flex justify-between items-center">
                          <SectionHeader title="Outreach & Community" agent={AGENTS[5]} />
                          <button 
                            onClick={() => handleDeploy('Atlas', kit.outreachTemplates || '')}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-bold transition-all"
                          >
                            <Bot className="w-4 h-4" /> Deploy Atlas
                          </button>
                        </div>
                        <MarkdownContent content={kit.outreachTemplates || ''} />
                      </div>
                    )}

                    {activeTab === 'connections' && (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between">
                          <h3 className="text-2xl font-bold text-white">Platform Connections</h3>
                          <ShieldCheck className="w-6 h-6 text-green-400" />
                        </div>
                        <p className="text-sm text-white/60">Connect your accounts to enable autonomous agents to execute your marketing plan directly on social media and Google Workspace.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {connections.map((conn) => (
                            <div key={conn.provider} className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                              <div className="flex justify-between items-start">
                                <div className="p-3 bg-white/5 rounded-xl">
                                  {conn.provider === 'google' && <Mail className="w-6 h-6 text-red-400" />}
                                  {conn.provider === 'x' && <Share2 className="w-6 h-6 text-white" />}
                                  {conn.provider === 'linkedin' && <Users className="w-6 h-6 text-blue-400" />}
                                </div>
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                  conn.status === 'connected' ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"
                                )}>
                                  {conn.status}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-bold text-white capitalize">{conn.provider}</h4>
                                <p className="text-xs text-white/40 mt-1">
                                  {conn.provider === 'google' ? 'Gmail, Sheets, Docs' : `Post & Engage on ${conn.provider.toUpperCase()}`}
                                </p>
                              </div>
                              <button 
                                onClick={() => handleConnect(conn.provider)}
                                className={cn(
                                  "w-full py-2 rounded-lg text-xs font-bold transition-all",
                                  conn.status === 'connected' 
                                    ? "bg-white/10 text-white/60 hover:bg-white/20" 
                                    : "bg-blue-600 text-white hover:bg-blue-500"
                                )}
                              >
                                {conn.status === 'connected' ? 'Reconnect' : 'Connect Account'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === 'live-agents' && (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between">
                          <h3 className="text-2xl font-bold text-white">Autonomous Agent Fleet</h3>
                          <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
                        </div>
                        
                        {deployedAgents.length === 0 ? (
                          <div className="p-12 text-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
                            <Bot className="w-12 h-12 text-white/10 mx-auto mb-4" />
                            <h4 className="text-white font-bold">No Agents Deployed</h4>
                            <p className="text-sm text-white/40 mt-2">Deploy an agent from the Strategy or Creative tabs to see them in action.</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {deployedAgents.map((agent) => (
                              <div key={agent.id} className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400">
                                      <Bot className="w-6 h-6" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-white">Autonomous {agent.agentId}</h4>
                                      <p className="text-xs text-white/40">Task: {agent.task.substring(0, 50)}...</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                      agent.status === 'completed' ? "bg-green-500/20 text-green-400" :
                                      agent.status === 'executing' ? "bg-blue-500/20 text-blue-400" :
                                      "bg-white/10 text-white/40"
                                    )}>
                                      {agent.status}
                                    </span>
                                  </div>
                                </div>
                                <div className="bg-black/40 rounded-xl p-4 font-mono text-[10px] space-y-1 max-h-32 overflow-y-auto">
                                  {agent.logs.map((log, i) => (
                                    <div key={i} className="flex gap-2">
                                      <span className="text-white/20">[{new Date(agent.createdAt).toLocaleTimeString()}]</span>
                                      <span className="text-white/60">{log}</span>
                                    </div>
                                  ))}
                                  {agent.status === 'executing' && (
                                    <div className="flex gap-2 items-center text-blue-400">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>Processing autonomous actions...</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Sidebar: Quick Actions & Overview */}
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Launch Dashboard</h4>
                    <div className="space-y-4">
                      <DashboardItem icon={<Globe className="w-4 h-4" />} label="Market Ready" status="100%" />
                      <DashboardItem icon={<Target className="w-4 h-4" />} label="Audience Match" status="High" />
                      <DashboardItem icon={<Zap className="w-4 h-4" />} label="Growth Potential" status="Viral" />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Brand Vibe</h4>
                    <div className="space-y-4">
                      <select 
                        value={project.vibe}
                        onChange={(e) => setProject(prev => ({ ...prev, vibe: e.target.value as any }))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                      >
                        {['Minimal', 'Bold', 'Luxury', 'Tech', 'Friendly'].map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      <button 
                        onClick={runAgency}
                        disabled={isGenerating}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        Re-generate Assets
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-4">Agent Advice</h4>
                  <p className="text-sm text-white/80 leading-relaxed italic">
                    "Astra recommends focusing 100% of your energy on high-leverage organic communities like Reddit and X to build social proof before launching on Product Hunt."
                  </p>
                </div>

                <button 
                  onClick={() => window.print()}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-sm font-bold flex items-center justify-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Export Launch Plan
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white/20 text-sm font-mono">
            <TerminalIcon className="w-4 h-4" />
            <span>&copy; 2026 LAUNCHKIT AI // POWERED BY LAUNCHPAD AUTONOMOUS ENGINE</span>
          </div>
          <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-white/40">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">API Status</a>
          </div>
        </div>
      </footer>

      <SavedBusinessesModal 
        isOpen={showSavedModal} 
        onClose={() => setShowSavedModal(false)}
        businesses={savedBusinesses}
        onLoad={loadBusiness}
        onDelete={deleteBusiness}
      />
    </div>
  );
}

function SavedBusinessesModal({ 
  isOpen, 
  onClose, 
  businesses, 
  onLoad, 
  onDelete 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  businesses: Business[];
  onLoad: (b: Business) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-[#121214] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <Folder className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Saved Projects</h3>
                  <p className="text-xs text-white/40 font-mono uppercase tracking-widest">Archive // {businesses.length} Items</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {businesses.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                    <Folder className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/40 font-medium">No saved projects found.</p>
                </div>
              ) : (
                businesses.map((business) => (
                  <div 
                    key={business.id}
                    className="group flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                  >
                    <div className="flex-1 cursor-pointer" onClick={() => { onLoad(business); onClose(); }}>
                      <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">{business.project.productName}</h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/40 font-mono">
                        <span>{new Date(business.updatedAt).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span className="uppercase">{business.project.vibe} Vibe</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { onLoad(business); onClose(); }}
                        className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold rounded-lg transition-all"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => onDelete(business.id)}
                        className="p-1.5 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded-lg transition-all"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-6 py-3 rounded-xl border transition-all whitespace-nowrap text-sm font-bold",
        active 
          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20" 
          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SectionHeader({ title, agent }: { title: string; agent: Agent }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-2xl font-bold text-white">{title}</h3>
      <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
        <span className="text-sm">{agent.avatar}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">{agent.name}</span>
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-white/70 prose-strong:text-white prose-code:text-blue-400">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

function DashboardItem({ icon, label, status }: { icon: React.ReactNode; label: string; status: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-white/60">
        {icon}
        {label}
      </div>
      <span className="text-sm font-bold text-white">{status}</span>
    </div>
  );
}
