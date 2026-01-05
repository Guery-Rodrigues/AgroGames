import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import MemoryMapCanvas from './components/MemoryMapCanvas';
import TorqueMasterCanvas from './components/TorqueMasterCanvas';
import DroneRushCanvas from './components/DroneRushCanvas';
import AgroMonitorPanicCanvas from './components/AgroMonitorPanicCanvas';
import VariableRateMasterCanvas from './components/VariableRateMasterCanvas';
import { supabase } from './supabaseClient';

// --- TYPES ---
type ViewState = 'landing' | 'admin' | 'game1' | 'game2' | 'game4' | 'game5' | 'game6' | 'game8' | 'business';
type Theme = 'dark' | 'light';
type RankTab = 'general' | 'game1' | 'game2' | 'game4' | 'game5' | 'game6' | 'game8';

// Admin Navigation Types
type AdminPage = 'profile' | 'whitelabel';
type ConfigTab = 'branding' | 'hero' | 'games' | 'footer';

// Extend Window interface for GA
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

interface LeaderboardItem {
  rank: number;
  name: string;
  score: number;
  unit: string;
  medal?: string;
}

// --- WHITE LABEL CONFIG TYPE (EXPANDED) ---
interface GameConfig {
  title: string;
  tag: string;
  description: string;
  image: string; // URL or Base64
  buttonText: string;
  active?: boolean; // New field for visibility
}

interface WhiteLabelConfig {
  // 1. Branding & Colors
  appName: string;
  accentColor: string;
  bgColor: string;
  navColor: string;
  
  // 2. Hero Section
  heroImage: string;
  heroTitleLine1: string;
  heroTitleLine2: string; // The gradient part
  heroTitleLine3: string;
  heroDescription: string;
  heroButtonText: string;
  heroTagline: string; // "Season 01..."

  // 3. Games Config
  games: {
    game1: GameConfig;
    game2: GameConfig;
    game4: GameConfig;
    game5: GameConfig;
    game6: GameConfig;
    game8: GameConfig;
  };

  // 4. Footer
  footerText: string;
  footerLinkText: string;
  footerLinkUrl?: string; // Optional external link
}

const DEFAULT_CONFIG: WhiteLabelConfig = {
  appName: "AGRO ARCADE",
  accentColor: "#FF6600",
  bgColor: "#050505",
  navColor: "rgba(5, 5, 5, 0.85)",
  
  heroImage: "https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?q=80&w=1600",
  heroTitleLine1: "Domine a",
  heroTitleLine2: "Tecnologia",
  heroTitleLine3: "Do Campo",
  heroDescription: "Teste seus reflexos e estratégia. A operação começa agora.",
  heroButtonText: "[ Iniciar Operação ]",
  heroTagline: "Season 01 • Active",

  games: {
    game1: {
      title: "PULVERIZAÇÃO DE PRECISÃO",
      tag: "⚡ Reflexo Rápido",
      description: "Identifique e elimine invasoras em alta velocidade. Aplique o defensivo apenas onde é necessário e evite desperdícios.",
      image: "",
      buttonText: "Jogar Agora",
      active: true
    },
    game2: {
      title: "NAVEGAÇÃO TÁTICA",
      tag: "🧠 Memória & Lógica",
      description: "O piloto automático desligou. Memorize o traçado do talhão e execute a linha de plantio perfeita sem sobreposição.",
      image: "",
      buttonText: "Jogar Agora",
      active: true
    },
    game4: {
      title: "GESTÃO DE POTÊNCIA",
      tag: "⚙️ Controle de Motor",
      description: "Desafio de terreno. Mantenha o motor na faixa verde de RPM e controle o torque para vencer a inclinação sem patinar.",
      image: "",
      buttonText: "Acelerar",
      active: true
    },
    game5: {
      title: "VOO DE MONITORAMENTO",
      tag: "🕹️ Pilotagem Remota",
      description: "Decole o VANT. Desvie de árvores e obstáculos físicos para mapear os focos de infestação na lavoura.",
      image: "",
      buttonText: "Iniciar Voo",
      active: true
    },
    game6: {
      title: "TELEMETRIA DE FROTA",
      tag: "📡 Gestão de Crise",
      description: "Você é a Torre de Controle. Identifique alertas críticos nas máquinas via satélite e evite a parada da operação.",
      image: "",
      buttonText: "Monitorar",
      active: true
    },
    game8: {
      title: "TAXA VARIÁVEL INTELIGENTE",
      tag: "🎯 Prescrição de Insumos",
      description: "Analise o mapa de produtividade em tempo real. Ajuste a dosagem exata de adubo para cada mancha de solo.",
      image: "",
      buttonText: "Iniciar Aplicação",
      active: true
    }
  },

  footerText: "© 2024 AGRO ARCADE",
  footerLinkText: "Área Comercial / Contrate para Eventos",
  footerLinkUrl: ""
};

