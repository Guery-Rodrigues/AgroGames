import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { supabase, ScoreEntry } from '../supabaseClient';

// --- ZzFX Micro-library ---
// @ts-ignore
let zzfxX: AudioContext | null = null;
// @ts-ignore
const zzfx = (...t)=>{let e=zzfxX||new(window.AudioContext||window.webkitAudioContext);zzfxX=e;let s=e.createBufferSource(),r=e.createBuffer(1,t.length,44100);t.map((e,t)=>r.getChannelData(0)[t]=e),s.buffer=r,s.connect(e.destination),s.start()};

// Sounds
const SND_CHECK = [1.1,,568,.02,.04,.11,2,2.3,-9.9,.1,,,,.09,,.1,,.76,.06]; // High ping
const SND_WIN   = [1.3,,347,.04,.22,.32,2,1.9,-1.4,,,,,.06,2.2,,.2,.26,.26]; // Success chord
const SND_FAIL  = [1.1,,160,.03,.28,.4,3,2.6,,.3,,,,,1.7,,.2,.19,.59]; // Low buzz

// --- Constants & Types ---
const BLUEPRINT_BG = '#0F172A';
const BLUEPRINT_GRID = 'rgba(56, 189, 248, 0.1)';
const NEON_ORANGE = '#FF6700';
const NEON_BLUE = '#00D4FF';

type GameState = 'PREVIEW' | 'DRAWING' | 'SUCCESS_ANIM' | 'GAME_OVER';

interface Point {
  x: number;
  y: number;
}

interface Vertex extends Point {
  id: number;
  hit: boolean;
  scale: number; // For pulsing animation
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const MemoryMapCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // --- React State (UI) ---
  const [gameState, setGameState] = useState<GameState>('PREVIEW');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(2); // Seconds for preview
  
  // Ranking / Form
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [highScores, setHighScores] = useState<ScoreEntry[]>([]);
  const [isScoreSaved, setIsScoreSaved] = useState(false);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- Mutable Game State (Refs for 60fps loop) ---
  const stateRef = useRef({
    vertices: [] as Vertex[],
    userPath: [] as Point[],
    particles: [] as Particle[],
    nextVertexIndex: 0,
    isDrawing: false,
    fillProgress: 0, // 0 to 1 for success animation
    shake: 0,
  });

  // --- Shape Generation ---
  const generateLevel = useCallback((lvl: number) => {
    const s = stateRef.current;
    s.vertices = [];
    s.userPath = [];
    s.particles = [];
    s.nextVertexIndex = 0;
    s.isDrawing = false;
    s.fillProgress = 0;
    s.shake = 0;

    // Difficulty: More vertices, less time
    const numVertices = Math.min(8, 3 + Math.floor((lvl - 1) / 2)); 
    // const complexity = lvl > 4 ? 'IRREGULAR' : 'REGULAR'; // Logic simplified for now

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const radius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.35;

    // Generate Vertices
    for (let i = 0; i < numVertices; i++) {
      // Add randomness as level increases
      const angleNoise = (lvl > 3) ? (Math.random() - 0.5) * 0.5 : 0;
      const radiusNoise = (lvl > 5) ? (Math.random() - 0.5) * 0.3 : 0;
      
      const angle = (i * 2 * Math.PI) / numVertices - Math.PI / 2 + angleNoise;
      const r = radius * (1 + radiusNoise);

      s.vertices.push({
        id: i,
        x: centerX + Math.cos(angle) * r,
        y: centerY + Math.sin(angle) * r,
        hit: false,
        scale: 1
      });
    }

    // Time scaling: Starts at 3s, drops to 1s
    const newTime = Math.max(1, 3 - (lvl * 0.15));
    setTimeLeft(Math.ceil(newTime));
    setGameState('PREVIEW');

  }, []);

  // --- Init ---
  useEffect(() => {
    generateLevel(1);
    const saved = localStorage.getItem('agro_mapper_highscore');
    // Placeholder for highscore loading if needed locally
  }, [generateLevel]);

  // --- Timer Logic ---
  useEffect(() => {
    let timer: number;
    if (gameState === 'PREVIEW') {
      if (timeLeft > 0) {
        timer = window.setTimeout(() => setTimeLeft(t => t - 1), 1000);
      } else {
        setGameState('DRAWING');
      }
    }
    return () => clearTimeout(timer);
  }, [gameState, timeLeft]);

