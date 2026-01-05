import React, { useRef, useEffect, useState } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { supabase, ScoreEntry } from '../supabaseClient';

// --- ZzFX Micro-library ---
// @ts-ignore
let zzfxX: AudioContext | null = null;
// @ts-ignore
const zzfx = (...t)=>{let e=zzfxX||new(window.AudioContext||window.webkitAudioContext);zzfxX=e;let s=e.createBufferSource(),r=e.createBuffer(1,t.length,44100);t.map((e,t)=>r.getChannelData(0)[t]=e),s.buffer=r,s.connect(e.destination),s.start()};

// Sounds
const SND_ALARM = [1.1,,385,.03,.28,.36,1,1.57,,,,,,.1,,.1,,.63,.06]; // Low siren
const SND_FIX   = [1.6,,1658,.01,.03,.06,,1.7,-6.2,,,,,.1,,.1,,.56,.06]; // High ping/wrench
const SND_OVER  = [0.4,,110,.03,.33,.53,4,2.5,-0.6,.2,,,,,1.3,,.2,.16,.71]; // Noise fail

// Visual Constants - FARM PALETTE
const COLOR_ROAD = '#5D4037'; // Dirt roads
const COLOR_FIELD_A = '#2E7D32'; // Mature Crop
const COLOR_FIELD_B = '#388E3C'; // Lighter Crop
const COLOR_FIELD_LINES = 'rgba(0,0,0,0.15)'; // Crop rows shadow

const COLOR_TRACTOR_BODY = '#FFC107'; // John Deere Green or Industrial Yellow
const COLOR_TRACTOR_CABIN = '#81D4FA'; // Glass
const COLOR_TIRE = '#212121';
const COLOR_RIM = '#FFECB3';
const COLOR_BROKEN_GLOW = '#FF1744';

interface Tractor {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  state: 'WORKING' | 'BROKEN';
  scale: number; // For Pop animation
  rotation: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

const AgroMonitorPanicCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // --- UI State ---
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAME_OVER'>('MENU');
  const [score, setScore] = useState(0); // Time in seconds
  const [highScore, setHighScore] = useState(0);
  const [brokenCount, setBrokenCount] = useState(0);