const App: React.FC = () => {
  // --- STATE: NAVIGATION & THEME ---
  const [view, setView] = useState<ViewState>('landing');
  const [theme, setTheme] = useState<Theme>('dark');
  
  // Admin Navigation State
  const [adminPage, setAdminPage] = useState<AdminPage>('whitelabel');
  const [configTab, setConfigTab] = useState<ConfigTab>('branding');
  // State for the new drawer editing flow
  const [editingGameKey, setEditingGameKey] = useState<keyof WhiteLabelConfig['games'] | null>(null);
  
  // --- STATE: RANKING ---
  const [rankingTab, setRankingTab] = useState<RankTab>('general');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // --- STATE: ADMIN & WHITE LABEL ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  // Configurações visuais
  const [config, setConfig] = useState<WhiteLabelConfig>(DEFAULT_CONFIG);

  // --- GOOGLE ANALYTICS HELPER ---
  const trackEvent = (eventName: string, params?: Record<string, any>) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    } else {
      console.log('GA Event (Local):', eventName, params);
    }
  };

  // --- EFFECT: LOAD CONFIG FROM SUPABASE ---
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('config')
          .eq('id', 'global')
          .single();

        if (data && data.config) {
          // Merge with default to ensure new fields exist if DB is old
          setConfig(prev => ({ ...DEFAULT_CONFIG, ...data.config }));
        } else if (error && error.code !== 'PGRST116') {
          console.error("Erro ao carregar config:", error);
        }
      } catch (err) {
        console.error("Erro de conexão:", err);
      }
    };
    loadConfig();
  }, []);

  // --- EFFECT: APPLY WHITE LABEL CSS VARIABLES ---
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-color', config.accentColor);
    root.style.setProperty('--accent-glow', `${config.accentColor}80`); // 50% opacity
    root.style.setProperty('--bg-color', config.bgColor);
    root.style.setProperty('--nav-bg', config.navColor);
    
    // Atualiza tema no DOM
    root.setAttribute('data-theme', theme);
  }, [config, theme]);

  // --- EFFECT: FETCH LEADERBOARD ---
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoadingLeaderboard(true);
      
      let query = supabase
        .from('game_scores')
        .select('player_name, company_name, score')
        .order('score', { ascending: false })
        .limit(5);

      if (rankingTab === 'game1') query = query.eq('game_id', 'weed_control');
      else if (rankingTab === 'game2') query = query.eq('game_id', 'memory_map');
      else if (rankingTab === 'game4') query = query.eq('game_id', 'torque_master');
      else if (rankingTab === 'game5') query = query.eq('game_id', 'drone_rush');
      else if (rankingTab === 'game6') query = query.eq('game_id', 'agro_panic');
      else if (rankingTab === 'game8') query = query.eq('game_id', 'variable_rate');

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching leaderboard:', error);
      } else if (data) {
        const formattedData: LeaderboardItem[] = data.map((entry, index) => ({
          rank: index + 1,
          name: entry.player_name,
          score: entry.score,
          unit: entry.company_name || 'Independente',
          medal: index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : undefined
        }));
        setLeaderboardData(formattedData);
      }
      setIsLoadingLeaderboard(false);
    };

    fetchLeaderboard();
  }, [rankingTab]);

  // --- HANDLERS: AUTH & ADMIN ---
  const handleLogin = () => {
    if (loginUser === 'admin' && loginPass === 'qazwsxedc') {
      setIsAdmin(true);
      setShowLoginModal(false);
      setView('admin'); // Go to Admin Dashboard
      setLoginError('');
      setLoginUser('');
      setLoginPass('');
      trackEvent('admin_login_success');
    } else {
      setLoginError('Credenciais Inválidas');
      trackEvent('admin_login_fail');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setView('landing');
  };

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ id: 'global', config: config, updated_at: new Date() });

      if (error) throw error;
      
      alert('Configurações salvas no banco de dados!');
      trackEvent('admin_config_saved');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const resetConfig = async () => {
    if(confirm("Restaurar padrões originais? Isso atualizará o banco de dados.")) {
      setConfig(DEFAULT_CONFIG);
      setIsSavingConfig(true);
      try {
        const { error } = await supabase
          .from('app_config')
          .upsert({ id: 'global', config: DEFAULT_CONFIG, updated_at: new Date() });
        
        if (error) throw error;
        trackEvent('admin_config_reset');
      } catch (error) {
        console.error("Erro ao resetar:", error);
      } finally {
        setIsSavingConfig(false);
      }
    }
  };

  // Helper to update specific game config (Generic Value)
  const updateGameConfig = (gameKey: keyof WhiteLabelConfig['games'], field: keyof GameConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      games: {
        ...prev.games,
        [gameKey]: {
          ...prev.games[gameKey],
          [field]: value
        }
      }
    }));
  };

  // Helper for Image Upload (Base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'hero' | keyof WhiteLabelConfig['games']) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (target === 'hero') {
          setConfig(prev => ({ ...prev, heroImage: base64String }));
        } else {
          // It's a game key
          updateGameConfig(target, 'image', base64String);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // --- HANDLERS: NAVIGATION ---
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  
  const handleStartGame = (gameView: ViewState) => { 
    // GA Tracking for Game Select
    // Find readable title based on viewState
    let gameTitle = gameView;
    // Map internal key to config title
    // @ts-ignore
    if (config.games[gameView]) {
        // @ts-ignore
        gameTitle = config.games[gameView].title;
    }

    trackEvent('select_content', {
      content_type: 'game',
      item_id: gameView,
      item_name: gameTitle
    });

    setView(gameView); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleBackToMenu = () => { 
    trackEvent('navigate_home');
    setView('landing'); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const goToBusiness = () => { 
    // Check if external link is configured
    if (config.footerLinkUrl && config.footerLinkUrl.trim() !== '') {
        window.open(config.footerLinkUrl, '_blank');
        trackEvent('external_link_click', { url: config.footerLinkUrl });
        return;
    }

    trackEvent('business_click', { label: 'B2B Navigation' });
    setView('business'); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const scrollToOperations = () => { 
    trackEvent('hero_cta_click', { label: 'Iniciar Operação' });
    document.getElementById('operations')?.scrollIntoView({ behavior: 'smooth' }); 
  };

  const handleRankingTabChange = (tab: RankTab) => {
    setRankingTab(tab);
    trackEvent('view_item_list', { item_list_name: `ranking_${tab}` });
  };

  return (
    <div className="min-h-screen flex flex-col font-['Montserrat'] overflow-x-hidden bg-[var(--bg-color)] text-[var(--text-color)] transition-colors duration-300 selection:bg-[var(--accent-color)] selection:text-white">
      
      {/* TACTICAL BACKGROUND GRID (Only on public pages) */}
      {view !== 'admin' && (
        <div className="fixed inset-0 z-0 pointer-events-none tactical-grid opacity-30"></div>
      )}
      
      {/* NAVBAR (Hidden on Admin) */}
      {view !== 'admin' && (
        <nav className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-[var(--nav-bg)] backdrop-blur-md border-b border-[var(--card-border)]">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={handleBackToMenu}>
            <div className="w-8 h-8 bg-[var(--accent-color)] skew-x-[-12deg] flex items-center justify-center shadow-[0_0_10px_var(--accent-glow)]">
              <span className="font-tech font-bold text-white skew-x-[12deg] text-lg">A</span>
            </div>
            <span className="font-tech font-bold text-lg tracking-wider text-white uppercase">{config.appName}</span>
          </div>
          
          <div className="flex items-center gap-6">
            {view === 'landing' && (
              <button onClick={goToBusiness} className="hidden md:block text-[var(--text-secondary)] hover:text-white font-medium text-xs uppercase tracking-widest transition-colors">
                Soluções para Empresas
              </button>
            )}
            
            {/* THEME TOGGLE */}
            <button onClick={toggleTheme} className="hidden md:flex items-center gap-2 bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-[var(--accent-color)] text-[var(--text-color)] px-1 py-1 pr-3 rounded-full transition-all group">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-[var(--accent-color)] text-white' : 'bg-gray-200 text-gray-800'}`}>
                  {theme === 'dark' ? '☾' : '☀'}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>

            {/* LOGIN / ADMIN BUTTON */}
            {isAdmin ? (
              <button onClick={() => setView('admin')} className="text-[var(--accent-color)] font-bold text-xs uppercase tracking-widest hover:underline">
                  ADMIN PANEL
              </button>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="text-gray-500 hover:text-white transition-colors" title="Acesso Admin">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
              </button>
            )}

            {view.startsWith('game') && (
              <button onClick={handleBackToMenu} className="text-[var(--accent-color)] font-bold text-xs border border-[var(--accent-color)] px-4 py-2 rounded hover:bg-[var(--accent-color)] hover:text-white transition-colors uppercase">
                Sair
              </button>
            )}
          </div>
        </nav>
      )}

      {/* --- MODAL: LOGIN --- */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111] border border-gray-700 p-8 rounded-lg shadow-2xl w-full max-w-sm relative">
             <button onClick={() => setShowLoginModal(false)} className="absolute top-2 right-4 text-gray-500 hover:text-white text-xl">&times;</button>
             <h2 className="text-2xl font-tech text-white mb-6 uppercase text-center">Acesso Admin</h2>
             {loginError && <p className="text-red-500 text-xs mb-4 text-center">{loginError}</p>}
             <input type="text" placeholder="Usuário" value={loginUser} onChange={e => setLoginUser(e.target.value)} className="w-full bg-black border border-gray-700 text-white p-3 mb-3 rounded focus:border-[var(--accent-color)] outline-none" />
             <input type="password" placeholder="Senha" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full bg-black border border-gray-700 text-white p-3 mb-6 rounded focus:border-[var(--accent-color)] outline-none" />
             <button onClick={handleLogin} className="w-full bg-[var(--accent-color)] text-black font-bold py-3 uppercase tracking-widest hover:brightness-110 transition-all">Entrar</button>
          </div>
        </div>
      )}

      {/* --- VIEW: ADMIN DASHBOARD (FULL SCREEN) --- */}
      {view === 'admin' && (
        <div className="flex h-screen w-full bg-[#050505] overflow-hidden text-white font-mono">
           
           {/* SIDEBAR (High Level) */}
           <aside className="w-64 bg-[#0a0a0a] border-r border-[#222] flex flex-col">
              <div className="p-6 border-b border-[#222]">
                 <div className="text-[var(--accent-color)] font-tech text-xl uppercase tracking-widest mb-1">{config.appName}</div>
                 <div className="text-gray-600 text-xs">Painel Administrativo</div>
              </div>
              
              <nav className="flex-1 p-4 space-y-2">
                 <button onClick={() => setAdminPage('profile')} className={`w-full text-left px-4 py-3 rounded text-sm uppercase tracking-wider transition-colors flex items-center gap-3 ${adminPage === 'profile' ? 'bg-[var(--accent-color)] text-black font-bold' : 'text-gray-400 hover:bg-[#111] hover:text-white'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Perfil
                 </button>
                 <button onClick={() => setAdminPage('whitelabel')} className={`w-full text-left px-4 py-3 rounded text-sm uppercase tracking-wider transition-colors flex items-center gap-3 ${adminPage === 'whitelabel' ? 'bg-[var(--accent-color)] text-black font-bold' : 'text-gray-400 hover:bg-[#111] hover:text-white'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    White Label
                 </button>
              </nav>

              <div className="p-6 border-t border-[#222]">
                 <button onClick={() => setView('landing')} className="w-full border border-gray-600 text-gray-400 hover:text-white hover:border-white px-4 py-2 rounded text-xs uppercase tracking-widest mb-2">
                    Voltar ao App
                 </button>
                 <button onClick={handleLogout} className="w-full text-red-500 hover:text-red-400 text-xs uppercase tracking-widest">
                    Sair
                 </button>
              </div>
           </aside>

           {/* MAIN CONTENT AREA */}
           <main className="flex-1 flex flex-col overflow-hidden relative">
              
              {/* PAGE: PROFILE (PLACEHOLDER) */}
              {adminPage === 'profile' && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#050505]">
                   <div className="text-gray-600 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                   </div>
                   <h2 className="text-2xl font-tech text-white uppercase mb-2">Gerenciamento de Conta</h2>
                   <p className="text-gray-500 max-w-md text-center">
                     Este módulo estará disponível em breve. Você poderá gerenciar usuários, visualizar faturamento e métricas avançadas.
                   </p>
                </div>
              )}

              {/* PAGE: WHITE LABEL CONFIG */}
              {adminPage === 'whitelabel' && (
                <>
                  {/* Internal Header & Tabs */}
                  <header className="bg-[#0a0a0a] border-b border-[#222] px-8 pt-6 pb-0">
                     <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold uppercase text-white">Configuração White Label</h2>
                        <div className="flex gap-3">
                           <button onClick={resetConfig} disabled={isSavingConfig} className="text-xs uppercase text-gray-500 hover:text-white px-4">
                              Restaurar Padrões
                           </button>
                           <button onClick={saveConfig} disabled={isSavingConfig} className="bg-[var(--accent-color)] text-black px-6 py-2 rounded font-bold uppercase text-xs tracking-widest hover:brightness-110 shadow-lg">
                              {isSavingConfig ? 'Salvando...' : 'Salvar Alterações'}
                           </button>
                        </div>
                     </div>
                     
                     {/* Internal Tabs */}
                     <div className="flex space-x-8">
                        {(['branding', 'hero', 'games', 'footer'] as ConfigTab[]).map(tab => (
                          <button 
                            key={tab}
                            onClick={() => setConfigTab(tab)}
                            className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${configTab === tab ? 'border-[var(--accent-color)] text-[var(--accent-color)]' : 'border-transparent text-gray-500 hover:text-white'}`}
                          >
                             {tab === 'branding' ? 'Identidade' : tab === 'hero' ? 'Hero Section' : tab === 'games' ? 'Jogos' : 'Rodapé'}
                          </button>
                        ))}
                     </div>
                  </header>

                  {/* Form Scroll Area */}
                  <div className="flex-1 overflow-y-auto p-8 bg-[#050505] relative">
                     <div className="max-w-6xl mx-auto space-y-8 pb-12">
                        
                        {/* TAB: BRANDING */}
                        {configTab === 'branding' && (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                              <div className="bg-[#111] p-6 rounded border border-[#333]">
                                 <label className="block text-gray-500 text-xs uppercase mb-2">Nome da Aplicação</label>
                                 <input type="text" value={config.appName} onChange={e => setConfig({...config, appName: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-3 rounded focus:border-[var(--accent-color)] outline-none" />
                              </div>
                              
                              <div className="bg-[#111] p-6 rounded border border-[#333]">
                                 <label className="block text-gray-500 text-xs uppercase mb-2">Cor de Destaque (Accent)</label>
                                 <div className="flex gap-2">
                                    <input type="color" value={config.accentColor} onChange={e => setConfig({...config, accentColor: e.target.value})} className="h-12 w-12 bg-transparent border-0 cursor-pointer" />
                                    <input type="text" value={config.accentColor} onChange={e => setConfig({...config, accentColor: e.target.value})} className="flex-1 bg-black border border-gray-700 text-white p-3 rounded outline-none" />
                                 </div>
                              </div>

                              <div className="bg-[#111] p-6 rounded border border-[#333]">
                                 <label className="block text-gray-500 text-xs uppercase mb-2">Cor de Fundo (Background)</label>
                                 <div className="flex gap-2">
                                    <input type="color" value={config.bgColor} onChange={e => setConfig({...config, bgColor: e.target.value})} className="h-12 w-12 bg-transparent border-0 cursor-pointer" />
                                    <input type="text" value={config.bgColor} onChange={e => setConfig({...config, bgColor: e.target.value})} className="flex-1 bg-black border border-gray-700 text-white p-3 rounded outline-none" />
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* TAB: HERO */}
                        {configTab === 'hero' && (
                           <div className="space-y-6 animate-fade-in">
                              <div className="bg-[#111] p-6 rounded border border-[#333]">
                                 <label className="block text-gray-500 text-xs uppercase mb-2">Imagem de Fundo (URL ou Upload)</label>
                                 <div className="flex gap-2 mb-2">
                                    <input type="text" value={config.heroImage} onChange={e => setConfig({...config, heroImage: e.target.value})} className="flex-1 bg-black border border-gray-700 text-white p-3 rounded outline-none" placeholder="https://..." />
                                    <label className="bg-[var(--accent-color)] text-black px-4 py-3 rounded cursor-pointer font-bold uppercase text-xs flex items-center hover:brightness-110">
                                       📁 Upload
                                       <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'hero')} />
                                    </label>
                                 </div>
                                 <img src={config.heroImage} className="w-full h-32 object-cover opacity-50 rounded" alt="Preview" />
                              </div>

                              <div className="bg-[#111] p-6 rounded border border-[#333] space-y-4">
                                 <h3 className="text-white font-bold uppercase text-sm border-b border-gray-700 pb-2">Textos Principais</h3>
                                 
                                 <div className="grid grid-cols-3 gap-4">
                                    <div>
                                       <label className="block text-gray-500 text-xs uppercase mb-1">Linha 1 (Branco)</label>
                                       <input type="text" value={config.heroTitleLine1} onChange={e => setConfig({...config, heroTitleLine1: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-2 rounded" />
                                    </div>
                                    <div>
                                       <label className="block text-[var(--accent-color)] text-xs uppercase mb-1">Linha 2 (Gradiente)</label>
                                       <input type="text" value={config.heroTitleLine2} onChange={e => setConfig({...config, heroTitleLine2: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-2 rounded" />
                                    </div>
                                    <div>
                                       <label className="block text-gray-500 text-xs uppercase mb-1">Linha 3 (Branco Grande)</label>
                                       <input type="text" value={config.heroTitleLine3} onChange={e => setConfig({...config, heroTitleLine3: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-2 rounded" />
                                    </div>
                                 </div>

                                 <div>
                                    <label className="block text-gray-500 text-xs uppercase mb-1">Descrição</label>
                                    <textarea value={config.heroDescription} onChange={e => setConfig({...config, heroDescription: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-2 rounded h-20" />
                                 </div>

                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                       <label className="block text-gray-500 text-xs uppercase mb-1">Tagline (Topo)</label>
                                       <input type="text" value={config.heroTagline} onChange={e => setConfig({...config, heroTagline: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-2 rounded" />
                                    </div>
                                    <div>
                                       <label className="block text-gray-500 text-xs uppercase mb-1">Texto do Botão</label>
                                       <input type="text" value={config.heroButtonText} onChange={e => setConfig({...config, heroButtonText: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-2 rounded" />
                                    </div>
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* TAB: GAMES (REFACTORED LIST VIEW) */}
                        {configTab === 'games' && (
                           <div className="animate-fade-in relative min-h-[500px]">
                              
                              {/* --- LIST HEADER --- */}
                              <div className="grid grid-cols-12 gap-4 mb-3 px-4 py-2 text-xs font-bold uppercase text-gray-500 tracking-widest border-b border-white/10">
                                 <div className="col-span-1 text-center">#</div>
                                 <div className="col-span-6">Configuração do Jogo</div>
                                 <div className="col-span-2 text-center">Status</div>
                                 <div className="col-span-3 text-right">Ações</div>
                              </div>

                              {/* --- GAME LIST ITEMS --- */}
                              <div className="space-y-2">
                                 {Object.entries(config.games).map(([key, val], index) => {
                                    const game = val as GameConfig;
                                    const isActive = game.active !== false; // Default true
                                    const gameKey = key as keyof WhiteLabelConfig['games'];

                                    return (
                                       <div key={key} className={`group bg-[#111] border ${isActive ? 'border-white/5' : 'border-red-900/20'} hover:border-[var(--accent-color)]/30 hover:bg-white/5 rounded-lg p-3 grid grid-cols-12 gap-4 items-center transition-all duration-200`}>
                                          
                                          {/* 1. Drag Handle / Order */}
                                          <div className="col-span-1 flex justify-center text-gray-600 cursor-move hover:text-white">
                                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                          </div>

                                          {/* 2. Game Info (Thumb + Title) */}
                                          <div className="col-span-6 flex items-center gap-4">
                                             <div className="w-12 h-12 bg-black rounded overflow-hidden border border-white/10 shrink-0">
                                                {game.image ? (
                                                   <img src={game.image} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                   <div className="w-full h-full flex items-center justify-center text-xs text-gray-700 font-mono">IMG</div>
                                                )}
                                             </div>
                                             <div>
                                                <div className={`font-bold text-sm ${isActive ? 'text-white' : 'text-gray-500'}`}>{game.title}</div>
                                                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{game.tag}</div>
                                             </div>
                                          </div>

                                          {/* 3. Status Badge */}
                                          <div className="col-span-2 flex justify-center">
                                             <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${isActive ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-red-900/20 text-red-400 border-red-900/50'}`}>
                                                {isActive ? 'Publicado' : 'Oculto'}
                                             </span>
                                          </div>

                                          {/* 4. Actions (Toggle + Edit) */}
                                          <div className="col-span-3 flex items-center justify-end gap-3">
                                             {/* Toggle Switch */}
                                             <button 
                                                onClick={() => updateGameConfig(gameKey, 'active', !isActive)}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${isActive ? 'bg-[var(--accent-color)]' : 'bg-gray-700'}`}
                                             >
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${isActive ? 'left-6' : 'left-1'}`}></div>
                                             </button>

                                             {/* Edit Button */}
                                             <button 
                                                onClick={() => setEditingGameKey(gameKey)}
                                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded text-xs uppercase font-bold tracking-wider border border-white/10 transition-colors"
                                             >
                                                <span>Editar</span>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                             </button>
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>

                              {/* --- EDIT DRAWER (SLIDE-OVER) --- */}
                              <div className={`fixed inset-y-0 right-0 w-[500px] bg-[#0F0F0F] border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${editingGameKey ? 'translate-x-0' : 'translate-x-full'}`}>
                                 
                                 {editingGameKey && (
                                    <>
                                       <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center bg-[#111]">
                                          <div>
                                             <div className="text-[var(--accent-color)] text-xs font-bold uppercase tracking-widest mb-1">Editando Jogo</div>
                                             <h3 className="text-xl font-white font-bold">{config.games[editingGameKey].title}</h3>
                                          </div>
                                          <button onClick={() => setEditingGameKey(null)} className="text-gray-500 hover:text-white transition-colors">
                                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                          </button>
                                       </div>

                                       <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                          {/* Form Content */}
                                          <div>
                                             <label className="block text-gray-500 text-xs uppercase mb-2">Título do Card</label>
                                             <input 
                                                type="text" 
                                                value={config.games[editingGameKey].title} 
                                                onChange={e => updateGameConfig(editingGameKey, 'title', e.target.value)} 
                                                className="w-full bg-black border border-gray-700 text-white p-3 rounded focus:border-[var(--accent-color)] outline-none" 
                                             />
                                          </div>

                                          <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                <label className="block text-gray-500 text-xs uppercase mb-2">Tag (Label)</label>
                                                <input 
                                                   type="text" 
                                                   value={config.games[editingGameKey].tag} 
                                                   onChange={e => updateGameConfig(editingGameKey, 'tag', e.target.value)} 
                                                   className="w-full bg-black border border-gray-700 text-white p-3 rounded focus:border-[var(--accent-color)] outline-none" 
                                                />
                                             </div>
                                             <div>
                                                <label className="block text-gray-500 text-xs uppercase mb-2">Texto do Botão</label>
                                                <input 
                                                   type="text" 
                                                   value={config.games[editingGameKey].buttonText} 
                                                   onChange={e => updateGameConfig(editingGameKey, 'buttonText', e.target.value)} 
                                                   className="w-full bg-black border border-gray-700 text-white p-3 rounded focus:border-[var(--accent-color)] outline-none" 
                                                />
                                             </div>
                                          </div>

                                          <div>
                                             <label className="block text-gray-500 text-xs uppercase mb-2">Descrição Curta</label>
                                             <textarea 
                                                value={config.games[editingGameKey].description} 
                                                onChange={e => updateGameConfig(editingGameKey, 'description', e.target.value)} 
                                                className="w-full bg-black border border-gray-700 text-white p-3 rounded focus:border-[var(--accent-color)] outline-none h-32 resize-none" 
                                             />
                                          </div>

                                          <div>
                                             <label className="block text-gray-500 text-xs uppercase mb-2">Imagem de Capa</label>
                                             <div className="bg-black border border-gray-700 rounded p-4 flex flex-col gap-4">
                                                {config.games[editingGameKey].image ? (
                                                   <img src={config.games[editingGameKey].image} alt="Preview" className="w-full h-40 object-cover rounded border border-white/10" />
                                                ) : (
                                                   <div className="w-full h-40 flex items-center justify-center bg-[#111] text-gray-600 text-xs border border-dashed border-gray-700 rounded">
                                                      Sem imagem definida
                                                   </div>
                                                )}
                                                
                                                <div className="flex gap-2">
                                                   <input 
                                                      type="text" 
                                                      placeholder="URL da Imagem..." 
                                                      value={config.games[editingGameKey].image} 
                                                      onChange={e => updateGameConfig(editingGameKey, 'image', e.target.value)} 
                                                      className="flex-1 bg-[#111] border border-gray-700 text-white p-2 rounded text-xs" 
                                                   />
                                                   <label className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded cursor-pointer text-xs font-bold uppercase flex items-center">
                                                      Upload
                                                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, editingGameKey)} />
                                                   </label>
                                                </div>
                                             </div>
                                          </div>
                                       </div>

                                       <div className="p-6 border-t border-white/10 bg-[#111] flex justify-end gap-3">
                                          <button onClick={() => setEditingGameKey(null)} className="px-6 py-3 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest">
                                             Fechar
                                          </button>
                                          <button onClick={() => { setEditingGameKey(null); saveConfig(); }} className="px-8 py-3 bg-[var(--accent-color)] hover:brightness-110 text-black font-bold uppercase tracking-widest text-xs rounded shadow-lg">
                                             Salvar & Fechar
                                          </button>
                                       </div>
                                    </>
                                 )}
                              </div>

                              {/* --- BACKDROP --- */}
                              {editingGameKey && (
                                 <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40" onClick={() => setEditingGameKey(null)}></div>
                              )}

                           </div>
                        )}

                        {/* TAB: FOOTER */}
                        {configTab === 'footer' && (
                           <div className="bg-[#111] p-6 rounded border border-[#333] space-y-4 animate-fade-in">
                              <div>
                                 <label className="block text-gray-500 text-xs uppercase mb-1">Texto de Copyright</label>
                                 <input type="text" value={config.footerText} onChange={e => setConfig({...config, footerText: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-3 rounded" />
                              </div>
                              <div>
                                 <label className="block text-gray-500 text-xs uppercase mb-1">Texto do Link Comercial</label>
                                 <input type="text" value={config.footerLinkText} onChange={e => setConfig({...config, footerLinkText: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-3 rounded" />
                              </div>
                              <div>
                                 <label className="block text-gray-500 text-xs uppercase mb-1">URL de Redirecionamento (Opcional)</label>
                                 <input type="text" value={config.footerLinkUrl || ''} onChange={e => setConfig({...config, footerLinkUrl: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-3 rounded" placeholder="Ex: https://sua-empresa.com.br (Deixe vazio para usar a página interna)" />
                              </div>
                           </div>
                        )}

                     </div>
                  </div>
                </>
              )}
           </main>
        </div>
      )}


      {/* VIEW: LANDING PAGE */}
      {view === 'landing' && (
        <main className="flex-grow flex flex-col w-full relative z-10">
          
          {/* HERO SECTION */}
          <section className="relative w-full h-[85vh] flex items-center justify-center overflow-hidden border-b border-[var(--card-border)]">
            <div className="absolute inset-0 z-0">
               <img src={config.heroImage} alt="Hero Background" className="w-full h-full object-cover opacity-80" />
               <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-color)] via-[var(--bg-color)]/50 to-transparent"></div>
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--bg-color)_100%)]"></div>
               <div className="absolute inset-0 opacity-10" style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}></div>
            </div>
            
            <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex flex-col items-center text-center mt-10">
              <div className="absolute top-0 left-10 hidden md:block opacity-40 font-mono-hud text-[var(--cyan-accent)] text-xs tracking-widest">
                 SYSTEM_READY<br/>LOC: -23.55, -46.63<br/>TIME: {new Date().toLocaleTimeString()}
              </div>
              <div className="mb-6 animate-enter">
                 <div className="inline-flex items-center gap-3 px-4 py-1 border-x border-[var(--accent-color)] bg-[var(--accent-color)]/10 backdrop-blur-sm">
                    <span className="text-[var(--accent-color)] text-xs font-bold tracking-[0.4em] uppercase font-tech glow-text-orange">{config.heroTagline}</span>
                 </div>
              </div>
              <h1 className="text-5xl md:text-8xl font-black mb-6 uppercase italic tracking-tighter leading-none text-white drop-shadow-2xl animate-enter font-tech" style={{ animationDelay: '0.1s' }}>
                {config.heroTitleLine1} <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-color)] to-yellow-500 glow-text-orange">{config.heroTitleLine2}</span> 
                <span className="text-white text-4xl md:text-7xl block mt-2">{config.heroTitleLine3}</span>
              </h1>
              <p className="text-gray-300 max-w-xl text-lg md:text-xl font-medium mb-12 animate-enter leading-relaxed tracking-wide" style={{ animationDelay: '0.2s' }}>
                {config.heroDescription}
              </p>
              <div className="animate-enter" style={{ animationDelay: '0.3s' }}>
                <button onClick={scrollToOperations} className="px-12 py-5 bg-[var(--accent-color)] hover:bg-[#ff8533] text-white font-tech font-bold text-xl uppercase tracking-widest clip-path-polygon transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,102,0,0.4)] animate-pulse-slow" style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}>
                  {config.heroButtonText}
                </button>
              </div>
            </div>
          </section>

          {/* GAMES GRID */}
          <section id="operations" className="w-full relative z-20 -mt-24 pb-24 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-end justify-between mb-8 px-2">
                   <h2 className="text-white font-tech text-2xl uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 bg-[var(--accent-color)]"></span>Selecione Sua Missão</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                  
                  {/* GAME CARDS ITERATION */}
                  {(['game1', 'game2', 'game4', 'game5', 'game6', 'game8'] as const).map((key) => {
                     const game = config.games[key];
                     // Check Active Status
                     if (game.active === false) return null;

                     // Map key to ViewState
                     const viewState = key as ViewState; 
                     
                     // Colors / Fallback Art Logic based on key
                     const accent = (key === 'game1' || key === 'game4') ? 'var(--accent-color)' : (key === 'game2' ? 'var(--cyan-accent)' : (key === 'game5' || key === 'game8' ? '#00E676' : '#FDD835'));
                     const borderHover = (key === 'game1') ? 'hover:border-[var(--accent-color)]' : (key === 'game2' ? 'hover:border-[var(--cyan-accent)]' : (key === 'game4' ? 'hover:border-[#ff3300]' : (key === 'game5' ? 'hover:border-[#00ff00]' : (key === 'game6' ? 'hover:border-[#FDD835]' : 'hover:border-[#00E676]'))));
                     const btnHover = (key === 'game1') ? 'group-hover:bg-[var(--accent-color)]' : (key === 'game2' ? 'group-hover:bg-[var(--cyan-accent)]' : (key === 'game4' ? 'group-hover:bg-[#ff3300]' : (key === 'game5' ? 'group-hover:bg-[#00ff00]' : (key === 'game6' ? 'group-hover:bg-[#FDD835]' : 'group-hover:bg-[#00E676]'))));
                     
                     return (
                        <div key={key} className={`group relative bg-[#121212] border border-[#333] ${borderHover} transition-all duration-300 hover:-translate-y-2 overflow-hidden h-[400px] flex flex-col`}>
                           <div className="relative h-1/2 bg-[#1a1a1a] overflow-hidden border-b border-[#333] transition-colors">
                              {game.image ? (
                                 <img src={game.image} alt={game.title} className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                 // Fallback CSS Art (Simplified for dynamic loop, kept distinct by key)
                                 <div className="absolute inset-0 opacity-50 flex items-center justify-center">
                                    {key === 'game1' && <div className="w-20 h-20 bg-orange-500/20 rounded-full blur-xl"></div>}
                                    {key === 'game2' && <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/40 via-transparent to-transparent"></div>}
                                    {key === 'game4' && <div className="w-full h-10 bg-red-900/40 absolute bottom-0"></div>}
                                    {key === 'game5' && <div className="w-2 h-2 bg-green-500 animate-ping absolute top-1/2 left-1/2"></div>}
                                    {key === 'game6' && <div className="grid grid-cols-3 gap-1"><div className="w-4 h-4 bg-yellow-500/50"></div></div>}
                                    {key === 'game8' && <div className="w-full h-full bg-gradient-to-tr from-green-900/20 to-transparent"></div>}
                                 </div>
                              )}
                              
                              <div className="absolute top-4 left-0 text-black text-xs font-bold px-3 py-1 font-tech uppercase shadow-lg z-10" style={{ backgroundColor: accent }}>
                                 {game.tag}
                              </div>
                           </div>
                           <div className="p-6 flex flex-col flex-grow relative">
                              <div className="font-mono-hud text-xs mb-2" style={{ color: accent }}>MISSION_0{key.replace('game','')}</div>
                              <h3 className="text-xl font-tech text-white mb-2 uppercase italic leading-tight">{game.title}</h3>
                              <p className="text-gray-500 text-xs mb-6 flex-grow">{game.description}</p>
                              <button onClick={() => handleStartGame(viewState)} className={`w-full py-3 border border-gray-600 ${btnHover} group-hover:text-black text-white font-bold uppercase tracking-widest transition-all text-xs font-tech`}>
                                 {game.buttonText}
                              </button>
                           </div>
                        </div>
                     );
                  })}

                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mt-6">
                  {/* B2B Card */}
                  <div className="relative bg-[#0F0F0F] border border-[#222] overflow-hidden h-[200px] flex flex-row items-center justify-between px-10 group hover:border-white/20 transition-colors">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.02)_10px,rgba(255,255,255,0.02)_11px)]"></div>
                    <div className="relative z-10 flex flex-col items-start">
                       <h3 className="text-2xl font-tech text-white mb-2 uppercase">Sua Marca Aqui</h3>
                       <p className="text-gray-500 text-sm">Transforme seu estande em uma arena. Jogo personalizado para sua empresa.</p>
                    </div>
                    <div className="relative z-10">
                       <button onClick={goToBusiness} className="px-8 py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors text-sm font-tech">Contratar Solução</button>
                    </div>
                  </div>
                </div>
            </div>
          </section>

          {/* RANKING SECTION */}
          <section className="w-full bg-[var(--bg-secondary)] py-20 border-t border-[var(--card-border)] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent-color)] blur-[120px] opacity-10 pointer-events-none"></div>
             <div className="max-w-4xl mx-auto px-6 relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                   <div>
                      <h2 className="text-3xl font-tech text-white uppercase italic tracking-tight"><span className="text-[var(--accent-color)]">///</span> Hall da Fama</h2>
                      <p className="text-gray-500 text-sm font-mono-hud mt-1">TOP OPERADORES :: GLOBAL RANKING</p>
                   </div>
                   <div className="flex bg-black p-1 rounded border border-[#333] flex-wrap gap-1">
                      {(['general', 'game1', 'game2', 'game4', 'game5', 'game6', 'game8'] as RankTab[]).map((tab) => (
                        <button key={tab} onClick={() => handleRankingTabChange(tab)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all font-tech ${rankingTab === tab ? 'bg-[var(--accent-color)] text-black' : 'text-gray-500 hover:text-white'}`}>
                          {tab === 'general' ? 'Geral' : tab === 'game1' ? 'Pulverização' : tab === 'game2' ? 'Navegação' : tab === 'game4' ? 'Motor/Torque' : tab === 'game5' ? 'Voo Drone' : tab === 'game6' ? 'Telemetria' : 'Taxa Variável'}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="bg-[#050505] border border-[#222] rounded overflow-hidden shadow-2xl min-h-[300px] relative">
                   {isLoadingLeaderboard && (<div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center"><span className="text-[var(--accent-color)] font-mono-hud animate-pulse">CARREGANDO DADOS...</span></div>)}
                   <table className="w-full text-left border-collapse">
                      <thead>
                         <tr className="bg-[#111] text-gray-500 text-[10px] uppercase tracking-[0.2em] border-b border-[#222]">
                            <th className="py-4 px-6 font-normal w-16 text-center">#</th>
                            <th className="py-4 px-6 font-normal">Operador</th>
                            <th className="py-4 px-6 font-normal text-right">XP Total</th>
                         </tr>
                      </thead>
                      <tbody className="font-mono-hud text-sm">
                         {leaderboardData.length > 0 ? (
                           leaderboardData.map((player, index) => (
                              <tr key={index} className="border-b border-[#111] hover:bg-[#111] transition-colors group">
                                 <td className="py-4 px-6 text-center">{player.medal ? <span className="text-xl">{player.medal}</span> : <span className="text-gray-600">{String(player.rank).padStart(2, '0')}</span>}</td>
                                 <td className="py-4 px-6">
                                    <div className={`font-bold text-base tracking-wide ${index === 0 ? 'text-[var(--accent-color)] glow-text-orange' : 'text-white'}`}>{player.name}</div>
                                    <div className="text-[10px] text-gray-600 uppercase tracking-widest">{player.unit}</div>
                                 </td>
                                 <td className="py-4 px-6 text-right"><span className={`text-lg ${index < 3 ? 'text-white' : 'text-gray-400'}`}>{player.score.toLocaleString()}</span></td>
                              </tr>
                           ))
                         ) : (
                           <tr><td colSpan={3} className="py-12 text-center text-gray-600">Nenhum registro encontrado. Seja o primeiro a jogar!</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
          </section>
        </main>
      )}

      {/* VIEW: GAMES (Canvas) */}
      {(view.startsWith('game')) && (
        <div className="flex-grow flex flex-col w-full relative animate-enter pt-20 bg-black">
           <main className="w-full flex-grow flex flex-col items-center justify-center p-4 relative overflow-hidden">
             <div className="absolute inset-0 z-0 pointer-events-none tactical-grid opacity-20"></div>
             <div className="relative z-10 w-full flex justify-center">
                 {view === 'game1' && <GameCanvas />}
                 {view === 'game2' && <MemoryMapCanvas />}
                 {view === 'game4' && <TorqueMasterCanvas />}
                 {view === 'game5' && <DroneRushCanvas />}
                 {view === 'game6' && <AgroMonitorPanicCanvas />}
                 {view === 'game8' && <VariableRateMasterCanvas />}
             </div>
           </main>
        </div>
      )}

      {/* Footer */}
      {(view === 'landing' || view === 'business') && (
          <footer className="w-full py-8 bg-black border-t border-[#222] text-center">
            <div className="flex justify-center items-center gap-2 mb-2">
               <span className="font-tech text-lg text-white tracking-widest uppercase">{config.appName}</span>
            </div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-4">{config.footerText}</p>
            <a onClick={goToBusiness} className="cursor-pointer text-gray-500 hover:text-[var(--accent-color)] text-xs uppercase tracking-wider transition-colors border-b border-transparent hover:border-[var(--accent-color)] pb-0.5">{config.footerLinkText}</a>
          </footer>
      )}
    </div>
  );
};

export default App;