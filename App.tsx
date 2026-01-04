import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import MemoryMapCanvas from './components/MemoryMapCanvas';
import TorqueMasterCanvas from './components/TorqueMasterCanvas';
import DroneRushCanvas from './components/DroneRushCanvas';
import AgroMonitorPanicCanvas from './components/AgroMonitorPanicCanvas';
import VariableRateMasterCanvas from './components/VariableRateMasterCanvas';
import { supabase } from './supabaseClient';

// --- TYPES ---
type ViewState = 'landing' | 'game1' | 'game2' | 'game4' | 'game5' | 'game6' | 'game8' | 'business';
type Theme = 'dark' | 'light';
type RankTab = 'general' | 'game1' | 'game2' | 'game4' | 'game5' | 'game6' | 'game8';

interface LeaderboardItem {
  rank: number;
  name: string;
  score: number;
  unit: string;
  medal?: string;
}

// --- WHITE LABEL CONFIG TYPE ---
interface WhiteLabelConfig {
  appName: string;
  accentColor: string;
  bgColor: string;
  navColor: string;
  heroImage: string;
  gameImages: {
    game1: string;
    game2: string;
    game4: string;
    game5: string;
    game6: string;
    game8: string;
  };
}

const DEFAULT_CONFIG: WhiteLabelConfig = {
  appName: "AGRO ARCADE",
  accentColor: "#FF6600",
  bgColor: "#050505",
  navColor: "rgba(5, 5, 5, 0.85)",
  heroImage: "https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?q=80&w=1600",
  gameImages: {
    game1: "", // Weed Control (Empty = Use CSS Art)
    game2: "", // Memory Map
    game4: "", // Torque Master
    game5: "", // Drone Rush
    game6: "", // Agro Panic
    game8: ""  // Variable Rate
  }
};

