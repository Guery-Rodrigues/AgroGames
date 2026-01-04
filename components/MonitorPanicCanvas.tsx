import React, { useRef, useEffect, useState } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { supabase, ScoreEntry } from '../supabaseClient';

// --- ZzFX Micro-library ---
// @ts-ignore
let zzfxX: AudioContext | null = null;
// @ts-ignore
const zzfx = (...t)=>{let e=zzfxX||new(window.AudioContext||window.webkitAudioContext);zzfxX=e;let s=e.createBufferSource(),r=e.createBuffer(1,t.length,44100);t.map((e,t)=>r.getChannelData(0)[t]=e),s.buffer=r,s.connect(e.destination),s.start()};

// Sounds
const SND_ALARM  = [1.5,,481,.03,.43,.37,2,1.35,3.2,,,,,1.1,,.1,.08,.71,.05]; // Beep
const SND_FIX    = [1.1,,1000,.01,.03,.08,,1.6,-9.9,,,,,.1,,.1,,.53,.07]; // Click/Fix
const SND_FAIL   = [0.8,,133,.03,.33,.53,4,2.5,-0.6,.2,,,,,1.3,,.2,.16,.71]; // Fail

// --- STRICT PALETTE ---
const COLOR_BG_SOIL     = '#261C15'; // Deep Coffee
const COLOR_GRID        = 'rgba(76, 175, 80, 0.2)'; // Tech Green
const COLOR_TRACTOR     = '#FFC107'; // Amber 500
const COLOR_CABIN       = '#B3E5FC'; // Light Blue Glass
const COLOR_WHEELS      = '#212121'; // Matte Black
const COLOR_ALERT       = '#FF1744'; // Neon Red
const COLOR_UI_GRAD_A   = '#1B5E20';
const COLOR_UI_GRAD_B   = '#2E7D32';

const PANIC_MAX = 100;
const INITIAL_SPAWN_RATE = 2000; // ms
const MIN_SPAWN_RATE = 400; // ms
const RATE_DECREASE = 50; // ms per fix

interface Module {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  state: 'NORMAL' | 'WARNING' | 'CRITICAL';
  timer: number; // Time spent in broken state
  scale: number; // For breathing animation
  repairFlash: number; // White flash alpha
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  type: 'SMOKE' | 'SPARK' | 'FIX';
}

const MonitorPanicCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // UI State
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAME_OVER'>('MENU');
  const [score, setScore] = useState(0);
  const [panic, setPanic] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Supabase / Form
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [isScoreSaved, setIsScoreSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [highScoresList, setHighScoresList] = useState<ScoreEntry[]>([]);

  // Mutable Game State
  const stateRef = useRef({
    modules: [] as Module[],
    particles: [] as Particle[],
    gameTime: 0,
    nextFailureTime: 0, // Timer for next break
    currentSpawnRate: INITIAL_SPAWN_RATE,
    shake: 0,
    redFlash: 0, // Game Over flash
    gameOver: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('agro_monitor_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Particle System ---
  const spawnParticles = (x: number, y: number, type: 'SMOKE' | 'FIX') => {
      const s = stateRef.current;
      const count = type === 'FIX' ? 12 : 1;
      
      for(let i=0; i<count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = type === 'FIX' ? 2 + Math.random() * 3 : 0.5 + Math.random();
          
          s.particles.push({
              x: x,
              y: y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              color: type === 'FIX' 
                ? (Math.random() > 0.5 ? '#FFFFFF' : '#4CAF50') 
                : '#90A4AE',
              size: type === 'FIX' ? 2 + Math.random()*2 : 4 + Math.random()*4,
              type: type === 'FIX' ? 'FIX' : 'SMOKE'
          });
      }
  };

  // --- Game Init ---
  const initGame = () => {
    // Grid Layout: 2 Columns, 3 Rows
    const cols = 2;
    const rows = 3;
    const padding = 25;
    const topOffset = 90; // Space for UI
    
    const w = (GAME_WIDTH - (padding * (cols + 1))) / cols;
    const h = (GAME_HEIGHT - topOffset - (padding * (rows + 1))) / rows;
    
    const labels = ["SETOR ALPHA", "SETOR BRAVO", "SETOR CHARLIE", "SETOR DELTA", "SETOR ECHO", "SETOR FOXTROT"];
    const mods: Module[] = [];
    
    for(let r=0; r<rows; r++) {
      for(let c=0; c<cols; c++) {
        mods.push({
          id: r*cols + c,
          x: padding + c*(w+padding),
          y: topOffset + r*(h+padding),
          width: w,
          height: h,
          label: labels[r*cols + c],
          state: 'NORMAL',
          timer: 0,
          scale: 1.0,
          repairFlash: 0
        });
      }
    }

    stateRef.current = {
      modules: mods,
      particles: [],
      gameTime: 0,
      nextFailureTime: 0, // Trigger immediately
      currentSpawnRate: INITIAL_SPAWN_RATE,
      shake: 0,
      redFlash: 0,
      gameOver: false
    };

    setScore(0);
    setPanic(0);
    setGameState('PLAYING');
    setIsScoreSaved(false);

    // FORCE IMMEDIATE ERROR START
    triggerFailure(mods);
  };

  const triggerFailure = (modules: Module[]) => {
      const normalMods = modules.filter(m => m.state === 'NORMAL');
      if (normalMods.length > 0) {
          const target = normalMods[Math.floor(Math.random() * normalMods.length)];
          target.state = 'WARNING';
          target.timer = 0;
          // @ts-ignore
          zzfx(...SND_ALARM);
      }
  };

  const update = (dt: number) => {
     const s = stateRef.current;
     if (s.gameOver) return;

     s.gameTime += dt;

     // 1. Spawning Logic (Deterministic Timer)
     s.nextFailureTime -= dt;
     if (s.nextFailureTime <= 0) {
         triggerFailure(s.modules);
         s.nextFailureTime = s.currentSpawnRate; // Reset timer
     }

     // 2. Module Updates
     let panicIncrease = 0;
     
     s.modules.forEach(m => {
        // Repair Flash Decay
        if (m.repairFlash > 0) m.repairFlash -= 0.1;

        // Animations & Logic for Broken States
        if (m.state !== 'NORMAL') {
            // Pulse Animation (Sine wave)
            const pulseSpeed = m.state === 'CRITICAL' ? 0.02 : 0.01;
            m.scale = 1.0 + Math.sin(Date.now() * pulseSpeed) * 0.05;

            // Timer increments
            m.timer += dt;

            // Particles
            if (Math.random() > 0.9) {
                spawnParticles(m.x + m.width/2, m.y + m.height/2, 'SMOKE');
            }

            // State Transition: Warning -> Critical (3 seconds)
            if (m.state === 'WARNING' && m.timer > 3000) {
                m.state = 'CRITICAL';
                m.timer = 0;
                s.shake = 5;
            }

            // Panic Increase (Faster if critical)
            const damage = m.state === 'CRITICAL' ? 0.1 : 0.03;
            panicIncrease += damage;
        } else {
            // Smooth return to scale 1
            if (m.scale > 1) m.scale += (1 - m.scale) * 0.2;
        }
     });

     // 3. Particles Physics
     for (let i = s.particles.length - 1; i >= 0; i--) {
         const p = s.particles[i];
         p.x += p.vx;
         p.y += p.vy;
         p.life -= 0.03;
         if (p.type === 'SMOKE') p.y -= 1; // Smoke rises
         if (p.life <= 0) s.particles.splice(i, 1);
     }

     // 4. Panic Bar Logic
     let newPanic = panic + panicIncrease;
     if (panicIncrease === 0 && newPanic > 0) newPanic -= 0.05; // Cooldown if all safe
     
     if (newPanic >= PANIC_MAX) {
         newPanic = PANIC_MAX;
         s.gameOver = true;
         s.redFlash = 1.0;
         setGameState('GAME_OVER');
         s.shake = 30;
         // @ts-ignore
         zzfx(...SND_FAIL);
         if (score > highScore) {
             setHighScore(score);
             localStorage.setItem('agro_monitor_highscore', score.toString());
         }
     }
     setPanic(newPanic);

     // 5. Screen Shake Decay
     if (s.shake > 0) s.shake *= 0.9;
     if (s.shake < 0.5) s.shake = 0;
  };

  const drawTractor = (ctx: CanvasRenderingContext2D, m: Module) => {
      const cx = m.x + m.width/2;
      const cy = m.y + m.height/2 + 10; // Slightly lower to fit label

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(m.scale, m.scale);

      // --- 1. SHADOW (Depth) ---
      // This is crucial for the "pop" effect
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.roundRect(-25, -20, 50, 50, 10); // Shadow shape
      ctx.fill();
      ctx.shadowBlur = 0; // Reset for next draws

      // --- 2. WHEELS (Behind body) ---
      ctx.fillStyle = COLOR_WHEELS;
      // Left Wheel
      ctx.beginPath(); 
      ctx.roundRect(-40, -5, 12, 30, 4); 
      ctx.fill();
      // Right Wheel
      ctx.beginPath(); 
      ctx.roundRect(28, -5, 12, 30, 4); 
      ctx.fill();

      // --- 3. BODY (Main) ---
      // Dynamic color based on state
      let bodyColor = COLOR_TRACTOR;
      let glowColor = 'transparent';
      
      if (m.state !== 'NORMAL') {
           // Flash Red
           const t = Date.now();
           if (Math.floor(t / 200) % 2 === 0) {
               bodyColor = '#FF8A65'; // Lighter orange/red
               glowColor = COLOR_ALERT;
           } else {
               bodyColor = COLOR_ALERT;
           }
      }
      
      // Glow effect for broken state
      if (m.state !== 'NORMAL') {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 20;
      }

      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      // Main Chassis
      ctx.roundRect(-28, -30, 56, 60, 8);
      ctx.fill();
      ctx.shadowBlur = 0; // Reset glow

      // Engine vents details
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(-15, 10, 30, 10);

      // --- 4. CABIN (Glass) ---
      ctx.fillStyle = COLOR_CABIN;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-20, -20, 40, 25, 6);
      ctx.fill();
      ctx.stroke();

      // --- 5. ALERT ICON (Floating) ---
      if (m.state !== 'NORMAL') {
          const floatY = Math.sin(Date.now() / 150) * 5;
          ctx.translate(0, -55 + floatY);
          
          // Triangle Background
          ctx.fillStyle = COLOR_ALERT;
          ctx.beginPath();
          ctx.moveTo(0, -15);
          ctx.lineTo(15, 10);
          ctx.lineTo(-15, 10);
          ctx.closePath();
          ctx.fill();

          // Exclamation Mark
          ctx.fillStyle = '#FFF';
          ctx.font = 'bold 16px Verdana';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', 0, 0);
      }

      // --- 6. REPAIR FLASH ---
      if (m.repairFlash > 0) {
          ctx.globalAlpha = m.repairFlash;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.roundRect(-30, -35, 60, 70, 10);
          ctx.fill();
          ctx.globalAlpha = 1.0;
      }

      ctx.restore();
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // --- 1. Background (Deep Soil) ---
    ctx.fillStyle = COLOR_BG_SOIL;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // --- 2. Tech Grid ---
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Vertical
    for(let x=0; x<=GAME_WIDTH; x+=40) {
        ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT);
    }
    // Horizontal
    for(let y=0; y<=GAME_HEIGHT; y+=40) {
        ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y);
    }
    ctx.stroke();

    // Shake transform
    ctx.save();
    if (s.shake > 0) {
        ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);
    }

    // --- 3. Modules (Tractors) ---
    s.modules.forEach(m => {
        // Zone Boundary
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 2;
        ctx.strokeRect(m.x, m.y, m.width, m.height);

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m.label, m.x + m.width/2, m.y + 20);

        // Draw Logic
        drawTractor(ctx, m);
    });

    // --- 4. Particles ---
    s.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.type === 'FIX') {
             ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        } else {
             // Smoke is square
             ctx.rect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
        }
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    ctx.restore(); // End Shake

    // --- 5. UI Header (Gradient Bar) ---
    const grad = ctx.createLinearGradient(0, 0, GAME_WIDTH, 0);
    grad.addColorStop(0, COLOR_UI_GRAD_A);
    grad.addColorStop(1, COLOR_UI_GRAD_B);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, 70);
    
    // Panic Meter Background
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.roundRect(20, 25, GAME_WIDTH - 40, 20, 10);
    ctx.fill();

    // Panic Meter Fill
    const panicWidth = Math.min(1, panic / PANIC_MAX) * (GAME_WIDTH - 44);
    
    // Meter Color (Green -> Yellow -> Red)
    let meterColor = '#4CAF50';
    if (panic > 50) meterColor = '#FFC107';
    if (panic > 80) meterColor = '#FF1744';

    ctx.fillStyle = meterColor;
    ctx.shadowColor = meterColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(22, 27, panicWidth, 16, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // UI Text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`PÂNICO: ${Math.floor(panic)}%`, 25, 18);
    
    ctx.textAlign = 'right';
    ctx.fillText(`REPAROS: ${score}`, GAME_WIDTH - 25, 18);

    // --- 6. Red Flash (Game Over) ---
    if (s.redFlash > 0) {
        ctx.fillStyle = `rgba(255, 23, 68, ${s.redFlash * 0.4})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        s.redFlash -= 0.05;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
     if (gameState !== 'PLAYING') {
         if (gameState === 'MENU' || (gameState === 'GAME_OVER' && score === 0)) {
            initGame();
         }
         return;
     }

     if (!canvasRef.current) return;
     const rect = canvasRef.current.getBoundingClientRect();
     const scaleX = GAME_WIDTH / rect.width;
     const scaleY = GAME_HEIGHT / rect.height;
     const x = (e.clientX - rect.left) * scaleX;
     const y = (e.clientY - rect.top) * scaleY;

     const s = stateRef.current;
     
     s.modules.forEach(m => {
        // Hitbox check
        if (x >= m.x && x <= m.x + m.width && y >= m.y && y <= m.y + m.height) {
            if (m.state !== 'NORMAL') {
                // REPAIR SUCCESS
                m.state = 'NORMAL';
                m.timer = 0;
                m.repairFlash = 1.0; 
                
                spawnParticles(m.x + m.width/2, m.y + m.height/2, 'FIX');
                
                setScore(prev => prev + 1);
                setPanic(p => Math.max(0, p - 10)); // Heal panic
                
                // DIFFICULTY RAMP
                // Decrease spawn time, clamp at MIN_SPAWN_RATE
                s.currentSpawnRate = Math.max(MIN_SPAWN_RATE, s.currentSpawnRate - RATE_DECREASE);

                // @ts-ignore
                zzfx(...SND_FIX);
            }
        }
     });
  };

  // --- Loop ---
  useEffect(() => {
    let lastTime = performance.now();
    let accumulator = 0;
    const step = 1000/60;

    const loop = (time: number) => {
        const dt = time - lastTime;
        lastTime = time;
        accumulator += dt;

        while (accumulator >= step) {
            if (gameState === 'PLAYING') update(step);
            accumulator -= step;
        }

        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) draw(ctx);
        }
        requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, panic]);

  // --- Supabase ---
  const fetchHighScores = async () => {
    setIsLoadingRanking(true);
    const { data } = await supabase.from('game_scores').select('*').eq('game_id', 'monitor_panic').order('score', { ascending: false }).limit(10);
    setHighScoresList(data || []);
    setIsLoadingRanking(false);
  };
  const handleSaveScore = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    await supabase.from('game_scores').insert([{
      game_id: 'monitor_panic', player_name: formData.name.trim().toUpperCase(), company_name: formData.company.trim().toUpperCase(), phone: formData.phone, score: score
    }]);
    setIsScoreSaved(true);
    await fetchHighScores();
    setIsSaving(false);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center select-none">
       {/* Canvas Container */}
       <div className="relative group shadow-2xl">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            onPointerDown={handlePointerDown}
            className="bg-[#261C15] w-auto h-auto max-h-[70vh] object-contain border-4 border-[#3E2723] shadow-xl touch-none cursor-pointer"
          />

          {gameState === 'MENU' && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center animate-fade-in pointer-events-none">
                <h1 className="text-3xl font-black text-[#FFC107] font-tech uppercase mb-2" style={{textShadow: '0 0 10px #FFC107'}}>
                  Central de Monitoramento
                </h1>
                <p className="text-gray-300 mb-8 font-mono-hud text-sm">
                  Supervisione a frota em tempo real.<br/>Toque nos tratores com <span className="text-red-500 font-bold">ALERTA</span> para reparar.
                </p>
                <div className="px-6 py-2 bg-[#2E7D32] text-white font-bold uppercase animate-pulse pointer-events-auto cursor-pointer border border-[#4CAF50]" onClick={initGame}>
                  Conectar Satélite
                </div>
             </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
               {!isScoreSaved ? (
                 <div className="w-full max-w-sm flex flex-col justify-center h-full">
                    <h2 className="text-3xl font-black text-red-500 font-tech uppercase mb-1">SISTEMA CRÍTICO</h2>
                    <div className="text-5xl font-mono text-white mb-6">{score}</div>
                    
                    <p className="text-gray-400 text-xs mb-4 uppercase">Relatório de Turno</p>
                    
                    <div className="flex flex-col gap-2 mb-4">
                       <input type="text" name="name" placeholder="OPERADOR" value={formData.name} onChange={handleInputChange} className="bg-gray-800 p-3 rounded text-white border border-gray-700 font-mono text-xs uppercase" />
                       <input type="text" name="company" placeholder="UNIDADE" value={formData.company} onChange={handleInputChange} className="bg-gray-800 p-3 rounded text-white border border-gray-700 font-mono text-xs uppercase" />
                    </div>
                    <button onClick={handleSaveScore} disabled={!formData.name} className="bg-[#FFC107] hover:bg-[#FFD54F] text-black p-3 rounded font-bold uppercase mb-2 font-tech">Arquivar Dados</button>
                    <button onClick={initGame} className="text-gray-500 text-xs uppercase hover:text-white mt-2">Reiniciar Sistema</button>
                 </div>
               ) : (
                 <div className="w-full h-full flex flex-col">
                    <h3 className="text-[#FFC107] font-bold uppercase mb-4 font-tech">Melhores Operadores</h3>
                    <div className="flex-grow overflow-y-auto mb-4 bg-gray-900 p-2 rounded border border-gray-800">
                       {isLoadingRanking ? <p className="text-white">Carregando...</p> : (
                         <table className="w-full text-left text-xs text-gray-300 font-mono">
                           <tbody>
                             {highScoresList.map((e, i) => (
                               <tr key={i} className="border-b border-gray-700"><td className="py-2">{i+1}. {e.player_name}</td><td className="text-right text-[#FFC107]">{e.score}</td></tr>
                             ))}
                           </tbody>
                         </table>
                       )}
                    </div>
                    <button onClick={initGame} className="w-full py-3 bg-white text-black font-bold uppercase font-tech hover:bg-gray-200">Novo Monitoramento</button>
                 </div>
               )}
            </div>
          )}
       </div>
    </div>
  );
};

export default MonitorPanicCanvas;