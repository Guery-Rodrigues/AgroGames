import React, { useRef, useEffect, useState } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { supabase, ScoreEntry } from '../supabaseClient';

// --- ZzFX Micro-library ---
// @ts-ignore
let zzfxX: AudioContext | null = null;
// @ts-ignore
const zzfx = (...t)=>{let e=zzfxX||new(window.AudioContext||window.webkitAudioContext);zzfxX=e;let s=e.createBufferSource(),r=e.createBuffer(1,t.length,44100);t.map((e,t)=>r.getChannelData(0)[t]=e),s.buffer=r,s.connect(e.destination),s.start()};

// Sounds
const SND_ALARM = [1.05,,366,.03,.27,.29,1,1.52,,,,,,.1,,.1,,.66,.07]; // Alert Siren
const SND_FIX   = [1.4,,1549,.01,.01,.06,,1.6,-9.9,,,,,.1,,.1,,.53,.07]; // Fix Spark
const SND_OVER  = [0.4,,110,.03,.33,.53,4,2.5,-0.6,.2,,,,,1.3,,.2,.16,.71]; // Power Down

const TRACTOR_SIZE = 45; // Slightly bigger for cartoon feel
const MAX_BROKEN = 3;

interface Tractor {
  id: number;
  x: number;
  y: number;
  state: 'WORKING' | 'BROKEN';
  scale: number; // For Pop animation
  timer: number;
  dir: number; // Direction logic (just visual)
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

const FleetMonitorCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // --- UI State ---
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAME_OVER'>('MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Form / Supabase
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [isScoreSaved, setIsScoreSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [highScoresList, setHighScoresList] = useState<ScoreEntry[]>([]);

  // --- Game State (Mutable) ---
  const stateRef = useRef({
    tractors: [] as Tractor[],
    particles: [] as Particle[],
    gameTime: 0,
    difficulty: 1,
    shake: 0,
    gameOver: false,
    scrollOffset: 0
  });

  useEffect(() => {
    const saved = localStorage.getItem('agro_fleet_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const initGame = () => {
    // Grid 4x5
    const cols = 4;
    const rows = 5;
    const padX = (GAME_WIDTH - (cols * TRACTOR_SIZE)) / (cols + 1);
    const padY = (GAME_HEIGHT - 100 - (rows * TRACTOR_SIZE)) / (rows + 1);

    const newTractors: Tractor[] = [];
    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            newTractors.push({
                id: r*cols+c,
                x: padX + c*(TRACTOR_SIZE+padX),
                y: 100 + padY + r*(TRACTOR_SIZE+padY), // Offset for HUD
                state: 'WORKING',
                scale: 1,
                timer: 0,
                dir: r % 2 === 0 ? 1 : -1 // Alternate rows look nice
            });
        }
    }

    stateRef.current = {
      tractors: newTractors,
      particles: [],
      gameTime: 0,
      difficulty: 1,
      shake: 0,
      gameOver: false,
      scrollOffset: 0
    };
    setScore(0);
    setGameState('PLAYING');
    setIsScoreSaved(false);
  };

  const spawnParticles = (x: number, y: number, type: 'SPARK') => {
    const count = 8;
    for(let i=0; i<count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3;
        stateRef.current.particles.push({
            x: x + TRACTOR_SIZE/2,
            y: y + TRACTOR_SIZE/2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: '#00E676', // Green sparks
            size: Math.random() * 4 + 2
        });
    }
  };

  const update = (dt: number) => {
    const s = stateRef.current;
    if (s.gameOver) return;

    s.gameTime += dt;
    s.scrollOffset = (s.scrollOffset + 1) % 40; // Simulate slow movement over field

    // Difficulty Ramp
    if (s.gameTime % 5000 < 20) s.difficulty += 0.1;

    // Random Breakage logic
    // LOWERED CHANCE: Now 0.005 base (was 0.02) to prevent instant overwhelming
    const breakChance = 0.005 * s.difficulty;
    
    if (Math.random() < breakChance) {
        const working = s.tractors.filter(t => t.state === 'WORKING');
        if (working.length > 0) {
            const target = working[Math.floor(Math.random() * working.length)];
            target.state = 'BROKEN';
            target.scale = 1.3; // Alert pop
            s.shake = 5;
            // @ts-ignore
            zzfx(...SND_ALARM);
        }
    }

    // Check Game Over
    const brokenCount = s.tractors.filter(t => t.state === 'BROKEN').length;
    if (brokenCount > MAX_BROKEN) {
        s.gameOver = true;
        setGameState('GAME_OVER');
        s.shake = 30;
        // @ts-ignore
        zzfx(...SND_OVER);
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('agro_fleet_highscore', score.toString());
        }
    }

    // Update Tractors (Animation)
    s.tractors.forEach(t => {
        if (t.scale > 1) t.scale += (1 - t.scale) * 0.1;
    });

    // Update Particles
    for(let i=s.particles.length-1; i>=0; i--){
        const p = s.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if(p.life <= 0) s.particles.splice(i, 1);
    }

    // Shake Decay
    if (s.shake > 0) s.shake *= 0.9;
    if (s.shake < 0.5) s.shake = 0;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // --- 1. Background (Talhão / Crop Field) ---
    // Background Color: Earthy Brown
    ctx.fillStyle = '#6D4C41'; 
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Crop Texture
    // Darker green lines to simulate rows, less intense than before
    ctx.fillStyle = '#33691E'; 
    for(let x = 0; x < GAME_WIDTH; x+=20) {
       // Draw thin vertical lines
       ctx.fillRect(x, 0, 4, GAME_HEIGHT);
    }
    
    // Scrolling effect
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for(let y = s.scrollOffset - 40; y < GAME_HEIGHT; y+=40) {
       ctx.fillRect(0, y, GAME_WIDTH, 2);
    }

    // Shake
    ctx.save();
    if (s.shake > 0) ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);

