import React, { useRef, useEffect, useState, useCallback } from 'react';
import { supabase, ScoreEntry } from '../supabaseClient';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

// --- ZzFX Micro-library (Audio) ---
// @ts-ignore
let zzfxX: AudioContext | null = null;
// @ts-ignore
const zzfx = (...t)=>{let e=zzfxX||new(window.AudioContext||window.webkitAudioContext);zzfxX=e;let s=e.createBufferSource(),r=e.createBuffer(1,t.length,44100);t.map((e,t)=>r.getChannelData(0)[t]=e),s.buffer=r,s.connect(e.destination),s.start()};
// Sound Presets
const SND_SHOOT = [.1,,.1,.01,.01,.04,0,1.2,-6,-1.3,,,,.5,,.1,,.6,.03]; // Soft spray
const SND_HIT = [1.2,,359,.01,.08,.16,1,1.48,-1.7,.2,,,.08,1.4,,.1,.08,.64,.06]; // Pop
const SND_HURT = [1.5,,197,.02,.17,.33,2,1.38,,.1,,,,1.1,,.3,.12,.27,.07]; // Warning

// --- Types ---
interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Tractor extends Entity {
  targetX: number; // For Lerp movement
}

interface Weed {
  id: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  active: boolean;
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

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // --- UI State ---
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAME_OVER'>('MENU');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  
  // Form State
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [highScoresList, setHighScoresList] = useState<ScoreEntry[]>([]);
  const [isScoreSaved, setIsScoreSaved] = useState(false);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- Game Engine Mutable State (Refs) ---
  const stateRef = useRef({
    tractor: { x: GAME_WIDTH/2, y: GAME_HEIGHT - 100, width: 50, height: 70, targetX: GAME_WIDTH/2 } as Tractor,
    weeds: [] as Weed[],
    projectiles: [] as Particle[], // Spray drops
    particles: [] as Particle[], // Explosions
    screenShake: 0,
    lastShotTime: 0,
    bgOffset: 0,
    difficultyTimer: 0,
    spawnTimer: 0,
    baseSpeed: 2,
    gameOver: false
  });