  // Form / Supabase
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [isScoreSaved, setIsScoreSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [highScoresList, setHighScoresList] = useState<ScoreEntry[]>([]);

  // --- Mutable Game State ---
  const stateRef = useRef({
    tractors: [] as Tractor[],
    particles: [] as Particle[],
    gameTime: 0,
    accumulator: 0,
    difficultyTimer: 0,
    breakdownTimer: 0,
    breakdownRate: 2000, // ms between potential breakdowns
    shake: 0,
    gameOver: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('agro_panic_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Supabase Logic ---
  const fetchHighScores = async () => {
    setIsLoadingRanking(true);
    const { data } = await supabase.from('game_scores').select('*').eq('game_id', 'agro_panic').order('score', { ascending: false }).limit(10);
    setHighScoresList(data || []);
    setIsLoadingRanking(false);
  };
  const handleSaveScore = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    await supabase.from('game_scores').insert([{
      game_id: 'agro_panic', player_name: formData.name.trim().toUpperCase(), company_name: formData.company.trim().toUpperCase(), phone: formData.phone, score: score
    }]);
    setIsScoreSaved(true);
    await fetchHighScores();
    setIsSaving(false);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Auto-fetch leaderboard on Game Over ---
  useEffect(() => {
    if (gameState === 'GAME_OVER') {
      fetchHighScores();
    }
  }, [gameState]);


  // --- Logic ---
  const initGame = () => {
    // Generate Tractors
    const newTractors: Tractor[] = [];
    // Spaced spawn to avoid overlap initially
    const cols = 3; 
    const rows = 4;
    const cellW = GAME_WIDTH / cols;
    const cellH = GAME_HEIGHT / rows;

    for(let i=0; i<10; i++){
        const c = i % cols;
        const r = Math.floor(i / cols);
        newTractors.push({
            id: i,
            x: c * cellW + cellW/2,
            y: r * cellH + cellH/2,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            width: 40, 
            height: 55, // Aspect ratio of a tractor
            state: 'WORKING',
            scale: 1,
            rotation: Math.random() * Math.PI * 2
        });
    }

    stateRef.current = {
      tractors: newTractors,
      particles: [],
      gameTime: 0,
      accumulator: 0,
      difficultyTimer: 0,
      breakdownTimer: 0,
      breakdownRate: 2000,
      shake: 0,
      gameOver: false
    };
    setScore(0);
    setBrokenCount(0);
    setGameState('PLAYING');
    setIsScoreSaved(false);
  };

  const spawnParticles = (x: number, y: number, type: 'SMOKE' | 'FIX') => {
    const count = type === 'FIX' ? 15 : 1;
    for(let i=0; i<count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = type === 'FIX' ? Math.random() * 3 + 1 : Math.random() * 0.5;
        stateRef.current.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (type === 'SMOKE' ? 1 : 0), // Smoke rises
            life: 1.0,
            color: type === 'FIX' ? '#00E676' : 'rgba(80,80,80,0.6)',
            size: type === 'FIX' ? Math.random() * 3 : Math.random() * 6 + 2
        });
    }
  };

  const update = (dt: number) => {
    const s = stateRef.current;
    if (s.gameOver) return;

    // 1. Timers
    s.gameTime += dt;
    s.difficultyTimer += dt;
    s.breakdownTimer += dt;

    setScore(Math.floor(s.gameTime / 1000));

    // Increase difficulty every 15 seconds
    if (s.difficultyTimer > 15000) {
        s.breakdownRate = Math.max(600, s.breakdownRate - 300); 
        s.difficultyTimer = 0;
    }

    // 2. Breakdown Logic
    if (s.breakdownTimer > s.breakdownRate) {
        const working = s.tractors.filter(t => t.state === 'WORKING');
        if (working.length > 0) {
            const victim = working[Math.floor(Math.random() * working.length)];
            victim.state = 'BROKEN';
            victim.scale = 1.4; // Pop effect
            s.shake = 5;
            // @ts-ignore
            zzfx(...SND_ALARM);
        }
        s.breakdownTimer = 0;
    }

    // Check Game Over
    const currentBroken = s.tractors.filter(t => t.state === 'BROKEN').length;
    setBrokenCount(currentBroken);
    if (currentBroken > 3) {
        s.gameOver = true;
        setGameState('GAME_OVER');
        s.shake = 30;
        // @ts-ignore
        zzfx(...SND_OVER);
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('agro_panic_highscore', score.toString());
        }
    }

    // 3. Update Entities
    s.tractors.forEach(t => {
        // Animation scale decay
        if (t.scale > 1) t.scale += (1 - t.scale) * 0.1;

        if (t.state === 'WORKING') {
            // Move
            t.x += t.vx;
            t.y += t.vy;
            // Bounce bounds
            if (t.x < 30 || t.x > GAME_WIDTH - 30) t.vx *= -1;
            if (t.y < 30 || t.y > GAME_HEIGHT - 30) t.vy *= -1;
            
            // Smooth Rotation towards movement vector
            const targetRot = Math.atan2(t.vy, t.vx) + Math.PI/2;
            // Simple Lerp angle
            let diff = targetRot - t.rotation;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            t.rotation += diff * 0.1;

        } else {
            // Vibrate when broken
            t.x += (Math.random() - 0.5) * 2;
            t.y += (Math.random() - 0.5) * 2;
            // Emit Smoke
            if (Math.random() > 0.85) spawnParticles(t.x, t.y, 'SMOKE');
        }
    });

    // 4. Particles
    for(let i=s.particles.length-1; i>=0; i--){
        const p = s.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        if(p.life <= 0) s.particles.splice(i, 1);
    }

    // 5. Shake Decay
    if (s.shake > 0) s.shake *= 0.9;
    if (s.shake < 0.5) s.shake = 0;
  };

  const drawTractor = (ctx: CanvasRenderingContext2D, t: Tractor) => {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);
      ctx.rotate(t.rotation);

      // --- SHADOW ---
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect(-22, -25, 44, 60, 10);
      ctx.fill();

      // --- IMPLEMENT (Sprayer Arms at back) ---
      // Draw this first so it's under the tractor
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-25, 30);
      ctx.lineTo(25, 30);
      ctx.stroke();

      // --- TIRES ---
      ctx.fillStyle = COLOR_TIRE;
      
      // Rear Tires (Big)
      ctx.beginPath();
      ctx.roundRect(-24, 0, 12, 32, 4); // Left Rear
      ctx.roundRect(12, 0, 12, 32, 4);  // Right Rear
      ctx.fill();
      
      // Front Tires (Small)
      ctx.beginPath();
      ctx.roundRect(-20, -32, 8, 16, 3); // Left Front
      ctx.roundRect(12, -32, 8, 16, 3);  // Right Front
      ctx.fill();

      // --- BODY ---
      const isBroken = t.state === 'BROKEN';
      
      // Flash effect if broken
      let baseColor = COLOR_TRACTOR_BODY;
      if (isBroken && Math.floor(Date.now() / 200) % 2 === 0) {
          baseColor = '#FF8A65'; // Flash Color
          ctx.shadowColor = COLOR_BROKEN_GLOW;
          ctx.shadowBlur = 20;
      } else if (isBroken) {
          ctx.shadowColor = COLOR_BROKEN_GLOW;
          ctx.shadowBlur = 10;
      }

