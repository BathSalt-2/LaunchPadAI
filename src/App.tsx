/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  CheckCircle
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { AGENTS, Agent, ProjectState, MarketingPlan } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type TabType = 'strategy' | 'creative' | 'media' | 'growth' | 'assets' | 'competitors' | 'outreach' | 'landing';

export default function App() {
  const [step, setStep] = useState<'landing' | 'loading' | 'input' | 'processing' | 'results'>('landing');
  const [activeTab, setActiveTab] = useState<TabType>('strategy');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [project, setProject] = useState<ProjectState>({
    productName: '',
    productDescription: '',
    targetAudience: '',
    budget: '0',
    url: '',
    language: 'English'
  });
  
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [logs, setLogs] = useState<{ agentId: string; message: string; timestamp: Date }[]>([]);
  const [plan, setPlan] = useState<MarketingPlan>({
    strategy: '',
    copy: '',
    media: '',
    outreach: '',
    adImages: [],
    audioBrief: '',
    competitors: '',
    videoScript: '',
    landingPage: '',
    emailSequence: '',
    influencers: '',
    checklist: '',
    logoConcept: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (agentId: string, message: string) => {
    setLogs(prev => [...prev, { agentId, message, timestamp: new Date() }]);
  };

  const analyzeUrl = async () => {
    if (!project.url) return;
    setIsAnalyzing(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this URL: ${project.url}. Extract the product name, a detailed description of what it does, and who the target audience is. Return the result in JSON format with keys: productName, productDescription, targetAudience.`,
        config: { 
          tools: [{ urlContext: {} }],
          responseMimeType: "application/json"
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      setProject(prev => ({
        ...prev,
        productName: data.productName || prev.productName,
        productDescription: data.productDescription || prev.productDescription,
        targetAudience: data.targetAudience || prev.targetAudience
      }));
    } catch (error) {
      console.error("Analysis error:", error);
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

      // 0. Deep Dive Analysis (if URL provided)
      if (project.url && (!project.productName || !project.productDescription)) {
        addLog('system', "Initiating deep dive analysis of provided URL...");
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analyze this URL: ${project.url}. Extract the product name, a detailed description of what it does, and who the target audience is. Return the result in JSON format with keys: productName, productDescription, targetAudience.`,
          config: { 
            tools: [{ urlContext: {} }],
            responseMimeType: "application/json"
          }
        });
        const data = JSON.parse(response.text || '{}');
        currentProject = {
          ...currentProject,
          productName: data.productName || currentProject.productName || 'Unknown Product',
          productDescription: data.productDescription || currentProject.productDescription || 'No description found.',
          targetAudience: data.targetAudience || currentProject.targetAudience || 'General Audience'
        };
        setProject(currentProject);
        addLog('system', `Analysis complete for ${currentProject.productName}.`);
      }

      // 1. Strategist: Strategy + Competitors
      setActiveAgentIndex(0);
      addLog('strategist', `Analyzing ${currentProject.productName} and market landscape...`);
      const strategistResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Product: ${currentProject.productName}\nDescription: ${currentProject.productDescription}\nAudience: ${currentProject.targetAudience}\nMarketing Budget: $0 (Strict Organic Focus)\nLanguage: ${currentProject.language}\n\nCreate a zero-budget launch strategy and find 3 top competitors using search.`,
        config: { 
          systemInstruction: AGENTS[0].systemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });
      const strategy = strategistResponse.text || '';
      setPlan(prev => ({ ...prev, strategy }));
      addLog('strategist', "Strategy finalized. Competitor benchmarking complete.");

      // 2. Creative: Copy + Logo Concept + Video Script + Landing Page
      setActiveAgentIndex(1);
      addLog('copywriter', "Drafting high-conversion assets and landing page mockup...");
      const creativeResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Strategy: ${strategy}\n\n1. Write ad copy.\n2. Suggest a logo concept.\n3. Write a 30-second TikTok/Reels script.\n4. Generate a basic HTML/Tailwind mockup for a landing page.`,
        config: { systemInstruction: AGENTS[1].systemInstruction }
      });
      const creativeText = creativeResponse.text || '';
      setPlan(prev => ({ 
        ...prev, 
        copy: creativeText,
        videoScript: creativeText.split('3.')[1]?.split('4.')[0] || '',
        logoConcept: creativeText.split('2.')[1]?.split('3.')[0] || '',
        landingPage: creativeText.split('4.')[1] || ''
      }));
      addLog('copywriter', "Creative assets ready. Generating visual mockups...");

      // 2.1 AI Image Generation (Ad Mockup)
      try {
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `A professional, modern organic social media post for ${currentProject.productName}. High quality, clean design, tech aesthetic, designed for viral reach on X/LinkedIn.` }] },
          config: { imageConfig: { aspectRatio: "1:1" } }
        });
        const imagePart = imageResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart) {
          setPlan(prev => ({ ...prev, adImages: [`data:image/png;base64,${imagePart.inlineData?.data}`] }));
        }
      } catch (e) { console.error("Image gen failed", e); }

      // 3. Media Buyer: Media Plan + Influencers
      setActiveAgentIndex(2);
      addLog('analyst', "Calculating channel ROI and influencer matchmaking...");
      const mediaResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Strategy: ${strategy}\nMarketing Budget: $0\n\n1. Recommend organic channels (Reddit, X, etc.).\n2. Find 5 specific influencer niches or types using search for organic collaboration.`,
        config: { 
          systemInstruction: AGENTS[2].systemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });
      const mediaText = mediaResponse.text || '';
      setPlan(prev => ({ 
        ...prev, 
        media: mediaText,
        influencers: mediaText.split('2.')[1] || ''
      }));
      addLog('analyst', "Media plan optimized. Influencer list compiled.");

      // 4. Growth Hacker: Outreach + Email + PH Checklist
      setActiveAgentIndex(3);
      addLog('growth', "Building growth loops and launch checklists...");
      const growthResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Product: ${currentProject.productName}\nStrategy: ${strategy}\n\n1. Growth hacks.\n2. 3-day email sequence.\n3. Product Hunt launch checklist.`,
        config: { systemInstruction: AGENTS[3].systemInstruction }
      });
      const growthText = growthResponse.text || '';
      setPlan(prev => ({ 
        ...prev, 
        outreach: growthText,
        emailSequence: growthText.split('2.')[1]?.split('3.')[0] || '',
        checklist: growthText.split('3.')[1] || ''
      }));
      addLog('growth', "Growth engine primed. Generating audio briefing...");

      // 5. Audio Brief (TTS)
      try {
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Here is your LaunchPad AI Agency briefing for ${currentProject.productName}. Our strategy focuses on ${strategy.substring(0, 100)}...` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } }
          }
        });
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          setPlan(prev => ({ ...prev, audioBrief: `data:audio/mp3;base64,${base64Audio}` }));
        }
      } catch (e) { console.error("TTS failed", e); }

      setStep('results');
    } catch (error) {
      console.error(error);
      addLog('system', "Error in agency pipeline. Please check API configuration.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(plan.audioBrief);
      audioRef.current.onended = () => setIsPlayingAudio(false);
    }
    
    if (isPlayingAudio) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlayingAudio(!isPlayingAudio);
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
              LaunchPad AI
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 text-xs font-mono text-white/40 uppercase tracking-widest">
              <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                System Online
              </span>
            </div>
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
            className="max-w-2xl mx-auto space-y-8 sm:space-y-12"
          >
            <div className="space-y-4 text-center">
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
                The First 100 Customers. <br />
                <span className="text-blue-500">$0 Ad Spend.</span>
              </h2>
              <p className="text-base sm:text-lg text-white/60">
                Input your product details or a URL. Our multi-agent AI agency will build 
                a high-impact organic growth engine for you.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/40">Product or GitHub URL (Optional)</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="url" 
                    placeholder="https://github.com/username/repo"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                    value={project.url}
                    onChange={e => setProject({...project, url: e.target.value})}
                  />
                  <button 
                    onClick={analyzeUrl}
                    disabled={!project.url || isAnalyzing}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-bold"
                  >
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                    Analyze
                  </button>
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

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/40">Product Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Orbit - AI Task Manager"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                  value={project.productName}
                  onChange={e => setProject({...project, productName: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/40">Product Description</label>
                <textarea 
                  placeholder="What problem are you solving?"
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none text-sm"
                  value={project.productDescription}
                  onChange={e => setProject({...project, productDescription: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/40">Target Audience</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Solo Founders"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                    value={project.targetAudience}
                    onChange={e => setProject({...project, targetAudience: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/40">Language</label>
                  <select 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm appearance-none"
                    value={project.language}
                    onChange={e => setProject({...project, language: e.target.value})}
                  >
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Japanese</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={runAgency}
                disabled={(!project.productName || !project.productDescription) && !project.url}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group shadow-xl shadow-blue-600/20"
              >
                Initialize Launch Sequence
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">Project Specs</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Product</span>
                    <span className="text-sm font-bold truncate max-w-[150px]">{project.productName || 'Analyzing...'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Ad Spend</span>
                    <span className="text-sm font-bold text-green-400">$0 (Organic)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Language</span>
                    <span className="text-sm font-bold">{project.language}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-blue-400 mb-3">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">AI Insight</span>
                </div>
                <p className="text-sm text-white/80 italic leading-relaxed">
                  "Our agents are currently cross-referencing successful launch patterns from the last 24 months to optimize your strategy."
                </p>
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
                {plan.audioBrief && (
                  <button 
                    onClick={toggleAudio}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all text-xs font-bold"
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlayingAudio ? 'Pause Brief' : 'Play Audio Brief'}
                  </button>
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
            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
              <TabButton active={activeTab === 'strategy'} onClick={() => setActiveTab('strategy')} icon={<Target className="w-4 h-4" />} label="Strategy" />
              <TabButton active={activeTab === 'creative'} onClick={() => setActiveTab('creative')} icon={<PenTool className="w-4 h-4" />} label="Creative" />
              <TabButton active={activeTab === 'landing'} onClick={() => setActiveTab('landing')} icon={<Layout className="w-4 h-4" />} label="Landing Page" />
              <TabButton active={activeTab === 'media'} onClick={() => setActiveTab('media')} icon={<BarChart3 className="w-4 h-4" />} label="Media" />
              <TabButton active={activeTab === 'growth'} onClick={() => setActiveTab('growth')} icon={<Zap className="w-4 h-4" />} label="Growth" />
              <TabButton active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} icon={<ImageIcon className="w-4 h-4" />} label="AI Assets" />
              <TabButton active={activeTab === 'outreach'} onClick={() => setActiveTab('outreach')} icon={<Mail className="w-4 h-4" />} label="Outreach" />
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
                    {activeTab === 'strategy' && (
                      <div className="space-y-8">
                        <SectionHeader title="Launch Strategy" agent={AGENTS[0]} />
                        <MarkdownContent content={plan.strategy} />
                        {plan.competitors && (
                          <div className="pt-8 border-t border-white/10">
                            <h4 className="flex items-center gap-2 font-bold mb-4 text-blue-400">
                              <Search className="w-4 h-4" /> Competitor Benchmarking
                            </h4>
                            <MarkdownContent content={plan.competitors} />
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'creative' && (
                      <div className="space-y-8">
                        <SectionHeader title="Creative & Copy" agent={AGENTS[1]} />
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                          <h4 className="flex items-center gap-2 font-bold mb-4 text-blue-400">
                            <PenTool className="w-4 h-4" /> High-Conversion Ad Copy
                          </h4>
                          <MarkdownContent content={plan.copy.split('2.')[0]} />
                        </div>
                        {plan.videoScript && (
                          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="flex items-center gap-2 font-bold mb-4 text-purple-400">
                              <Video className="w-4 h-4" /> Viral Video Script (TikTok/Reels)
                            </h4>
                            <MarkdownContent content={plan.videoScript} />
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'landing' && (
                      <div className="space-y-8">
                        <SectionHeader title="Landing Page Mockup" agent={AGENTS[1]} />
                        <div className="bg-black/40 border border-white/10 rounded-xl p-6 font-mono text-xs overflow-x-auto custom-scrollbar">
                          <pre className="text-blue-400">{plan.landingPage}</pre>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button 
                            onClick={() => {
                              const blob = new Blob([plan.landingPage], { type: 'text/html' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'landing-page.html';
                              a.click();
                            }}
                            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                          >
                            <Download className="w-4 h-4" /> Download HTML/Tailwind
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(plan.landingPage);
                              alert('Code copied to clipboard!');
                            }}
                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                          >
                            <Copy className="w-4 h-4" /> Copy Code
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === 'media' && (
                      <div className="space-y-8">
                        <SectionHeader title="Media & Targeting" agent={AGENTS[2]} />
                        <MarkdownContent content={plan.media} />
                        {plan.influencers && (
                          <div className="pt-8 border-t border-white/10">
                            <h4 className="flex items-center gap-2 font-bold mb-4 text-green-400">
                              <Users className="w-4 h-4" /> Influencer Matchmaker
                            </h4>
                            <MarkdownContent content={plan.influencers} />
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'growth' && (
                      <div className="space-y-8">
                        <SectionHeader title="Growth Engine" agent={AGENTS[3]} />
                        <MarkdownContent content={plan.outreach} />
                        {plan.checklist && (
                          <div className="pt-8 border-t border-white/10">
                            <h4 className="flex items-center gap-2 font-bold mb-4 text-orange-400">
                              <ListChecks className="w-4 h-4" /> Product Hunt Checklist
                            </h4>
                            <MarkdownContent content={plan.checklist} />
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'assets' && (
                      <div className="space-y-8">
                        <SectionHeader title="AI Visual Assets" agent={AGENTS[1]} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {plan.adImages?.map((img, i) => (
                            <div key={i} className="space-y-3">
                              <div className="aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5">
                                <img src={img} alt="AI Generated Ad" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <p className="text-xs text-white/40 text-center uppercase tracking-widest">AI Generated Ad Concept #{i+1}</p>
                            </div>
                          ))}
                          {plan.logoConcept && (
                            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                              <h4 className="flex items-center gap-2 font-bold mb-4 text-blue-400">
                                <Palette className="w-4 h-4" /> Logo Concept
                              </h4>
                              <MarkdownContent content={plan.logoConcept} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'outreach' && (
                      <div className="space-y-8">
                        <SectionHeader title="Outreach & Email" agent={AGENTS[3]} />
                        {plan.emailSequence && (
                          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="flex items-center gap-2 font-bold mb-4 text-orange-400">
                              <Mail className="w-4 h-4" /> 3-Day Welcome Sequence
                            </h4>
                            <MarkdownContent content={plan.emailSequence} />
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Sidebar: Quick Actions & Overview */}
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Launch Dashboard</h4>
                  <div className="space-y-4">
                    <DashboardItem icon={<Globe className="w-4 h-4" />} label="Market Ready" status="100%" />
                    <DashboardItem icon={<Target className="w-4 h-4" />} label="Audience Match" status="High" />
                    <DashboardItem icon={<Zap className="w-4 h-4" />} label="Growth Potential" status="Viral" />
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
            <span>&copy; 2026 LAUNCHPAD $0 BUDGET AGENCY // ALL AGENTS AUTONOMOUS</span>
          </div>
          <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-white/40">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">API Status</a>
          </div>
        </div>
      </footer>
    </div>
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
