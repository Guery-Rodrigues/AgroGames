import React, { useRef, useEffect, useState } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { supabase, ScoreEntry } from '../supabaseClient';

// --- ZzFX Micro-library ---
// @ts-ignore
let zzfxX: AudioContext | null = null;
// @ts-ignore
const zzfx = (...t)=>{let e=zzfxX||new(window.AudioContext||window.webkitAudioContext);zzfxX=e;let s=e.createBufferSource(),r=e.createBuffer(1,t.length,44100);t.map((e,t)=>r.getChannelData(0)[t]=e),s.buffer=r,s.connect(e.destination),s.start()};

// Sounds (Digital / High Tech)
const SND_SCAN_COMPLETE = [1.2,,556,.01,.16,.15,1,1.43,1.4,,,,,.06,,.1,,.67,.08]; // Clean Ping
const SND_SCANNING      = [0.3,,236,.02,.02,.07,3,1.6,-7.6,,,.06,,,,.1,.53,.07]; // Data noise
const SND_CRASH         = [1.9,,277,.03,.23,.51,4,2.95,,.2,,,,,1.6,,.3,.12,.69]; // Static Crash
const SND_WARNING       = [0.8,,385,.03,.28,.36,1,1.57,,,,,,.1,,.1,,.63,.06]; // Low health warning

// --- PALETTE (NDVI / HEATMAP STYLE) ---
const COLOR_BG_BASE = '#0a1a0a'; // Very dark green/black
const COLOR_CROP_A = '#1b5e20';
const COLOR_CROP_B = '#2e7d32';
const COLOR_GRID = 'rgba(255, 255, 255, 0.15)';
const COLOR_HUD_TEXT = '#00e5ff';
const COLOR_SCANNER = '#00e5ff'; // Cyan
const COLOR_PEST = '#ff3d00'; // Red/Orange
const COLOR_HEALED = '#00e676'; // Bright Green
const COLOR_OBSTACLE = '#003300'; // Dark Tree

const DRONE_Y = GAME_HEIGHT - 150;
const SCROLL_SPEED_BASE = 4;

interface Entity {
  id: number;
  type: 'PEST' | 'TREE';
  x: number;
  y: number;
  radius: number;
  health: number; // 0 to 1 (0 = full pest, 1 = healed)
  active: boolean;
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

const NDVISkyHunterCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // UI State
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAME_OVER'>('MENU');
  const [score, setScore] = useState(0); // Hectares
  const [cropHealth, setCropHealth] = useState(100);
  const [highScore, setHighScore] = useState(0);

  // Form / Supabase
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [isScoreSaved, setIsScoreSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [highScoresList, setHighScoresList] = useState<ScoreEntry[]>([]);

  // Mutable Game State
  const stateRef = useRef({
    droneX: GAME_WIDTH / 2,
    droneTilt: 0,
    targetX: GAME_WIDTH / 2,
    scrollOffset: 0,
    scrollSpeed: SCROLL_SPEED_BASE,
    entities: [] as Entity[],
    particles: [] as Particle[],
    spawnTimer: 0,
    difficultyTimer: 0,
    shake: 0,
    isScanning: false,
    gameOver: false,
    engineFrame: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem('ndvi_hunter_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const spawnDigitalParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      stateRef.current.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: 0,
        vy: -2 - Math.random() * 3, // Rise up like data
        life: 1.0,
        color: color,
        size: 2 + Math.random() * 3 // Square size
      });
    }
  };

  const initGame = () => {
    stateRef.current = {
      droneX: GAME_WIDTH / 2,
      droneTilt: 0,
      targetX: GAME_WIDTH / 2,
      scrollOffset: 0,
      scrollSpeed: SCROLL_SPEED_BASE,
      entities: [],
      particles: [],
      spawnTimer: 0,
      difficultyTimer: 0,
      shake: 0,
      isScanning: false,
      gameOver: false,
      engineFrame: 0,
    };
    setScore(0);
    setCropHealth(100);
    setGameState('PLAYING');
    setIsScoreSaved(false);
  };