      ctx.fillStyle = baseColor;
      
      // Engine Hood (Front)
      ctx.beginPath();
      ctx.roundRect(-10, -35, 20, 35, 4);
      ctx.fill();
      
      // Engine Vents
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(-6, -25, 12, 2);
      ctx.fillRect(-6, -20, 12, 2);
      ctx.fillRect(-6, -15, 12, 2);

      // Cabin Area (Rear)
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.roundRect(-14, -5, 28, 32, 5);
      ctx.fill();
      ctx.shadowBlur = 0; // Reset glow for inner details

      // Windshield/Glass
      ctx.fillStyle = COLOR_TRACTOR_CABIN;
      ctx.beginPath();
      ctx.roundRect(-11, -2, 22, 18, 2);
      ctx.fill();
      
      // Reflection on glass
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(-11, -2);
      ctx.lineTo(-5, -2);
      ctx.lineTo(-11, 8);
      ctx.fill();

      // Roof
      ctx.fillStyle = '#FFF'; // White roof for heat reflection
      ctx.beginPath();
      ctx.roundRect(-12, 5, 24, 20, 3);
      ctx.fill();

      // Exhaust Pipe (Black dot/line)
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(8, -25, 2, 0, Math.PI*2);
      ctx.fill();

      // --- STATUS ICON (Floating) ---
      if (isBroken) {
          // Keep icon upright regardless of tractor rotation
          ctx.rotate(-t.rotation);
          
          const floatY = Math.sin(Date.now() / 150) * 5;
          ctx.translate(0, -50 + floatY);

          // Triangle
          ctx.fillStyle = COLOR_BROKEN_GLOW;
          ctx.beginPath();
          ctx.moveTo(0, -15);
          ctx.lineTo(15, 10);
          ctx.lineTo(-15, 10);
          ctx.closePath();
          ctx.fill();

          // Exclamation
          ctx.fillStyle = '#FFF';
          ctx.font = 'bold 16px Verdana';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', 0, 2);
      }

