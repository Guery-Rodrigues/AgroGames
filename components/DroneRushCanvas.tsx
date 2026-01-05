import React, { useRef, useEffect, useState } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { supabase } from '../supabaseClient';

// --- ZzFX Micro-library ---
// @ts-ignore
let zzfxX: AudioContext | null = null;
// @ts-ignore
const zzfx = (...t)=>{let e=zzfxX||new(window.AudioContext||window.webkitAudioContext);zzfxX=e;let s=e.createBufferSource(),r=e.createBuffer(1,t.length,44100);t.map((e,t)=>r.getChannelData(0)[t]=e),s.buffer=r,s.connect(e.destination),s.start()};

// Sounds
const SND_SPRAY = [0.5,,377,.03,.06,.23,3,1.69,-6.4,,,,,.6,,.5,,.63,.06]; // Hiss noise (White Noise)
const SND_SCORE = [1.1,,663,.02,.05,.12,1,1.93,6.2,,,,,.06,,.1,,.67,.09]; // Ding (High Pitch)
const SND_CRASH = [1.8,,232,.04,.19,.53,4,2.26,-0.5,.5,,,,,1.2,,.2,.16,.74]; // Boom (Explosion)

// --- Constants ---
const DRONE_SIZE = 50;
const SCROLL_SPEED_BASE = 5; // A little faster for rush feel
const SPAWN_RATE = 60; // Frames

interface Drone {
  x: number;
  y: number;
  width: number;
  height: number;
  tilt: number; // Visual rotation based on movement
}

interface GameObject {
  id: number;
  type: 'PEST' | 'TREE' | 'POLE';
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
  cured?: boolean; // For pests
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

const DroneRushCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // --- UI State ---
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAME_OVER'>('MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [difficulty, setDifficulty] = useState(1);