  const update = (dt: number) => {
    const s = stateRef.current;
    if (s.gameOver) return;

    // 1. Difficulty Ramp
    s.difficultyTimer += dt;
    if (s.difficultyTimer > 15000) {
      s.scrollSpeed += 0.5;
      s.difficultyTimer = 0;
    }

    // 2. Drone Movement (Smooth Lerp)
    const dx = s.targetX - s.droneX;
    s.droneX += dx * 0.15;
    s.droneTilt = -dx * 0.05; // Tilt logic
    // Clamp Tilt
    s.droneTilt = Math.max(-0.5, Math.min(0.5, s.droneTilt));
    s.engineFrame += 0.5;

    // 3. Scroll & Spawn
    s.scrollOffset = (s.scrollOffset + s.scrollSpeed) % 80; // Grid size
    s.spawnTimer += dt;

    const spawnRate = Math.max(800, 2000 - (s.scrollSpeed * 100)); // Faster spawn over time
    if (s.spawnTimer > spawnRate) {
        const type = Math.random() > 0.7 ? 'TREE' : 'PEST';
        const size = type === 'TREE' ? 40 : 35;
        
        s.entities.push({
            id: Math.random(),
            type: type,
            x: Math.random() * (GAME_WIDTH - 100) + 50,
            y: -100,
            radius: size,
            health: 0, // 0 = bad, 1 = healed
            active: true
        });
        s.spawnTimer = 0;
    }

    // 4. Entity Logic
    s.isScanning = false; // Reset frame flag
    
    for (let i = s.entities.length - 1; i >= 0; i--) {
        const ent = s.entities[i];
        ent.y += s.scrollSpeed;

        // Cleanup
        if (ent.y > GAME_HEIGHT + 50) {
            if (ent.type === 'PEST' && ent.health < 1) {
                // Missed a pest
                setCropHealth(prev => {
                    const next = Math.max(0, prev - 15);
                    if (next <= 0) handleGameOver();
                    return next;
                });
                s.shake = 5;
                // @ts-ignore
                zzfx(...SND_WARNING);
            }
            s.entities.splice(i, 1);
            continue;
        }

        // Collision / Scanning logic
        const distX = Math.abs(s.droneX - ent.x);
        const distY = Math.abs(DRONE_Y - ent.y);
        
        // A. Physical Collision (Tree)
        if (ent.type === 'TREE') {
            const hitDist = ent.radius + 20; // Drone radius approx
            if (Math.sqrt((s.droneX - ent.x)**2 + (DRONE_Y - ent.y)**2) < hitDist) {
                handleGameOver();
            }
        }

        // B. Scanning (Pest)
        if (ent.type === 'PEST' && ent.y < DRONE_Y + 50 && ent.y > DRONE_Y - 150) {
            // Scanner has a width of approx 60px
            if (distX < 40) {
                s.isScanning = true;
                if (ent.health < 1) {
                    ent.health += 0.03; // Scanning speed
                    
                    if (ent.health >= 1) {
                        ent.health = 1;
                        setScore(prev => prev + 1); // 1 Hectare mapped
                        setCropHealth(prev => Math.min(100, prev + 2));
                        spawnDigitalParticles(ent.x, ent.y, COLOR_HEALED);
                        // @ts-ignore
                        zzfx(...SND_SCAN_COMPLETE);
                    } else if (Math.random() > 0.8) {
                        // Scan noise
                         // @ts-ignore
                        zzfx(...SND_SCANNING);
                    }
                }
            }
        }
    }

    // 5. Particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.y += p.vy; // Rise
        p.life -= 0.03;
        if (p.life <= 0) s.particles.splice(i, 1);
    }