  // Load Local High Score
  useEffect(() => {
    const saved = localStorage.getItem('agro_defender_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Core Logic ---

  const initGame = () => {
    stateRef.current = {
      tractor: { x: GAME_WIDTH/2, y: GAME_HEIGHT - 100, width: 50, height: 70, targetX: GAME_WIDTH/2 },
      weeds: [],
      projectiles: [],
      particles: [],
      screenShake: 0,
      lastShotTime: 0,
      bgOffset: 0,
      difficultyTimer: 0,
      spawnTimer: 0,
      baseSpeed: 3,
      gameOver: false
    };
    setScore(0);
    setLives(3);
    setGameState('PLAYING');
    setIsScoreSaved(false);
    setFormData({ name: '', company: '', phone: '' });
  };

  const spawnExplosion = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      stateRef.current.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color,
        size: Math.random() * 3 + 1
      });
    }
  };

  const update = (dt: number) => {
    const state = stateRef.current;
    if (state.gameOver) return;

    // 1. Difficulty Ramp (Every 15s)
    state.difficultyTimer += dt;
    if (state.difficultyTimer > 15000) {
      state.baseSpeed += 0.5;
      state.difficultyTimer = 0;
    }

    // 2. Tractor Movement (Lerp)
    // Smoothly interpolate current X towards target X
    state.tractor.x += (state.tractor.targetX - state.tractor.x) * 0.15;
    
    // Clamp to screen
    if(state.tractor.x < 25) state.tractor.x = 25;
    if(state.tractor.x > GAME_WIDTH - 25) state.tractor.x = GAME_WIDTH - 25;

    // 3. Auto Fire (Spray) - Every 300ms
    const now = performance.now();
    if (now - state.lastShotTime > 300) {
      // Create a burst of spray particles
      for(let i=0; i<5; i++) {
        state.projectiles.push({
          x: state.tractor.x + (Math.random() - 0.5) * 20,
          y: state.tractor.y - 10,
          vx: (Math.random() - 0.5) * 2,
          vy: -8 - Math.random() * 2,
          life: 0.8,
          color: 'rgba(200, 255, 255, 0.8)',
          size: 2
        });
      }
      // @ts-ignore
      zzfx(...SND_SHOOT);
      state.lastShotTime = now;
    }

    // 4. Update Projectiles (Spray)
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02; // Fade out
      
      // Simple collision vs Weeds
      for (let w = state.weeds.length - 1; w >= 0; w--) {
        const weed = state.weeds[w];
        const dx = p.x - weed.x;
        const dy = p.y - weed.y;
        if (dx*dx + dy*dy < weed.radius * weed.radius) {
           // Hit!
           weed.active = false; // Mark for removal
           p.life = 0; // Destroy projectile
           
           // Juice
           spawnExplosion(weed.x, weed.y, '#4CAF50', 8);
           state.screenShake = 3;
           setScore(s => s + 10);
           // @ts-ignore
           zzfx(...SND_HIT);
        }
      }

      if (p.life <= 0) state.projectiles.splice(i, 1);
    }

    // remove dead weeds
    for (let i = state.weeds.length - 1; i >= 0; i--) {
        if(!state.weeds[i].active) state.weeds.splice(i, 1);
    }

    // 5. Spawn Weeds
    state.spawnTimer += dt;
    const spawnRate = Math.max(500, 1500 - (state.baseSpeed * 100)); // Faster spawn as speed increases
    if (state.spawnTimer > spawnRate) {
       state.weeds.push({
         id: Math.random(),
         x: Math.random() * (GAME_WIDTH - 60) + 30,
         y: -40,
         radius: 18,
         speed: state.baseSpeed + Math.random(), // Variance
         active: true,
         rotation: Math.random() * Math.PI
       });
       state.spawnTimer = 0;
    }

    // 6. Update Weeds
    for (let i = state.weeds.length - 1; i >= 0; i--) {
      const w = state.weeds[i];
      w.y += w.speed;
      w.rotation += 0.05;

      // Check boundary (Loss Life)
      if (w.y > GAME_HEIGHT + 20) {
        state.weeds.splice(i, 1);
        setLives(prev => {
           const newLives = prev - 1;
           if (newLives <= 0) {
             state.gameOver = true;
             setGameState('GAME_OVER');
             // Update Local Highscore immediately
             if (score > highScore) {
                setHighScore(score);
                localStorage.setItem('agro_defender_highscore', score.toString());
             }
           }
           return newLives;
        });
        state.screenShake = 15; // Big shake on damage
        // @ts-ignore
        zzfx(...SND_HURT);
      }
    }

    // 7. Update Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // 8. Screen Shake Decay
    if (state.screenShake > 0) state.screenShake *= 0.9;
    if (state.screenShake < 0.5) state.screenShake = 0;

    // 9. Background Scroll
    state.bgOffset = (state.bgOffset + state.baseSpeed) % 60;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const state = stateRef.current;
    
    // Clear
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Apply Shake
    ctx.save();
    if (state.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * state.screenShake, (Math.random() - 0.5) * state.screenShake);
    }

    // 1. Background (Soil)
    ctx.fillStyle = '#4E342E';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Crop Lines (Parallax/Scrolling)
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Vertical furrows
    for (let x = 40; x < GAME_WIDTH; x += 80) {
       ctx.moveTo(x, 0);
       ctx.lineTo(x, GAME_HEIGHT);
    }
    // Horizontal Texture (Moving)
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let y = state.bgOffset - 60; y < GAME_HEIGHT; y += 60) {
       ctx.moveTo(0, y);
       ctx.lineTo(GAME_WIDTH, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // 2. Projectiles (Spray)
    state.projectiles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // 3. Weeds
    state.weeds.forEach(w => {
       ctx.save();
       ctx.translate(w.x, w.y);
       ctx.rotate(w.rotation);
       
       // Green Body
       ctx.fillStyle = '#2E7D32';
       ctx.beginPath();
       ctx.arc(0, 0, w.radius, 0, Math.PI*2);
       ctx.fill();
       
       // "Y" shape inside (Weed detail)
       ctx.strokeStyle = '#81C784';
       ctx.lineWidth = 3;
       ctx.beginPath();
       ctx.moveTo(0, 5);
       ctx.lineTo(0, -5);
       ctx.lineTo(-5, -10);
       ctx.moveTo(0, -5);
       ctx.lineTo(5, -10);
       ctx.stroke();

       ctx.restore();
    });

    // 4. Particles
    state.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // 5. Tractor (Player)
    const t = state.tractor;
    ctx.save();
    ctx.translate(t.x, t.y);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-t.width/2 + 5, 5, t.width, t.height);

    // Wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(-t.width/2 - 5, 10, 10, 20); // Front L
    ctx.fillRect(t.width/2 - 5, 10, 10, 20);  // Front R
    ctx.fillRect(-t.width/2 - 8, 40, 12, 30); // Rear L
    ctx.fillRect(t.width/2 - 4, 40, 12, 30);  // Rear R

    // Body (Orange)
    ctx.fillStyle = '#FF6F00';
    ctx.fillRect(-t.width/2, 0, t.width, t.height);
    
    // Cabin (Glass)
    ctx.fillStyle = '#81D4FA';
    ctx.fillRect(-t.width/4, 20, t.width/2, 20);
    
    // Engine Vents
    ctx.fillStyle = '#BF360C';
    ctx.fillRect(-t.width/4, 5, t.width/2, 10);

    ctx.restore();

    ctx.restore(); // End Shake
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (stateRef.current.gameOver) return;
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = GAME_WIDTH / rect.width;
      
      // Update Target X for Lerp
      const x = (e.clientX - rect.left) * scaleX;
      stateRef.current.tractor.targetX = x;
  };

  // --- Game Loop ---
  useEffect(() => {
    let lastTime = performance.now();
    let accumulator = 0;
    const step = 1000/60; // 60 FPS fixed step

    const loop = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      accumulator += dt;

      // Update Physics
      while (accumulator >= step) {
        if (gameState === 'PLAYING') update(step);
        accumulator -= step;
      }

      // Draw
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
  }, [gameState, score]); // Re-bind if major state changes, though mutable state handles frame-to-frame

  // --- Supabase Logic (Copy-Paste from others for consistency) ---
  const fetchHighScores = async () => {
    setIsLoadingRanking(true);
    const { data } = await supabase.from('game_scores').select('*').eq('game_id', 'weed_control').order('score', { ascending: false }).limit(10);
    setHighScoresList(data || []);
    setIsLoadingRanking(false);
  };
  const handleSaveScore = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    await supabase.from('game_scores').insert([{
      game_id: 'weed_control', player_name: formData.name.trim().toUpperCase(), company_name: formData.company.trim().toUpperCase(), phone: formData.phone, score: score
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
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center">
      
      {/* HUD (Overlay UI) */}
      <div className="w-full flex justify-between items-center mb-2 px-4 py-2 bg-gray-900 border-b-2 border-orange-600 rounded-t-lg shadow-lg text-white font-mono-hud" style={{ maxWidth: GAME_WIDTH }}>
        <div>
           <div className="text-[10px] text-gray-400 uppercase">SCORE</div>
           <div className="text-2xl text-orange-500 font-bold">{score}</div>
        </div>
        <div className="text-center">
             <div className="text-[10px] text-gray-400 uppercase">HIGH SCORE</div>
             <div className="text-xl">{highScore}</div>
        </div>
        <div className="text-right">
           <div className="text-[10px] text-gray-400 uppercase">VIDAS</div>
           <div className="flex gap-1 justify-end">
              {[...Array(3)].map((_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-full ${i < lives ? 'bg-red-500 shadow-[0_0_5px_red]' : 'bg-gray-700'}`}></div>
              ))}
           </div>
        </div>
      </div>

      <div className="relative group shadow-2xl">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onPointerMove={handlePointerMove}
          onPointerDown={() => { if(gameState==='MENU') initGame(); }}
          className="bg-[#4E342E] w-auto h-auto max-h-[70vh] object-contain border-x-4 border-b-4 border-orange-900 shadow-xl touch-none cursor-crosshair"
        />

        {/* MENU START */}
        {gameState === 'MENU' && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-6 text-center animate-fade-in">
              <h1 className="text-4xl font-black text-orange-500 font-tech uppercase mb-2 glow-text-orange">
                Agro Defender
              </h1>
              <p className="text-gray-300 mb-8 font-mono-hud text-sm">
                Deslize para mover.<br/>O trator dispara automaticamente.<br/>Não deixe as ervas passarem!
              </p>
              <button onClick={initGame} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-widest font-tech shadow-lg animate-pulse">
                [ INICIAR MISSÃO ]
              </button>
           </div>
        )}

        {/* GAME OVER & FORM */}
        {gameState === 'GAME_OVER' && (
           <div className="absolute inset-0 bg-[#0f172a]/95 flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
              {!isScoreSaved ? (
                <div className="w-full max-w-sm flex flex-col justify-center h-full">
                   <h2 className="text-3xl font-black text-red-500 font-tech uppercase mb-1">FALHA NA MISSÃO</h2>
                   <div className="text-5xl font-mono text-white mb-6">{score}</div>
                   
                   <p className="text-white text-xs mb-4">Salve seu recorde no Ranking Global</p>
                   
                   <div className="flex flex-col gap-2 mb-4">
                      <input type="text" name="name" placeholder="Nome" value={formData.name} onChange={handleInputChange} className="bg-gray-800 p-3 rounded text-white border border-gray-700" />
                      <input type="text" name="company" placeholder="Empresa (Opcional)" value={formData.company} onChange={handleInputChange} className="bg-gray-800 p-3 rounded text-white border border-gray-700" />
                   </div>
                   <button onClick={handleSaveScore} disabled={!formData.name} className="bg-green-600 p-3 rounded text-white font-bold uppercase mb-2">Salvar Recorde</button>
                   <button onClick={initGame} className="text-gray-400 text-xs uppercase hover:text-white mt-2">Jogar Novamente sem salvar</button>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col">
                   <h3 className="text-orange-500 font-bold uppercase mb-4 font-tech">Top Operadores</h3>
                   <div className="flex-grow overflow-y-auto mb-4 bg-gray-900 p-2 rounded">
                      {isLoadingRanking ? <p className="text-white">Carregando...</p> : (
                        <table className="w-full text-left text-xs text-gray-300">
                          <tbody>
                            {highScoresList.map((e, i) => (
                              <tr key={i} className="border-b border-gray-700"><td className="py-2">{i+1}. {e.player_name}</td><td className="text-right">{e.score}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                   </div>
                   <button onClick={initGame} className="w-full py-3 bg-white text-black font-bold uppercase font-tech">Nova Operação</button>
                </div>
              )}
           </div>
        )}
      </div>
      
      <div className="mt-2 text-center text-gray-500 text-[10px] font-mono-hud uppercase">
         Use Mouse ou Dedo para controlar o trator
      </div>
    </div>
  );
};

export default GameCanvas;