  // Form / Supabase
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [isScoreSaved, setIsScoreSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [highScoresList, setHighScoresList] = useState<{player_name: string, score: number}[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);

  // --- Game State (Mutable) ---
  const stateRef = useRef({
    drone: { x: GAME_WIDTH/2, y: GAME_HEIGHT - 120, width: DRONE_SIZE, height: DRONE_SIZE, tilt: 0 } as Drone,
    objects: [] as GameObject[],
    particles: [] as Particle[],
    inputX: GAME_WIDTH / 2,
    scrollSpeed: SCROLL_SPEED_BASE,
    scrollOffset: 0,
    spawnTimer: 0,
    difficultyTimer: 0,
    shake: 0,
    lastSprayTime: 0,
    gameOver: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('agro_drone_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Supabase Logic ---
  const fetchHighScores = async () => {
    setIsLoadingRanking(true);
    // @ts-ignore
    const { data } = await supabase.from('game_scores').select('*').eq('game_id', 'drone_rush').order('score', { ascending: false }).limit(10);
    setHighScoresList(data || []);
    setIsLoadingRanking(false);
  };
  
  const handleSaveScore = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    // @ts-ignore
    await supabase.from('game_scores').insert([{
      game_id: 'drone_rush', 
      player_name: formData.name.trim().toUpperCase(), 
      company_name: formData.company.trim().toUpperCase(), 
      phone: formData.phone, 
      score: score
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
    stateRef.current = {
      drone: { x: GAME_WIDTH/2, y: GAME_HEIGHT - 120, width: DRONE_SIZE, height: DRONE_SIZE, tilt: 0 },
      objects: [],
      particles: [],
      inputX: GAME_WIDTH / 2,
      scrollSpeed: SCROLL_SPEED_BASE,
      scrollOffset: 0,
      spawnTimer: 0,
      difficultyTimer: 0,
      shake: 0,
      lastSprayTime: 0,
      gameOver: false
    };
    setScore(0);
    setDifficulty(1);
    setGameState('PLAYING');
    setIsScoreSaved(false);
    setFormData({ name: '', company: '', phone: '' });
  };

  const spawnParticles = (x: number, y: number, type: 'SPRAY' | 'EXPLOSION') => {
    const count = type === 'SPRAY' ? 4 : 20;
    const color = type === 'SPRAY' ? 'rgba(200, 240, 255, 0.8)' : '#FF4400';
    
    for(let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (type === 'SPRAY' ? 2 : 6);
      stateRef.current.particles.push({
        x: x + (Math.random()-0.5)*20,
        y: y + (Math.random()-0.5)*20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (type === 'SPRAY' ? 3 : 0), // Spray falls down relative to drone
        life: 1.0,
        color: color,
        size: Math.random() * 3 + 1
      });
    }
  };

  const update = (dt: number) => {
    const s = stateRef.current;
    if (s.gameOver) return;

    // 1. Difficulty Ramp (5% every 10s)
    s.difficultyTimer += dt;
    if (s.difficultyTimer > 10000) {
      s.scrollSpeed *= 1.05;
      s.difficultyTimer = 0;
      setDifficulty(prev => prev + 1);
    }

    // 2. Drone Movement (Snappy 1:1 Feel)
    const targetX = Math.max(DRONE_SIZE/2 + 5, Math.min(GAME_WIDTH - DRONE_SIZE/2 - 5, s.inputX));
    const dx = targetX - s.drone.x;
    s.drone.x += dx * 0.3; 
    s.drone.tilt = -dx * 0.8; // Tilt based on velocity

    // 3. Scroll & Spawn
    s.scrollOffset = (s.scrollOffset + s.scrollSpeed) % 100; // For background loop
    s.spawnTimer++;
    
    // Spawn rate increases with difficulty (capped)
    const currentSpawnRate = Math.max(25, SPAWN_RATE - Math.floor(difficulty * 2.5));

    if (s.spawnTimer > currentSpawnRate) {
      const typeRand = Math.random();
      let type: 'PEST' | 'TREE' | 'POLE' = 'PEST';
      
      const obstacleChance = Math.min(0.5, 0.2 + (difficulty * 0.02));
      
      if (typeRand < obstacleChance) {
          type = Math.random() > 0.5 ? 'TREE' : 'POLE';
      } else {
          type = 'PEST';
      }

      const size = type === 'PEST' ? 40 : (type === 'TREE' ? 55 : 25);
      
      s.objects.push({
        id: Math.random(),
        type,
        x: Math.random() * (GAME_WIDTH - size - 20) + size/2 + 10,
        y: -100,
        width: size,
        height: size,
        active: true,
        cured: false
      });
      s.spawnTimer = 0;
    }

    // 4. Update Objects & Collision
    for (let i = s.objects.length - 1; i >= 0; i--) {
      const obj = s.objects[i];
      obj.y += s.scrollSpeed;

      // Clean up
      if (obj.y > GAME_HEIGHT + 50) {
        s.objects.splice(i, 1);
        continue;
      }

      // Collision Detection (Circle-Circle approx)
      const distSq = (s.drone.x - obj.x)**2 + (s.drone.y - obj.y)**2;
      const hitRadius = (s.drone.width/2 + obj.width/2) * 0.75; // Forgiving hitbox

      if (distSq < hitRadius**2) {
        if (obj.type === 'PEST') {
          // Spraying!
          if (!obj.cured) {
            obj.cured = true;
            setScore(prev => prev + 10);
            spawnParticles(obj.x, obj.y, 'SPRAY');
            // @ts-ignore
            zzfx(...SND_SCORE);
          }
          // Continuous spray visual if hovering
          if (performance.now() - s.lastSprayTime > 80) {
             spawnParticles(s.drone.x, s.drone.y + 20, 'SPRAY');
             // @ts-ignore
             zzfx(...SND_SPRAY);
             s.lastSprayTime = performance.now();
          }
        } else {
          // Crash!
          if (!s.gameOver) {
              s.gameOver = true;
              s.shake = 25;
              setGameState('GAME_OVER');
              spawnParticles(s.drone.x, s.drone.y, 'EXPLOSION');
              // @ts-ignore
              zzfx(...SND_CRASH);
              
              if (score > highScore) {
                setHighScore(score);
                localStorage.setItem('agro_drone_highscore', score.toString());
              }
          }
        }
      }
    }

    // 5. Particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    // 6. Shake Decay
    if (s.shake > 0) s.shake *= 0.9;
    if (s.shake < 0.5) s.shake = 0;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    
    // Clear
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Apply Shake
    ctx.save();
    if (s.shake > 0) {
      ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);
    }

    // 1. Background (Crop Fields)
    const stripeWidth = 80;
    for (let x = 0; x < GAME_WIDTH; x += stripeWidth) {
       ctx.fillStyle = (x/stripeWidth) % 2 === 0 ? '#2E7D32' : '#388E3C'; 
       ctx.fillRect(x, 0, stripeWidth, GAME_HEIGHT);
       
       ctx.fillStyle = 'rgba(0,0,0,0.15)';
       const lineGap = 100;
       for (let y = -100; y < GAME_HEIGHT + 100; y += lineGap) {
          const drawY = (y + s.scrollOffset * 4) % (GAME_HEIGHT + 200) - 100;
          ctx.fillRect(x + 5, drawY, 4, 30);
          ctx.fillRect(x + stripeWidth - 10, drawY + 50, 4, 30);
       }
    }

    // 2. Objects
    s.objects.forEach(obj => {
      ctx.save();
      ctx.translate(obj.x, obj.y);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(10, 10, obj.width/2, 0, Math.PI*2);
      ctx.fill();

      if (obj.type === 'PEST') {
        // Red/Green Square
        ctx.fillStyle = obj.cured ? '#00E676' : 'rgba(211, 47, 47, 0.8)';
        ctx.strokeStyle = obj.cured ? '#FFF' : '#B71C1C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Draw geometric pest (Diamond shape)
        ctx.moveTo(0, -obj.height/2);
        ctx.lineTo(obj.width/2, 0);
        ctx.lineTo(0, obj.height/2);
        ctx.lineTo(-obj.width/2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        if (!obj.cured) {
           ctx.fillStyle = '#FFF';
           ctx.textAlign = 'center';
           ctx.font = 'bold 12px monospace';
           ctx.fillText('!', 0, 4);
        }
      } else if (obj.type === 'TREE') {
        // Tree Canopy
        ctx.fillStyle = '#1B5E20';
        ctx.beginPath();
        ctx.arc(0, 0, obj.width/2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#2E7D32'; 
        ctx.beginPath();
        ctx.arc(-5, -5, obj.width/3, 0, Math.PI*2);
        ctx.fill();
      } else if (obj.type === 'POLE') {
        ctx.fillStyle = '#9E9E9E';
        ctx.beginPath();
        ctx.arc(0, 0, obj.width/2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 3. Drone
    ctx.save();
    ctx.translate(s.drone.x, s.drone.y);
    ctx.rotate(s.drone.tilt * 0.005); 

    const time = Date.now();
    const propOffset = 22;
    // Arms
    ctx.strokeStyle = '#616161';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-propOffset, -propOffset); ctx.lineTo(propOffset, propOffset);
    ctx.moveTo(propOffset, -propOffset); ctx.lineTo(-propOffset, propOffset);
    ctx.stroke();

    const drawProp = (x: number, y: number, dir: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(dir * time / 30);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; 
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#EEE'; 
        ctx.fillRect(-14, -2, 28, 4);
        ctx.fillRect(-2, -14, 4, 28);
        ctx.restore();
    };

    drawProp(-propOffset, -propOffset, 1);
    drawProp(propOffset, -propOffset, -1);
    drawProp(-propOffset, propOffset, -1);
    drawProp(propOffset, propOffset, 1);

    // Body
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.rect(-12, -12, 24, 24);
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Status Light
    ctx.fillStyle = '#00B0FF';
    ctx.shadowColor = '#00B0FF';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // 4. Particles
    s.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (stateRef.current.gameOver) return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    
    const x = (e.clientX - rect.left) * scaleX;
    stateRef.current.inputX = x;
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

    if (gameState === 'PLAYING' || gameState === 'MENU' || gameState === 'GAME_OVER') {
        requestRef.current = requestAnimationFrame(loop);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, score, difficulty]);

  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center select-none">
       {/* HUD */}
       <div className="w-full flex justify-between items-center mb-2 px-4 py-2 bg-[#1B5E20] border-b-2 border-green-400 rounded-t-lg shadow-lg text-white font-mono-hud" style={{ maxWidth: GAME_WIDTH }}>
         <div>
            <div className="text-[10px] text-green-300 uppercase">SCORE</div>
            <div className="text-2xl text-white font-bold tracking-widest">{score}</div>
         </div>
         <div className="text-right">
            <div className="text-[10px] text-green-300 uppercase">HIGH SCORE</div>
            <div className="text-xl">{highScore}</div>
         </div>
       </div>

       <div className="relative group shadow-[0_0_30px_rgba(0,255,0,0.2)]">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            onPointerMove={handlePointerMove}
            onPointerDown={() => { if(gameState==='MENU') initGame(); }}
            className="bg-[#2E7D32] w-auto h-auto max-h-[70vh] object-contain border-x-4 border-b-4 border-[#1B5E20] shadow-xl touch-none cursor-crosshair"
          />

          {gameState === 'MENU' && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-6 text-center animate-fade-in pointer-events-none">
                <h1 className="text-4xl font-black text-white font-tech uppercase mb-2 drop-shadow-[0_0_10px_#00E676]">
                  Agro Drone Rush
                </h1>
                <p className="text-gray-300 mb-8 font-mono-hud text-sm">
                  Deslize para pilotar.<br/>Pulverize as Pragas (Vermelho).<br/>Evite Árvores e Postes!
                </p>
                <div className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold uppercase animate-pulse pointer-events-auto cursor-pointer shadow-[0_0_20px_rgba(0,230,118,0.4)] transition-all transform hover:scale-105" onClick={initGame}>
                  Decolar Drone
                </div>
             </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
               {!isScoreSaved ? (
                 <div className="w-full max-w-sm flex flex-col justify-center h-full">
                    <h2 className="text-3xl font-black text-red-500 font-tech uppercase mb-1">COLISÃO FATAL</h2>
                    <div className="text-5xl font-mono text-white mb-6 tracking-tighter">{score}</div>
                    
                    <p className="text-gray-400 text-xs mb-4 uppercase tracking-widest">Relatório de Missão</p>
                    
                    <div className="flex flex-col gap-3 mb-6">
                       <input type="text" name="name" placeholder="IDENTIFICAÇÃO (PILOTO)" value={formData.name} onChange={handleInputChange} className="bg-gray-900 p-3 text-white border border-gray-700 focus:border-green-500 outline-none font-mono text-sm uppercase" />
                       <input type="text" name="company" placeholder="UNIDADE (EMPRESA)" value={formData.company} onChange={handleInputChange} className="bg-gray-900 p-3 text-white border border-gray-700 focus:border-green-500 outline-none font-mono text-sm uppercase" />
                    </div>
                    <button onClick={handleSaveScore} disabled={!formData.name} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-widest font-tech shadow-lg transition-colors">
                      Salvar Dados
                    </button>
                    <button onClick={initGame} className="text-gray-500 text-xs uppercase hover:text-white mt-4 tracking-widest">
                      Pulverizar Novamente sem Salvar
                    </button>
                 </div>
               ) : (
                 <div className="w-full h-full flex flex-col">
                    <h3 className="text-green-500 font-bold uppercase mb-4 font-tech tracking-widest border-b border-gray-800 pb-2">Ranking Global</h3>
                    <div className="flex-grow overflow-y-auto mb-4 bg-gray-900/50 p-2 border border-gray-800">
                       {isLoadingRanking ? <p className="text-green-500 font-mono text-xs p-4">RECUPERANDO DADOS...</p> : (
                         <table className="w-full text-left text-xs text-gray-300 font-mono">
                           <tbody>
                             {highScoresList.map((e, i) => (
                               <tr key={i} className="border-b border-gray-800 hover:bg-white/5"><td className="py-2 pl-2">{i+1}.</td><td className="py-2"><span className="text-white">{e.player_name}</span></td><td className="text-right pr-2 text-green-400">{e.score}</td></tr>
                             ))}
                           </tbody>
                         </table>
                       )}
                    </div>
                    <button onClick={initGame} className="w-full py-4 bg-white text-black font-black uppercase font-tech hover:bg-green-400 hover:text-white transition-colors tracking-widest">
                      Pulverizar Novamente
                    </button>
                 </div>
               )}
            </div>
          )}
       </div>
    </div>
  );
};

export default DroneRushCanvas;