    // Shake Decay
    if (s.shake > 0) s.shake *= 0.9;
    if (s.shake < 0.5) s.shake = 0;
  };

  const handleGameOver = () => {
    stateRef.current.gameOver = true;
    stateRef.current.shake = 30;
    setGameState('GAME_OVER');
     // @ts-ignore
    zzfx(...SND_CRASH);
    if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('ndvi_hunter_highscore', score.toString());
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Shake
    ctx.save();
    if (s.shake > 0) ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);

    // --- 1. Background (Crop Rows) ---
    // Alternating dark green strips
    for (let x = 0; x < GAME_WIDTH; x += 40) {
        ctx.fillStyle = (x/40) % 2 === 0 ? COLOR_CROP_A : COLOR_CROP_B;
        ctx.fillRect(x, 0, 40, GAME_HEIGHT);
    }
    // Gradient overlay for depth (Vignette)
    const grad = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT/2, 100, GAME_WIDTH/2, GAME_HEIGHT/2, GAME_HEIGHT);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // --- 2. Digital Grid (The "HUD" on ground) ---
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Vertical perspective lines
    for (let x = 0; x <= GAME_WIDTH; x += 80) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_HEIGHT);
    }
    // Horizontal scrolling lines
    for (let y = s.scrollOffset - 80; y < GAME_HEIGHT; y += 80) {
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_WIDTH, y);
    }
    ctx.stroke();

    // --- 3. Entities (Ground Level) ---
    s.entities.forEach(ent => {
        ctx.save();
        ctx.translate(ent.x, ent.y);

        if (ent.type === 'TREE') {
            // Tree Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.arc(5, 5, ent.radius, 0, Math.PI*2); ctx.fill();
            // Tree Body
            ctx.fillStyle = COLOR_OBSTACLE;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, ent.radius, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            // Inner detail
            ctx.fillStyle = '#1b5e20';
            ctx.beginPath(); ctx.arc(-5, -5, ent.radius*0.6, 0, Math.PI*2); ctx.fill();

        } else if (ent.type === 'PEST') {
            // Interpolate color based on health (Red -> Yellow -> Green)
            const r = Math.floor(255 * (1 - ent.health));
            const g = Math.floor(255 * ent.health * 0.9 + 50); // Add some green base
            const b = 0;
            const color = `rgb(${r},${g},${b})`;
            
            // Heatmap Blob effect
            const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, ent.radius);
            gradient.addColorStop(0, color);
            gradient.addColorStop(0.5, color);
            gradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = gradient;
            ctx.beginPath(); ctx.arc(0, 0, ent.radius, 0, Math.PI*2); ctx.fill();

            // Digital Brackets around target
            if (ent.health < 1) {
                ctx.strokeStyle = 'rgba(255, 61, 0, 0.5)';
                ctx.lineWidth = 2;
                const size = ent.radius * 0.8;
                ctx.beginPath();
                ctx.moveTo(-size, -size/2); ctx.lineTo(-size, -size); ctx.lineTo(-size/2, -size);
                ctx.moveTo(size, -size/2); ctx.lineTo(size, -size); ctx.lineTo(size/2, -size);
                ctx.moveTo(-size, size/2); ctx.lineTo(-size, size); ctx.lineTo(-size/2, size);
                ctx.moveTo(size, size/2); ctx.lineTo(size, size); ctx.lineTo(size/2, size);
                ctx.stroke();
            }
        }
        ctx.restore();
    });

    // --- 4. Drone (Air Level) ---
    ctx.save();
    ctx.translate(s.droneX, DRONE_Y);
    ctx.rotate(s.droneTilt);
    
    // Scanner Beam (Under Drone)
    // Use 'lighter' for that hologram/laser look
    ctx.globalCompositeOperation = 'lighter';
    const beamOpacity = s.isScanning ? 0.4 : 0.15;
    const beamColor = s.isScanning ? COLOR_HEALED : COLOR_SCANNER;
    
    const beamGrad = ctx.createLinearGradient(0, 0, 0, -150); // Projects forward/up in 2D topdown view, actually looks like 'forward'
    // Let's project it "forward" which is UP on screen Y since the drone flies UP relative to ground logic, 
    // wait, terrain moves DOWN (y+), so drone faces UP (y-).
    // Let's project the beam forward (Y negative).
    
    const beamLen = 140;
    const beamW = 60;
    
    // Beam shape
    ctx.fillStyle = beamColor;
    ctx.globalAlpha = beamOpacity;
    ctx.beginPath();
    ctx.moveTo(-5, 0); // Origin center
    ctx.lineTo(5, 0);
    ctx.lineTo(beamW/2, -beamLen);
    ctx.lineTo(-beamW/2, -beamLen);
    ctx.closePath();
    ctx.fill();

    // Scan lines inside beam
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    const scanLineY = -((Date.now() / 5) % beamLen);
    ctx.beginPath();
    ctx.moveTo(-beamW/2 * (Math.abs(scanLineY)/beamLen), scanLineY);
    ctx.lineTo(beamW/2 * (Math.abs(scanLineY)/beamLen), scanLineY);
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over'; // Reset
    ctx.globalAlpha = 1;

    // Drone Body
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 20;
    
    // Arms
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, -20); ctx.lineTo(20, 20);
    ctx.moveTo(20, -20); ctx.lineTo(-20, 20);
    ctx.stroke();

    // Props (Spinning Blur)
    const drawProp = (px: number, py: number) => {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill();
    };
    drawProp(-20, -20); drawProp(20, -20);
    drawProp(-20, 20); drawProp(20, 20);

    // Central Unit
    ctx.fillStyle = '#F5F5F5';
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(10, 5);
    ctx.lineTo(0, 15);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fill();
    
    // Status LED
    ctx.fillStyle = s.isScanning ? COLOR_HEALED : COLOR_SCANNER;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // --- 5. Particles (Digital Pixels) ---
    s.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        // Square pixels
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    ctx.restore(); // End Shake

    // --- 6. HUD ---
    // Crop Health Bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(GAME_WIDTH - 20, 60, 10, 100);
    
    const hPercent = cropHealth / 100;
    ctx.fillStyle = hPercent > 0.5 ? COLOR_HEALED : (hPercent > 0.2 ? '#FFC107' : COLOR_PEST);
    const barH = 100 * hPercent;
    ctx.fillRect(GAME_WIDTH - 20, 60 + (100 - barH), 10, barH);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '10px "Orbitron", monospace';
    ctx.fillText('SAÚDE', GAME_WIDTH - 35, 175);

    // Score
    ctx.textAlign = 'left';
    ctx.font = '16px "Orbitron", monospace';
    ctx.fillStyle = COLOR_HUD_TEXT;
    ctx.fillText(`HECTARES: ${score}`, 20, 40);

    // GPS Text (Flavor)
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`LAT: -23.${Math.floor(Date.now()/100)%99}  LON: -46.${Math.floor(Date.now()/50)%99}`, 20, 60);
    ctx.fillText(`NDVI MODE: ACTIVE`, 20, 75);

    // Grid Overlay lines (Static HUD)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 20); ctx.lineTo(20, 30); ctx.lineTo(30, 20); // Corner
    ctx.moveTo(GAME_WIDTH-20, 20); ctx.lineTo(GAME_WIDTH-20, 30); ctx.lineTo(GAME_WIDTH-30, 20);
    ctx.stroke();
  };

  // --- Input ---
  const handlePointerMove = (e: React.PointerEvent) => {
    if (stateRef.current.gameOver) return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    
    stateRef.current.targetX = x;
  };

  const handlePointerDown = () => {
      if (gameState === 'MENU' || gameState === 'GAME_OVER') {
          if (gameState === 'GAME_OVER' && score > 0 && !isScoreSaved) return; // Wait for save
          initGame();
      }
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
  }, [gameState, cropHealth, score]);


  // --- Supabase ---
  const fetchHighScores = async () => {
    setIsLoadingRanking(true);
    const { data } = await supabase.from('game_scores').select('*').eq('game_id', 'ndvi_hunter').order('score', { ascending: false }).limit(10);
    setHighScoresList(data || []);
    setIsLoadingRanking(false);
  };
  const handleSaveScore = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    await supabase.from('game_scores').insert([{
      game_id: 'ndvi_hunter', player_name: formData.name.trim().toUpperCase(), company_name: formData.company.trim().toUpperCase(), phone: formData.phone, score: score
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
       <div className="relative group shadow-[0_0_40px_rgba(0,229,255,0.2)]">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            className="bg-[#051005] w-auto h-auto max-h-[70vh] object-contain border-2 border-[#003300] shadow-xl touch-none cursor-crosshair"
          />

          {gameState === 'MENU' && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center animate-fade-in pointer-events-none">
                <h1 className="text-4xl font-black text-[#00e5ff] font-tech uppercase mb-2 tracking-widest drop-shadow-[0_0_15px_rgba(0,229,255,0.6)]">
                  NDVI Sky Hunter
                </h1>
                <p className="text-gray-300 mb-8 font-mono-hud text-sm">
                  Pilote o Drone de Monitoramento.<br/>
                  Escaneie manchas <span className="text-red-500 font-bold">VERMELHAS</span> até ficarem <span className="text-green-500 font-bold">VERDES</span>.<br/>
                  Desvie das Árvores!
                </p>
                <div className="px-8 py-3 bg-cyan-900/50 text-cyan-400 font-bold uppercase animate-pulse pointer-events-auto cursor-pointer border border-cyan-500 hover:bg-cyan-500 hover:text-black transition-all">
                  INICIAR VOO
                </div>
             </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
               {!isScoreSaved ? (
                 <div className="w-full max-w-sm flex flex-col justify-center h-full">
                    <h2 className="text-2xl font-black text-red-500 font-tech uppercase mb-2">MISSÃO ABORTADA</h2>
                    <div className="text-gray-400 text-xs font-mono mb-1">ÁREA MAPEADA</div>
                    <div className="text-5xl font-mono text-cyan-400 mb-6 glow-text-cyan">{score} ha</div>
                    
                    <div className="flex flex-col gap-3 mb-6">
                       <input type="text" name="name" placeholder="PILOTO" value={formData.name} onChange={handleInputChange} className="bg-gray-900 p-3 rounded text-cyan-400 border border-gray-700 font-mono text-sm uppercase focus:border-cyan-500 outline-none" />
                       <input type="text" name="company" placeholder="UNIDADE" value={formData.company} onChange={handleInputChange} className="bg-gray-900 p-3 rounded text-cyan-400 border border-gray-700 font-mono text-sm uppercase focus:border-cyan-500 outline-none" />
                    </div>
                    <button onClick={handleSaveScore} disabled={!formData.name} className="bg-cyan-700 text-white p-3 rounded font-bold uppercase mb-2 hover:bg-cyan-600 font-tech">Upload Dados</button>
                    <button onClick={initGame} className="text-gray-500 text-xs uppercase hover:text-white mt-2">Reiniciar Voo</button>
                 </div>
               ) : (
                 <div className="w-full h-full flex flex-col">
                    <h3 className="text-cyan-500 font-bold uppercase mb-4 font-tech tracking-wider text-sm border-b border-gray-800 pb-2">Melhores Pilotos</h3>
                    <div className="flex-grow overflow-y-auto mb-4 bg-gray-900/50 p-2 border border-gray-800">
                       {isLoadingRanking ? <p className="text-cyan-500 font-mono text-xs p-4">BAIXANDO DADOS...</p> : (
                         <table className="w-full text-left text-xs text-gray-400 font-mono">
                           <tbody>
                             {highScoresList.map((e, i) => (
                               <tr key={i} className="border-b border-gray-800 hover:bg-cyan-900/20"><td className="py-2 pl-2 text-cyan-700">{i+1}.</td><td className="py-2"><span className="text-gray-200">{e.player_name}</span></td><td className="text-right pr-2 text-cyan-400">{e.score}</td></tr>
                             ))}
                           </tbody>
                         </table>
                       )}
                    </div>
                    <button onClick={initGame} className="w-full py-3 bg-white text-black font-bold uppercase font-tech hover:bg-cyan-400 hover:text-white transition-colors">NOVA MISSÃO</button>
                 </div>
               )}
            </div>
          )}
       </div>
    </div>
  );
};

export default NDVISkyHunterCanvas;