    // --- 2. Tractors (CARTOON STYLE) ---
    s.tractors.forEach(t => {
        ctx.save();
        ctx.translate(t.x + TRACTOR_SIZE/2, t.y + TRACTOR_SIZE/2);
        ctx.scale(t.scale, t.scale);
        
        // Shadow (Oval)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 5, 25, 20, 0, 0, Math.PI*2);
        ctx.fill();

        // Main Body Color (Yellow/Amber for contrast vs Green field)
        const bodyColor = t.state === 'BROKEN' ? '#78909C' : '#FFC107'; // Grey if broken, Bright Yellow if working
        const strokeColor = '#000000'; // Cartoon Outline
        const wheelColor = '#212121';

        ctx.lineWidth = 2;
        ctx.strokeStyle = strokeColor;
        ctx.lineJoin = 'round';

        // --- Rear Wheels (Big & Round) ---
        ctx.fillStyle = wheelColor;
        // Left
        ctx.beginPath();
        ctx.ellipse(-22, 10, 8, 14, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        // Right
        ctx.beginPath();
        ctx.ellipse(22, 10, 8, 14, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();

        // --- Front Wheels (Small & Round) ---
        // Left
        ctx.beginPath();
        ctx.ellipse(-18, -20, 5, 8, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        // Right
        ctx.beginPath();
        ctx.ellipse(18, -20, 5, 8, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        
        // --- Chassis (Rounded Box) ---
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        // Draw a custom rounded shape for tractor body
        ctx.moveTo(-15, -25);
        ctx.lineTo(15, -25); // Hood front
        ctx.lineTo(18, 0);   // Hood side
        ctx.lineTo(20, 25);  // Rear side
        ctx.lineTo(-20, 25); // Rear side
        ctx.lineTo(-18, 0);  // Hood side
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Engine Details (Vents)
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.rect(-8, -20, 16, 10);
        ctx.fill();

        // --- Cab (Rounded Glass) ---
        ctx.fillStyle = '#4FC3F7'; // Cartoon Blue Glass
        ctx.beginPath();
        ctx.rect(-12, -5, 24, 15);
        ctx.fill();
        ctx.stroke();
        
        // Roof (White cap)
        ctx.fillStyle = '#FFF'; 
        ctx.beginPath();
        ctx.rect(-14, -8, 28, 6);
        ctx.fill();
        ctx.stroke();

        // --- WARNING SIGN (Triângulo Vermelho) ---
        if (t.state === 'BROKEN') {
            const time = Date.now();
            const bounce = Math.sin(time / 100) * 5; // Fast bounce
            
            ctx.translate(0, -40 + bounce); // Float above tractor
            
            // Glow
            ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
            ctx.shadowBlur = 15;

            // Triangle Body
            ctx.fillStyle = '#FF0000'; // Bright Red
            ctx.strokeStyle = '#FFFFFF'; // White border for cartoon look
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.moveTo(0, -20); // Top
            ctx.lineTo(20, 15); // Bottom Right
            ctx.lineTo(-20, 15); // Bottom Left
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Exclamation Mark
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            ctx.fillText('!', 0, 2);
        } 

        ctx.restore();
    });

    // --- 3. Particles ---
    s.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
        // Cartoon outline for particles too? Maybe overkill, kept simple.
    });
    ctx.globalAlpha = 1;

    ctx.restore(); // End Shake
  };

  const handleInput = (e: React.PointerEvent) => {
    if (gameState === 'MENU') {
        initGame();
        return;
    }
    if (gameState === 'GAME_OVER') return;

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check Hits
    const s = stateRef.current;
    let hit = false;
    s.tractors.forEach(t => {
        if (t.state === 'BROKEN') {
            if (x > t.x && x < t.x + TRACTOR_SIZE && y > t.y && y < t.y + TRACTOR_SIZE) {
                // FIX!
                t.state = 'WORKING';
                t.scale = 1.4; // Pop effect
                setScore(prev => prev + 1);
                spawnParticles(t.x, t.y, 'SPARK');
                // @ts-ignore
                zzfx(...SND_FIX);
                hit = true;
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
  }, [gameState]);

  // Supabase
  const fetchHighScores = async () => {
    setIsLoadingRanking(true);
    const { data } = await supabase.from('game_scores').select('*').eq('game_id', 'fleet_monitor').order('score', { ascending: false }).limit(10);
    setHighScoresList(data || []);
    setIsLoadingRanking(false);
  };
  const handleSaveScore = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    await supabase.from('game_scores').insert([{
      game_id: 'fleet_monitor', player_name: formData.name.trim().toUpperCase(), company_name: formData.company.trim().toUpperCase(), phone: formData.phone, score: score
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
       {/* HUD */}
       <div className="w-full flex justify-between items-center mb-2 px-4 py-2 bg-[#1B5E20] border-b-2 border-[#FFC107] rounded-t-lg shadow-lg text-white font-mono-hud" style={{ maxWidth: GAME_WIDTH }}>
         <div>
            <div className="text-[10px] text-green-200 uppercase">REPAROS</div>
            <div className="text-2xl font-bold">{score}</div>
         </div>
         <div className="text-right">
            <div className="text-[10px] text-green-200 uppercase">RECORD</div>
            <div className="text-xl">{highScore}</div>
         </div>
       </div>

       <div className="relative group shadow-[0_0_20px_rgba(0,0,0,0.3)]">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            onPointerDown={handleInput}
            className="bg-[#6D4C41] w-auto h-auto max-h-[70vh] object-contain border-4 border-[#3E2723] shadow-xl touch-none cursor-pointer"
          />

          {gameState === 'MENU' && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-6 text-center animate-fade-in pointer-events-none">
                <h1 className="text-3xl font-black text-[#FFC107] font-tech uppercase mb-2 tracking-widest drop-shadow-md">
                  FROTA EM CAMPO
                </h1>
                <p className="text-gray-200 mb-8 font-mono-hud text-sm bg-black/40 p-2 rounded">
                  Monitore o talhão.<br/>Toque nos tratores com alerta (Triângulo) para corrigir.
                </p>
                <div className="px-6 py-2 bg-[#2E7D32] hover:bg-[#388E3C] text-white font-bold uppercase animate-pulse pointer-events-auto cursor-pointer border border-[#81C784]" onClick={initGame}>
                  INICIAR TURNO
                </div>
             </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
               {!isScoreSaved ? (
                 <div className="w-full max-w-sm flex flex-col justify-center h-full">
                    <h2 className="text-3xl font-black text-red-500 font-tech uppercase mb-1">PARADA TOTAL</h2>
                    <div className="text-5xl font-mono text-white mb-6">{score}</div>
                    
                    <p className="text-gray-400 text-xs mb-4">LOG DE OPERAÇÃO</p>
                    
                    <div className="flex flex-col gap-2 mb-4">
                       <input type="text" name="name" placeholder="OPERADOR" value={formData.name} onChange={handleInputChange} className="bg-gray-900 p-3 rounded text-[#81C784] border border-gray-800 font-mono" />
                       <input type="text" name="company" placeholder="UNIDADE" value={formData.company} onChange={handleInputChange} className="bg-gray-900 p-3 rounded text-[#81C784] border border-gray-800 font-mono" />
                    </div>
                    <button onClick={handleSaveScore} disabled={!formData.name} className="bg-[#2E7D32] p-3 rounded text-white font-bold uppercase mb-2 hover:bg-[#388E3C] transition-colors">UPLOAD DADOS</button>
                    <button onClick={initGame} className="text-gray-500 text-xs uppercase hover:text-white mt-2">NOVO TURNO</button>
                 </div>
               ) : (
                 <div className="w-full h-full flex flex-col">
                    <h3 className="text-[#81C784] font-bold uppercase mb-4 font-tech">RANKING DO TALHÃO</h3>
                    <div className="flex-grow overflow-y-auto mb-4 bg-gray-900 p-2 rounded border border-gray-800">
                       {isLoadingRanking ? <p className="text-[#81C784]">BUSCANDO DADOS...</p> : (
                         <table className="w-full text-left text-xs text-gray-400 font-mono">
                           <tbody>
                             {highScoresList.map((e, i) => (
                               <tr key={i} className="border-b border-gray-800"><td className="py-2">{i+1}. {e.player_name}</td><td className="text-right text-[#81C784]">{e.score}</td></tr>
                             ))}
                           </tbody>
                         </table>
                       )}
                    </div>
                    <button onClick={initGame} className="w-full py-3 bg-white text-black font-bold uppercase font-tech">VOLTAR AO CAMPO</button>
                 </div>
               )}
            </div>
          )}
       </div>
    </div>
  );
};

export default FleetMonitorCanvas;