      ctx.restore();
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Apply Shake
    ctx.save();
    if (s.shake > 0) ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);

    // --- 1. Background (FARM LAYOUT) ---
    // Fill background with Dirt Road color first
    ctx.fillStyle = COLOR_ROAD;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Define Grid of Fields
    const cols = 2;
    const rows = 3;
    const roadWidth = 20;
    const fieldW = (GAME_WIDTH - (roadWidth * (cols+1))) / cols;
    const fieldH = (GAME_HEIGHT - (roadWidth * (rows+1))) / rows;

    for(let r=0; r<rows; r++) {
        for(let c=0; c<cols; c++) {
            const x = roadWidth + c * (fieldW + roadWidth);
            const y = roadWidth + r * (fieldH + roadWidth);

            // Field Base
            // Alternate shades for "Patchwork" look
            ctx.fillStyle = (r+c)%2 === 0 ? COLOR_FIELD_A : COLOR_FIELD_B;
            
            ctx.save();
            // Create rounded field shape
            ctx.beginPath();
            ctx.roundRect(x, y, fieldW, fieldH, 15);
            ctx.fill();
            ctx.clip(); // Clip drawing to inside this field

            // Texture: Planting Rows (Stripes)
            ctx.fillStyle = COLOR_FIELD_LINES;
            const rowSize = 15;
            // Draw diagonal or vertical lines based on field index
            if ((r+c)%2 === 0) {
                 // Vertical Rows
                 for(let i=0; i<fieldW; i+=rowSize) {
                     ctx.fillRect(x + i, y, 4, fieldH);
                 }
            } else {
                 // Horizontal Rows
                 for(let i=0; i<fieldH; i+=rowSize) {
                     ctx.fillRect(x, y + i, fieldW, 4);
                 }
            }
            ctx.restore();
        }
    }

    // --- 2. Tractors ---
    s.tractors.forEach(t => drawTractor(ctx, t));

    // --- 3. Particles ---
    s.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.restore(); // End Shake

    // --- 4. HUD ---
    // Gradient Bar
    const grad = ctx.createLinearGradient(0,0,0,50);
    grad.addColorStop(0, 'rgba(0,0,0,0.9)');
    grad.addColorStop(1, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, 80);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px "Share Tech Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SAFRA: ${score}s`, 20, 30);
    
    // Status Lights
    ctx.textAlign = 'right';
    const panicLevel = brokenCount > 1 ? (brokenCount > 2 ? 'CRÍTICO' : 'ALERTA') : 'NORMAL';
    const statusColor = panicLevel === 'NORMAL' ? '#00E676' : (panicLevel === 'ALERTA' ? '#FFC107' : '#FF5252');
    
    // Draw Status pill
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(GAME_WIDTH - 140, 10, 130, 30, 15);
    ctx.fill();
    
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(GAME_WIDTH - 120, 25, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowColor = statusColor;
    ctx.shadowBlur = 10;
    ctx.fill(); // Glow
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFF';
    ctx.font = '12px "Montserrat", sans-serif';
    ctx.fillText(`${panicLevel} [${brokenCount}/3]`, GAME_WIDTH - 20, 29);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (gameState !== 'PLAYING') {
        if (gameState === 'MENU' || gameState === 'GAME_OVER') initGame();
        return;
    }

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Hit Test
    stateRef.current.tractors.forEach(t => {
        if (t.state === 'BROKEN') {
            const dist = Math.sqrt((x-t.x)**2 + (y-t.y)**2);
            if (dist < 50) { // Slightly larger hit area for fingers
                // FIX
                t.state = 'WORKING';
                t.scale = 1.3;
                spawnParticles(t.x, t.y, 'FIX');
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
  }, [gameState, brokenCount]);

  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center select-none">
       <div className="relative group shadow-2xl">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            onPointerDown={handlePointerDown}
            className="bg-[#261C15] w-auto h-auto max-h-[70vh] object-contain border-4 border-[#1B5E20] shadow-xl touch-none cursor-pointer"
          />

          {gameState === 'MENU' && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center animate-fade-in pointer-events-none">
                <h1 className="text-3xl font-black text-[#FFC107] font-tech uppercase mb-2 tracking-widest drop-shadow-md">
                  Agro Monitor Panic
                </h1>
                <p className="text-gray-300 mb-8 font-mono-hud text-sm">
                  Monitore a frota via satélite.<br/>Toque nos tratores em <span className="text-red-500 font-bold">PANE</span> para reparar.<br/>3 Quebras = Game Over.
                </p>
                <div className="px-6 py-2 bg-[#2E7D32] text-white font-bold uppercase animate-pulse pointer-events-auto cursor-pointer border border-[#4CAF50]" onClick={initGame}>
                  INICIAR SISTEMA
                </div>
             </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
               {!isScoreSaved ? (
                 <div className="w-full max-w-sm flex flex-col justify-center h-full">
                    <h2 className="text-3xl font-black text-red-500 font-tech uppercase mb-1">COLAPSO DA SAFRA</h2>
                    <div className="text-lg text-gray-400 font-mono">TEMPO OPERACIONAL</div>
                    <div className="text-5xl font-mono text-white mb-6">{score}s</div>
                    
                    <div className="flex flex-col gap-2 mb-4">
                       <input type="text" name="name" placeholder="OPERADOR" value={formData.name} onChange={handleInputChange} className="bg-gray-800 p-3 rounded text-white border border-gray-700 font-mono text-xs uppercase" />
                       <input type="text" name="company" placeholder="UNIDADE" value={formData.company} onChange={handleInputChange} className="bg-gray-800 p-3 rounded text-white border border-gray-700 font-mono text-xs uppercase" />
                    </div>
                    <button onClick={handleSaveScore} disabled={!formData.name} className="bg-[#FFC107] text-black p-3 rounded font-bold uppercase mb-2 hover:bg-yellow-400">Salvar Log</button>
                    <button onClick={initGame} className="text-gray-500 text-xs uppercase hover:text-white mt-2">Reiniciar</button>
                 </div>
               ) : (
                 <div className="w-full h-full flex flex-col">
                    <h3 className="text-[#FFC107] font-bold uppercase mb-4 font-tech">RANKING OPERACIONAL</h3>
                    <div className="flex-grow overflow-y-auto mb-4 bg-gray-900 p-2 rounded border border-gray-800">
                       {isLoadingRanking ? <p className="text-white">Carregando...</p> : (
                         <table className="w-full text-left text-xs text-gray-300 font-mono">
                           <tbody>
                             {highScoresList.map((e, i) => (
                               <tr key={i} className="border-b border-gray-700"><td className="py-2">{i+1}. {e.player_name}</td><td className="text-right text-[#FFC107]">{e.score}s</td></tr>
                             ))}
                           </tbody>
                         </table>
                       )}
                    </div>
                    <button onClick={initGame} className="w-full py-3 bg-white text-black font-bold uppercase font-tech">NOVO TURNO</button>
                 </div>
               )}
            </div>
          )}
       </div>
    </div>
  );
};

export default AgroMonitorPanicCanvas;