  // --- Particle System ---
  const spawnParticles = (x: number, y: number, color: string, count: number) => {
    const s = stateRef.current;
    for(let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color
      });
    }
  };

  // --- Input Handling ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (gameState !== 'DRAWING') return;
    const s = stateRef.current;
    
    // Convert Coords
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    s.isDrawing = true;
    s.userPath = [{x, y}];
    checkCollision(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = stateRef.current;
    if (gameState !== 'DRAWING' || !s.isDrawing) return;

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Add point if far enough from last point (Optimization)
    const last = s.userPath[s.userPath.length - 1];
    if (last && ((x-last.x)**2 + (y-last.y)**2 > 25)) {
        s.userPath.push({x, y});
    }

    checkCollision(x, y);
  };

  const handlePointerUp = () => {
    const s = stateRef.current;
    if (gameState !== 'DRAWING' || !s.isDrawing) return;
    s.isDrawing = false;

    // Validation
    // Did we hit all vertices?
    const allHit = s.vertices.every(v => v.hit);
    
    // Check if we closed the loop (hit first one again at the end, or close enough)
    // Simplified: Just check if all vertices were hit in order.
    
    if (allHit) {
        // Success
        setScore(prev => prev + (100 + level * 20));
        setGameState('SUCCESS_ANIM');
        // @ts-ignore
        zzfx(...SND_WIN);
    } else {
        // Fail
        handleFail();
    }
  };

  const checkCollision = (x: number, y: number) => {
    const s = stateRef.current;
    const target = s.vertices[s.nextVertexIndex];
    
    if (!target) return; // All done?

    // Threshold radius
    const dist = Math.sqrt((x - target.x)**2 + (y - target.y)**2);
    
    if (dist < 30) {
       // Hit!
       target.hit = true;
       target.scale = 1.5; // Pulse
       s.nextVertexIndex++;
       
       spawnParticles(target.x, target.y, NEON_BLUE, 10);
       // @ts-ignore
       zzfx(...SND_CHECK);

       // Check if this was the last one and auto-complete? 
       // No, wait for pointer up for better UX or "close loop" requirement.
    }
  };

  const handleFail = () => {
    const s = stateRef.current;
    s.shake = 20;
    // @ts-ignore
    zzfx(...SND_FAIL);
    
    setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
            setGameState('GAME_OVER');
            return 0;
        } else {
            // Retry same level after delay
            setTimeout(() => {
                // Reset current level state
                s.vertices.forEach(v => { v.hit = false; v.scale = 1; });
                s.userPath = [];
                s.nextVertexIndex = 0;
                s.isDrawing = false;
                setGameState('PREVIEW');
                setTimeLeft(2);
            }, 1000);
            return newLives;
        }
    });
  };

  // --- Main Loop (Draw & Logic) ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;

    // 1. Background (Blueprint)
    ctx.fillStyle = BLUEPRINT_BG;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Grid
    ctx.save();
    ctx.strokeStyle = BLUEPRINT_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < GAME_WIDTH; i += 40) { ctx.moveTo(i, 0); ctx.lineTo(i, GAME_HEIGHT); }
    for (let i = 0; i < GAME_HEIGHT; i += 40) { ctx.moveTo(0, i); ctx.lineTo(GAME_WIDTH, i); }
    ctx.stroke();
    ctx.restore();

    // Shake
    ctx.save();
    if (s.shake > 0) {
        ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);
        s.shake *= 0.9;
        if(s.shake < 0.5) s.shake = 0;
    }

    // 2. Target Polygon
    // In Preview: Draw Full Solid Line
    // In Drawing: Draw Faint Guides (Vertices)
    
    if (gameState === 'PREVIEW' || gameState === 'SUCCESS_ANIM') {
        ctx.beginPath();
        if (s.vertices.length > 0) {
            ctx.moveTo(s.vertices[0].x, s.vertices[0].y);
            for (let i = 1; i < s.vertices.length; i++) ctx.lineTo(s.vertices[i].x, s.vertices[i].y);
            ctx.closePath();
        }
        
        ctx.strokeStyle = NEON_BLUE;
        ctx.lineWidth = 4;
        ctx.shadowColor = NEON_BLUE;
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Fill Animation
        if (gameState === 'SUCCESS_ANIM') {
            ctx.fillStyle = `rgba(0, 255, 128, ${s.fillProgress})`; // Green fill
            ctx.fill();
            s.fillProgress += 0.05;
            if (s.fillProgress >= 1) {
                // Transition to next level
                s.fillProgress = 1;
                // We handle the state transition in the loop controller or useEffect ideally, 
                // but here is fine for visual completion check.
            }
        }
    }

    if (gameState === 'DRAWING') {
        // Draw Vertices Points (Guides)
        s.vertices.forEach((v, index) => {
            // Logic: Show next target brighter?
            const isNext = index === s.nextVertexIndex;
            
            ctx.beginPath();
            ctx.arc(v.x, v.y, v.hit ? 8 : 6, 0, Math.PI * 2);
            
            ctx.fillStyle = v.hit ? '#00FF88' : (isNext ? '#FFFFFF' : 'rgba(255,255,255,0.2)');
            ctx.fill();
            
            // Ring
            if (isNext) {
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(v.x, v.y, 12 + Math.sin(Date.now()/200)*3, 0, Math.PI*2);
                ctx.stroke();
            }

            // Scale decay
            if (v.scale > 1) v.scale *= 0.9;
        });
    }

    // 3. User Path (Drawing)
    if (s.userPath.length > 1) {
        ctx.beginPath();
        ctx.moveTo(s.userPath[0].x, s.userPath[0].y);
        for (let i = 1; i < s.userPath.length; i++) ctx.lineTo(s.userPath[i].x, s.userPath[i].y);
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 6;
        ctx.strokeStyle = NEON_ORANGE;
        ctx.shadowColor = NEON_ORANGE;
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // 4. Particles
    s.particles.forEach((p, i) => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
        ctx.fill();
        
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) s.particles.splice(i, 1);
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  // --- Animation Loop ---
  useEffect(() => {
    let lastTime = performance.now();
    const loop = (time: number) => {
        const dt = time - lastTime;
        lastTime = time;

        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) draw(ctx);
        }

        // Logic Check for Animation End
        if (gameState === 'SUCCESS_ANIM' && stateRef.current.fillProgress >= 1) {
             // Delay slightly then next level
             if (stateRef.current.fillProgress === 1) { // Trigger once
                 stateRef.current.fillProgress = 1.1; // Lock
                 setTimeout(() => {
                     setLevel(l => l + 1);
                     generateLevel(level + 1);
                 }, 800);
             }
        }

        requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, level, generateLevel]);


  // --- Supabase / UI Logic (Same as other games) ---
  const fetchHighScores = async () => {
    setIsLoadingRanking(true);
    const { data } = await supabase.from('game_scores').select('*').eq('game_id', 'memory_map').order('score', { ascending: false }).limit(10);
    setHighScores(data || []);
    setIsLoadingRanking(false);
  };

  const handleSaveScore = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    await supabase.from('game_scores').insert([{
      game_id: 'memory_map', player_name: formData.name.trim().toUpperCase(), company_name: formData.company.trim().toUpperCase(), phone: formData.phone, score: score
    }]);
    setIsScoreSaved(true);
    await fetchHighScores();
    setIsSaving(false);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleRetry = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setIsScoreSaved(false);
    generateLevel(1);
  };


  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center">
      
      {/* HUD */}
      <div className="w-full flex justify-between items-center mb-2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-sm text-cyan-400 font-mono-hud shadow-lg" style={{ maxWidth: GAME_WIDTH }}>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">SAT LINK</span>
          <span className="text-xl font-bold">{score}</span>
        </div>
        <div className="flex flex-col items-center">
             <span className="text-[10px] text-slate-500 uppercase">ZONE</span>
             <span className="text-xl font-bold text-white">{level}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500 uppercase">SIGNAL</span>
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`w-2 h-4 rounded-sm ${i < lives ? 'bg-cyan-500 shadow-[0_0_5px_cyan]' : 'bg-slate-800'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="relative group shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="bg-[#0F172A] w-auto h-auto max-h-[70vh] object-contain border border-slate-700 touch-none cursor-crosshair"
        />

        {/* Start Overlay */}
        {gameState === 'PREVIEW' && (
           <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-black/20">
              <div className="text-cyan-400 font-mono-hud text-9xl drop-shadow-[0_0_10px_rgba(0,212,255,0.8)] animate-pulse">
                {timeLeft}
              </div>
              <p className="mt-8 text-white bg-slate-900/80 border border-cyan-500/30 px-6 py-2 rounded text-xs font-tech uppercase tracking-widest backdrop-blur-md">
                 Memorize o Perímetro
              </p>
           </div>
        )}

        {/* Drawing Hint */}
        {gameState === 'DRAWING' && !stateRef.current.isDrawing && (
           <div className="absolute top-10 w-full text-center pointer-events-none animate-bounce">
              <span className="text-orange-500 font-mono-hud text-sm bg-black/60 px-4 py-1 rounded border border-orange-500/50">
                 CONECTE OS PONTOS
              </span>
           </div>
        )}

        {/* GAME OVER FORM */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-[#0f172a]/95 flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
             {!isScoreSaved ? (
                <div className="w-full max-w-sm flex flex-col h-full justify-center">
                   <h2 className="text-2xl font-black text-white mb-1 uppercase font-tech italic text-cyan-400">Sinal Perdido</h2>
                   <p className="text-slate-400 text-xs mb-6 font-mono-hud">DADOS DE TELEMETRIA</p>

                   <div className="text-5xl font-mono text-white mb-8 tracking-tighter">
                     {score} <span className="text-sm text-slate-500">pts</span>
                   </div>

                   <p className="text-white text-xs mb-4 font-bold uppercase tracking-wide">
                     Salve seu desempenho
                   </p>

                   <div className="flex flex-col gap-3 mb-6">
                      <input 
                        type="text" 
                        name="name"
                        placeholder="IDENTIFICAÇÃO (NOME)" 
                        maxLength={15}
                        value={formData.name}
                        onChange={handleInputChange}
                        className="bg-slate-900 border border-slate-700 text-white p-3 text-xs font-mono focus:border-cyan-500 outline-none uppercase"
                      />
                      <input 
                        type="text" 
                        name="company"
                        placeholder="UNIDADE (EMPRESA)" 
                        maxLength={20}
                        value={formData.company}
                        onChange={handleInputChange}
                        className="bg-slate-900 border border-slate-700 text-white p-3 text-xs font-mono focus:border-cyan-500 outline-none uppercase"
                      />
                   </div>

                   <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleSaveScore}
                        disabled={formData.name.length < 3 || isSaving}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 text-xs uppercase tracking-widest font-tech shadow-[0_0_15px_rgba(0,212,255,0.4)] transition-all"
                      >
                        {isSaving ? 'Transmitindo...' : 'Salvar Dados'}
                      </button>
                      
                      <button 
                         onClick={handleRetry}
                         className="w-full text-slate-400 hover:text-white text-xs uppercase tracking-widest py-2"
                      >
                         Reiniciar Sistema
                      </button>
                   </div>
                </div>
             ) : (
                <div className="w-full h-full flex flex-col">
                   <h3 className="text-cyan-400 font-bold uppercase tracking-widest text-xs mb-4 border-b border-slate-800 pb-2 font-tech">Base de Dados Global</h3>
                   
                   <div className="flex-grow overflow-y-auto w-full mb-4 bg-slate-900/50 p-2 border border-slate-800">
                     {isLoadingRanking ? <div className="text-cyan-500 text-xs font-mono p-4">DOWNLOAD EM ANDAMENTO...</div> : (
                      <table className="w-full text-left text-xs font-mono">
                         <tbody>
                            {highScores.map((entry, index) => (
                               <tr key={index} className="border-b border-slate-800 text-slate-300">
                                  <td className="py-2 text-slate-500">{index + 1}.</td>
                                  <td className="py-2"><span className="text-white">{entry.player_name}</span></td>
                                  <td className="py-2 text-right text-cyan-400">{entry.score}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                     )}
                   </div>

                   <button onClick={handleRetry} className="w-full py-3 bg-white text-black font-bold text-xs uppercase tracking-widest font-tech hover:bg-cyan-50">
                     Nova Missão
                   </button>
                </div>
             )}
          </div>
        )}
      </div>
      
      <div className="mt-4 text-center text-slate-500 font-mono-hud text-[10px] uppercase">
         Use o ponteiro para traçar a rota entre os vértices
      </div>
    </div>
  );
};

export default MemoryMapCanvas;