const App: React.FC = () => {
  // --- STATE: NAVIGATION & THEME ---
  const [view, setView] = useState<ViewState>('landing');
  const [theme, setTheme] = useState<Theme>('dark');
  
  // --- STATE: RANKING ---
  const [rankingTab, setRankingTab] = useState<RankTab>('general');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // --- STATE: ADMIN & WHITE LABEL ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  // Configurações visuais (Inicia com padrão, depois carrega do banco)
  const [config, setConfig] = useState<WhiteLabelConfig>(DEFAULT_CONFIG);

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
          setConfig(data.config);
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
      setShowAdminPanel(true);
      setLoginError('');
      setLoginUser('');
      setLoginPass('');
    } else {
      setLoginError('Credenciais Inválidas');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setShowAdminPanel(false);
  };

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ id: 'global', config: config, updated_at: new Date() });

      if (error) throw error;
      
      setShowAdminPanel(false);
      alert('Configurações salvas no banco de dados!');
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
      } catch (error) {
        console.error("Erro ao resetar:", error);
      } finally {
        setIsSavingConfig(false);
      }
    }
  };

  const handleImageChange = (key: keyof WhiteLabelConfig['gameImages'], value: string) => {
    setConfig(prev => ({
      ...prev,
      gameImages: { ...prev.gameImages, [key]: value }
    }));
  };

  // --- HANDLERS: NAVIGATION ---
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const handleStartGame = (gameView: ViewState) => { setView(gameView); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleBackToMenu = () => { setView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const goToBusiness = () => { setView('business'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const scrollToOperations = () => { document.getElementById('operations')?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <div className="min-h-screen flex flex-col font-['Montserrat'] overflow-x-hidden bg-[var(--bg-color)] text-[var(--text-color)] transition-colors duration-300 selection:bg-[var(--accent-color)] selection:text-white">
      
      {/* TACTICAL BACKGROUND GRID */}
      <div className="fixed inset-0 z-0 pointer-events-none tactical-grid opacity-30"></div>
      
      {/* NAVBAR */}
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
             <button onClick={() => setShowAdminPanel(true)} className="text-[var(--accent-color)] font-bold text-xs uppercase tracking-widest hover:underline">
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

      {/* --- MODAL: ADMIN PANEL (WHITE LABEL) --- */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-[#111] border border-gray-700 w-full max-w-4xl rounded-lg shadow-2xl relative flex flex-col max-h-[90vh]">
             {/* Header */}
             <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#0a0a0a]">
                <h2 className="text-2xl font-tech text-[var(--accent-color)] uppercase">Configuração White Label</h2>
                <div className="flex gap-4">
                  <button onClick={handleLogout} className="text-red-500 text-xs font-bold uppercase hover:underline">Logout</button>
                  <button onClick={() => setShowAdminPanel(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
             </div>

             {/* Content */}
             <div className="p-8 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* COLUMN 1: GLOBAL SETTINGS */}
                <div className="space-y-6">
                   <h3 className="text-white font-bold border-b border-gray-700 pb-2 uppercase text-sm tracking-widest">Identidade Visual</h3>
                   
                   <div>
                      <label className="block text-gray-400 text-xs uppercase mb-1">Nome da Aplicação</label>
                      <input type="text" value={config.appName} onChange={e => setConfig({...config, appName: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-2 rounded" />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-400 text-xs uppercase mb-1">Cor de Destaque (Accent)</label>
                        <div className="flex gap-2">
                           <input type="color" value={config.accentColor} onChange={e => setConfig({...config, accentColor: e.target.value})} className="h-10 w-10 bg-transparent border-0 cursor-pointer" />
                           <input type="text" value={config.accentColor} onChange={e => setConfig({...config, accentColor: e.target.value})} className="flex-1 bg-black border border-gray-700 text-white p-2 rounded text-xs" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-400 text-xs uppercase mb-1">Cor de Fundo (Background)</label>
                        <div className="flex gap-2">
                           <input type="color" value={config.bgColor} onChange={e => setConfig({...config, bgColor: e.target.value})} className="h-10 w-10 bg-transparent border-0 cursor-pointer" />
                           <input type="text" value={config.bgColor} onChange={e => setConfig({...config, bgColor: e.target.value})} className="flex-1 bg-black border border-gray-700 text-white p-2 rounded text-xs" />
                        </div>
                      </div>
                   </div>

                   <div>
                      <label className="block text-gray-400 text-xs uppercase mb-1">Hero Image URL (Home)</label>
                      <input type="text" value={config.heroImage} onChange={e => setConfig({...config, heroImage: e.target.value})} className="w-full bg-black border border-gray-700 text-white p-2 rounded text-xs" />
                      <div className="mt-2 h-20 w-full overflow-hidden rounded border border-gray-800">
                         <img src={config.heroImage} alt="Hero Preview" className="w-full h-full object-cover opacity-50" />
                      </div>
                   </div>
                </div>

                {/* COLUMN 2: GAME IMAGES */}
                <div className="space-y-4">
                   <h3 className="text-white font-bold border-b border-gray-700 pb-2 uppercase text-sm tracking-widest">Imagens dos Jogos (URL)</h3>
                   
                   {[
                     { k: 'game1', l: 'Pulverização de Precisão' },
                     { k: 'game2', l: 'Navegação Tática' },
                     { k: 'game4', l: 'Gestão de Potência' },
                     { k: 'game5', l: 'Voo de Monitoramento' },
                     { k: 'game6', l: 'Telemetria de Frota' },
                     { k: 'game8', l: 'Taxa Variável Inteligente' },
                   ].map(item => (
                     <div key={item.k}>
                        <label className="block text-gray-400 text-[10px] uppercase mb-1">{item.l}</label>
                        <input 
                          type="text" 
                          placeholder="Cole a URL da imagem aqui"
                          value={config.gameImages[item.k as keyof WhiteLabelConfig['gameImages']]} 
                          onChange={e => handleImageChange(item.k as keyof WhiteLabelConfig['gameImages'], e.target.value)} 
                          className="w-full bg-black border border-gray-700 text-white p-2 rounded text-xs focus:border-[var(--accent-color)]" 
                        />
                     </div>
                   ))}
                </div>
             </div>

             {/* Footer Actions */}
             <div className="p-6 border-t border-gray-800 bg-[#0a0a0a] flex justify-between items-center">
                <button onClick={resetConfig} className="text-gray-500 text-xs uppercase hover:text-white" disabled={isSavingConfig}>
                  {isSavingConfig ? 'Restaurando...' : 'Restaurar Padrões'}
                </button>
                <div className="flex gap-4">
                   <button onClick={() => setShowAdminPanel(false)} className="text-white text-xs uppercase tracking-widest px-4 py-2 hover:bg-gray-800 rounded">Cancelar</button>
                   <button onClick={saveConfig} disabled={isSavingConfig} className="bg-[var(--accent-color)] text-black font-bold uppercase tracking-widest px-6 py-2 rounded shadow-lg hover:brightness-110 disabled:opacity-50">
                     {isSavingConfig ? 'Salvando...' : 'Salvar Alterações'}
                   </button>
                </div>
             </div>
          </div>
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
                    <span className="text-[var(--accent-color)] text-xs font-bold tracking-[0.4em] uppercase font-tech glow-text-orange">Season 01 &bull; Active</span>
                 </div>
              </div>
              <h1 className="text-5xl md:text-8xl font-black mb-6 uppercase italic tracking-tighter leading-none text-white drop-shadow-2xl animate-enter font-tech" style={{ animationDelay: '0.1s' }}>
                Domine a <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-color)] to-yellow-500 glow-text-orange">Tecnologia</span> <span className="text-white text-4xl md:text-7xl block mt-2">Do Campo</span>
              </h1>
              <p className="text-gray-300 max-w-xl text-lg md:text-xl font-medium mb-12 animate-enter leading-relaxed tracking-wide" style={{ animationDelay: '0.2s' }}>
                Teste seus reflexos e estratégia.<br/> <span className="text-[var(--cyan-accent)]">A operação começa agora.</span>
              </p>
              <div className="animate-enter" style={{ animationDelay: '0.3s' }}>
                <button onClick={scrollToOperations} className="px-12 py-5 bg-[var(--accent-color)] hover:bg-[#ff8533] text-white font-tech font-bold text-xl uppercase tracking-widest clip-path-polygon transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,102,0,0.4)] animate-pulse-slow" style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}>[ Iniciar Operação ]</button>
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
                  
                  {/* CARD 1: Weed Control */}
                  <div className="group relative bg-[#121212] border border-[#333] hover:border-[var(--accent-color)] transition-all duration-300 hover:-translate-y-2 overflow-hidden h-[400px] flex flex-col">
                    <div className="relative h-1/2 bg-[#4E342E] overflow-hidden border-b border-[#333] group-hover:border-[var(--accent-color)] transition-colors">
                       {/* Config Image Override */}
                       {config.gameImages.game1 ? (
                          <img src={config.gameImages.game1} alt="Weed Control" className="absolute inset-0 w-full h-full object-cover" />
                       ) : (
                         <>
                           <div className="absolute inset-0" style={{background: 'repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0,0,0,0.2) 40px, rgba(0,0,0,0.2) 44px)'}}></div>
                           <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-10 h-14 bg-[#FF6F00] shadow-[0_10px_20px_rgba(0,0,0,0.5)] rounded-sm flex flex-col items-center">
                              <div className="w-8 h-4 bg-sky-300 mt-2 rounded-sm opacity-80"></div>
                              <div className="w-full h-1 bg-black/20 mt-1"></div>
                           </div>
                         </>
                       )}
                       <div className="absolute top-4 left-0 bg-[var(--accent-color)] text-black text-xs font-bold px-3 py-1 font-tech uppercase shadow-lg z-10">⚡ Reflexo Rápido</div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow relative">
                       <div className="font-mono-hud text-[var(--accent-color)] text-xs mb-2">MISSION_01</div>
                       <h3 className="text-xl font-tech text-white mb-2 uppercase italic">PULVERIZAÇÃO DE PRECISÃO</h3>
                       <p className="text-gray-500 text-xs mb-6 flex-grow">Identifique e elimine invasoras em alta velocidade. Aplique o defensivo apenas onde é necessário e evite desperdícios.</p>
                       <button onClick={() => handleStartGame('game1')} className="w-full py-3 border border-gray-600 group-hover:bg-[var(--accent-color)] group-hover:text-black text-white font-bold uppercase tracking-widest transition-all text-xs font-tech">Jogar Agora</button>
                    </div>
                  </div>

                  {/* CARD 2: Memory Map */}
                  <div className="group relative bg-[#121212] border border-[#333] hover:border-[var(--cyan-accent)] transition-all duration-300 hover:-translate-y-2 overflow-hidden h-[400px] flex flex-col">
                    <div className="relative h-1/2 bg-[#0F172A] overflow-hidden border-b border-[#333] group-hover:border-[var(--cyan-accent)] transition-colors">
                       {config.gameImages.game2 ? (
                          <img src={config.gameImages.game2} alt="Memory Map" className="absolute inset-0 w-full h-full object-cover" />
                       ) : (
                         <>
                           <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-cyan-500/30 rounded-full flex items-center justify-center">
                              <div className="w-full h-[1px] bg-cyan-500/50 rotate-45"></div>
                              <div className="w-full h-[1px] bg-cyan-500/50 -rotate-45"></div>
                           </div>
                         </>
                       )}
                       <div className="absolute top-4 left-0 bg-[var(--cyan-accent)] text-black text-xs font-bold px-3 py-1 font-tech uppercase shadow-lg z-10">🧠 Memória & Lógica</div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow relative">
                       <div className="font-mono-hud text-[var(--cyan-accent)] text-xs mb-2">MISSION_02</div>
                       <h3 className="text-xl font-tech text-white mb-2 uppercase italic">NAVEGAÇÃO TÁTICA</h3>
                       <p className="text-gray-500 text-xs mb-6 flex-grow">O piloto automático desligou. Memorize o traçado do talhão e execute a linha de plantio perfeita sem sobreposição.</p>
                       <button onClick={() => handleStartGame('game2')} className="w-full py-3 border border-gray-600 group-hover:bg-[var(--cyan-accent)] group-hover:text-black text-white font-bold uppercase tracking-widest transition-all text-xs font-tech">Jogar Agora</button>
                    </div>
                  </div>

                  {/* CARD 3: Torque Master */}
                  <div className="group relative bg-[#1a0500] border border-[#441000] hover:border-[#ff3300] transition-all duration-300 hover:-translate-y-2 overflow-hidden h-[400px] flex flex-col">
                    <div className="relative h-1/2 bg-gradient-to-b from-sky-400 to-orange-200 overflow-hidden border-b border-[#441000] group-hover:border-[#ff3300] transition-colors">
                       {config.gameImages.game4 ? (
                          <img src={config.gameImages.game4} alt="Torque Master" className="absolute inset-0 w-full h-full object-cover" />
                       ) : (
                         <>
                           <div className="absolute bottom-0 w-full h-8 bg-[#558B2F] border-t-4 border-[#33691E]"></div>
                           <div className="absolute bottom-6 right-10 w-10 h-10 bg-black/10 rounded-full blur-sm"></div>
                           <div className="absolute bottom-4 right-12">
                              <div className="w-12 h-8 bg-[#D32F2F] rounded-t-lg relative">
                                 <div className="absolute -top-3 right-2 w-1 h-3 bg-black"></div>
                                 <div className="absolute bottom-0 -left-2 w-8 h-8 bg-[#212121] rounded-full border-2 border-yellow-400"></div>
                                 <div className="absolute bottom-0 -right-1 w-5 h-5 bg-[#212121] rounded-full border-2 border-yellow-400"></div>
                              </div>
                           </div>
                         </>
                       )}
                       <div className="absolute top-4 left-0 bg-[#ff3300] text-black text-xs font-bold px-3 py-1 font-tech uppercase shadow-lg z-10">⚙️ Controle de Motor</div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow relative">
                       <div className="font-mono-hud text-[#ff3300] text-xs mb-2">MISSION_03</div>
                       <h3 className="text-xl font-tech text-white mb-2 uppercase italic">GESTÃO DE POTÊNCIA</h3>
                       <p className="text-gray-500 text-xs mb-6 flex-grow">Desafio de terreno. Mantenha o motor na faixa verde de RPM e controle o torque para vencer a inclinação sem patinar.</p>
                       <button onClick={() => handleStartGame('game4')} className="w-full py-3 border border-gray-600 group-hover:bg-[#ff3300] group-hover:text-black text-white font-bold uppercase tracking-widest transition-all text-xs font-tech">Acelerar</button>
                    </div>
                  </div>

                  {/* CARD 4: Drone Rush */}
                  <div className="group relative bg-[#001a00] border border-[#004400] hover:border-[#00ff00] transition-all duration-300 hover:-translate-y-2 overflow-hidden h-[400px] flex flex-col">
                    <div className="relative h-1/2 bg-[#2E7D32] overflow-hidden border-b border-[#004400] group-hover:border-[#00ff00] transition-colors">
                       {config.gameImages.game5 ? (
                          <img src={config.gameImages.game5} alt="Drone Rush" className="absolute inset-0 w-full h-full object-cover" />
                       ) : (
                         <>
                           <div className="absolute inset-0" style={{background: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(0,0,0,0.1) 20px)'}}></div>
                           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded shadow-lg flex items-center justify-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full z-10 animate-pulse"></div>
                           </div>
                         </>
                       )}
                       <div className="absolute top-4 left-0 bg-[#00ff00] text-black text-xs font-bold px-3 py-1 font-tech uppercase shadow-lg z-10">🕹️ Pilotagem Remota</div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow relative">
                       <div className="font-mono-hud text-[#00ff00] text-xs mb-2">MISSION_04</div>
                       <h3 className="text-xl font-tech text-white mb-2 uppercase italic">VOO DE MONITORAMENTO</h3>
                       <p className="text-gray-500 text-xs mb-6 flex-grow">Decole o VANT. Desvie de árvores e obstáculos físicos para mapear os focos de infestação na lavoura.</p>
                       <button onClick={() => handleStartGame('game5')} className="w-full py-3 border border-gray-600 group-hover:bg-[#00ff00] group-hover:text-black text-white font-bold uppercase tracking-widest transition-all text-xs font-tech">Iniciar Voo</button>
                    </div>
                  </div>

                  {/* CARD 5: AGRO PANIC */}
                  <div className="group relative bg-[#0F2011] border border-[#1B5E20] hover:border-[#FDD835] transition-all duration-300 hover:-translate-y-2 overflow-hidden h-[400px] flex flex-col">
                    <div className="relative h-1/2 bg-[#261C15] overflow-hidden border-b border-[#1B5E20] group-hover:border-[#FDD835] transition-colors p-4">
                       {config.gameImages.game6 ? (
                          <img src={config.gameImages.game6} alt="Agro Panic" className="absolute inset-0 w-full h-full object-cover" />
                       ) : (
                         <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full w-full opacity-80">
                            <div className="bg-[#FFC107] rounded-sm border border-yellow-600 flex items-center justify-center"><div className="w-2 h-2 bg-black rounded-full"></div></div>
                            <div className="bg-[#FFC107] rounded-sm border border-yellow-600 flex items-center justify-center"><div className="w-2 h-2 bg-black rounded-full"></div></div>
                            <div className="bg-[#FF1744] rounded-sm border border-red-600 animate-pulse flex items-center justify-center shadow-[0_0_10px_red]"><span className="text-[8px] font-bold text-white">!</span></div>
                            <div className="bg-[#FFC107] rounded-sm border border-yellow-600 flex items-center justify-center"><div className="w-2 h-2 bg-black rounded-full"></div></div>
                            <div className="bg-[#FFC107] rounded-sm border border-yellow-600 flex items-center justify-center"><div className="w-2 h-2 bg-black rounded-full"></div></div>
                            <div className="bg-[#FFC107] rounded-sm border border-yellow-600 flex items-center justify-center"><div className="w-2 h-2 bg-black rounded-full"></div></div>
                         </div>
                       )}
                       <div className="absolute top-4 left-0 bg-[#FDD835] text-black text-xs font-bold px-3 py-1 font-tech uppercase shadow-lg z-10">📡 Gestão de Crise</div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow relative">
                       <div className="font-mono-hud text-[#FDD835] text-xs mb-2">MISSION_05</div>
                       <h3 className="text-xl font-tech text-white mb-2 uppercase italic">TELEMETRIA DE FROTA</h3>
                       <p className="text-gray-500 text-xs mb-6 flex-grow">Você é a Torre de Controle. Identifique alertas críticos nas máquinas via satélite e evite a parada da operação.</p>
                       <button onClick={() => handleStartGame('game6')} className="w-full py-3 border border-gray-600 group-hover:bg-[#FDD835] group-hover:text-black text-white font-bold uppercase tracking-widest transition-all text-xs font-tech">Monitorar</button>
                    </div>
                  </div>

                  {/* CARD 6: VARIABLE RATE MASTER */}
                  <div className="group relative bg-[#1A1A1A] border border-[#333] hover:border-[#00E676] transition-all duration-300 hover:-translate-y-2 overflow-hidden h-[400px] flex flex-col">
                    <div className="relative h-1/2 bg-[#212121] overflow-hidden border-b border-[#333] group-hover:border-[#00E676] transition-colors">
                       {config.gameImages.game8 ? (
                          <img src={config.gameImages.game8} alt="Variable Rate" className="absolute inset-0 w-full h-full object-cover" />
                       ) : (
                         <>
                           <div className="absolute top-0 left-0 w-full h-1/3 bg-[#FDD835]/40 border-b border-white/5"></div>
                           <div className="absolute top-1/3 left-0 w-full h-1/3 bg-[#FB8C00]/40 border-b border-white/5"></div>
                           <div className="absolute bottom-0 left-0 w-full h-1/3 bg-[#E53935]/40"></div>
                           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-2 bg-[#37474F] shadow-lg flex justify-between px-1">
                              <div className="w-1 h-2 bg-white/50"></div><div className="w-1 h-2 bg-white/50"></div><div className="w-1 h-2 bg-white/50"></div>
                           </div>
                           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-20 bg-[#00E676]/20 blur-sm"></div>
                         </>
                       )}
                       <div className="absolute top-4 left-0 bg-[#00E676] text-black text-xs font-bold px-3 py-1 font-tech uppercase shadow-[0_0_15px_rgba(0,230,118,0.4)] z-10">🎯 Prescrição de Insumos</div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow relative">
                       <div className="font-mono-hud text-[#00E676] text-xs mb-2">MISSION_06</div>
                       <h3 className="text-xl font-tech text-white mb-2 uppercase italic">TAXA VARIÁVEL INTELIGENTE</h3>
                       <p className="text-gray-500 text-xs mb-6 flex-grow">Analise o mapa de produtividade em tempo real. Ajuste a dosagem exata de adubo para cada mancha de solo.</p>
                       <button onClick={() => handleStartGame('game8')} className="w-full py-3 border border-gray-600 group-hover:bg-[#00E676] group-hover:text-black text-white font-bold uppercase tracking-widest transition-all text-xs font-tech">Iniciar Aplicação</button>
                    </div>
                  </div>

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
                        <button key={tab} onClick={() => setRankingTab(tab)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all font-tech ${rankingTab === tab ? 'bg-[var(--accent-color)] text-black' : 'text-gray-500 hover:text-white'}`}>
                          {tab === 'general' ? 'Geral' : tab === 'game1' ? 'Daninhas' : tab === 'game2' ? 'Mapas' : tab === 'game4' ? 'Torque' : tab === 'game5' ? 'Drone' : tab === 'game6' ? 'Monitor' : 'V. Rate'}
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
            <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-4">&copy; 2024 {config.appName}</p>
            <a onClick={goToBusiness} className="cursor-pointer text-gray-500 hover:text-[var(--accent-color)] text-xs uppercase tracking-wider transition-colors border-b border-transparent hover:border-[var(--accent-color)] pb-0.5">Área Comercial / Contrate para Eventos</a>
          </footer>
      )}
    </div>
  );
};

export default App;