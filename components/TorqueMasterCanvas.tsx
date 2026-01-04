import React, { useRef, useEffect, useState } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { supabase, ScoreEntry } from '../supabaseClient';

// --- ZzFX Micro-library ---
// @ts-ignore
let zzfxX: AudioContext | null = null;
// @ts-ignore
const zzfx = (...t)=>{let e=zzfxX||new(window.AudioContext||window.webkitAudioContext);zzfxX=e;let s=e.createBufferSource(),r=e.createBuffer(1,t.length,44100);t.map((e,t)=>r.getChannelData(0)[t]=e),s.buffer=r,s.connect(e.destination),s.start()};

// Sounds (One-shots)
const SND_SCORE = [1.2,,556,.01,.16,.15,1,1.43,1.4,,,,,.06,,.1,,.67,.08]; // Ding
const SND_CRASH = [2.1,,160,.05,.3,.58,3,2.68,,.2,,,,,1.6,,.3,.24,.67]; // Explosion

const GRAVITY = 0.25;
const JUMP_STRENGTH = -6;
const GATE_SPEED_BASE = 3;
const GATE_SPAWN_RATE = 100; // Frames

// --- Visual Constants ---
const SKY_TOP = '#4FC3F7'; // Light Blue
const SKY_BOTTOM = '#FFCC80'; // Sunset Orange
const GROUND_COLOR = '#558B2F'; // Grass Green
const GROUND_STRIPE = '#33691E'; // Darker Grass
const POST_COLOR = '#8D6E63'; // Wood Light
const POST_DARK = '#5D4037'; // Wood Dark
const TRACTOR_RED = '#D32F2F'; // Case IH Red or Massey
const TRACTOR_ACCENT = '#212121'; // Black parts

// RPM Visuals
const RPM_GAUGE_WIDTH = 20;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  type: 'SMOKE' | 'DIRT' | 'EXPLOSION' | 'FLAME';
}

interface Gate {
  x: number;
  y: number; // Top of the safe zone
  safeHeight: number;
  width: number;
  passed: boolean;
}

interface Cloud {
  x: number;
  y: number;
  speed: number;
  width: number;
}

const TorqueMasterCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // Audio Context for Continuous Engine Sound
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

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
    rpmY: GAME_HEIGHT / 2,
    rpmVelocity: 0,
    gates: [] as Gate[],
    particles: [] as Particle[],
    clouds: [] as Cloud[],
    bgOffset: 0,
    gateTimer: 0,
    speedMultiplier: 1,
    shake: 0,
    gameOver: false,
    tractorRotation: 0,
    gameTime: 0,
    isRedlining: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('agro_torque_highscore');
    if (saved) setHighScore(parseInt(saved, 10));

    return () => {
      stopEngineSound(); // Cleanup on unmount
    };
  }, []);

  // --- Audio Engine Logic ---
  const startEngineSound = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume if suspended (browser policy)
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (!oscillatorRef.current) {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      
      osc.type = 'sawtooth'; // Sawtooth sounds more like an engine
      osc.frequency.value = 100; // Idle
      
      gain.gain.value = 0.1; // Volume

      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();

      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
    }
  };

  const updateEngineSound = (y: number, isRedlining: boolean) => {
    if (oscillatorRef.current && audioCtxRef.current && gainNodeRef.current) {
       // Map Y to Frequency
       // Y=Height (Bottom) -> Low Freq (~60Hz)
       // Y=0 (Top) -> High Freq (~300Hz)
       const normalizedHeight = 1 - (y / GAME_HEIGHT);
       let targetFreq = 60 + (normalizedHeight * 300);
       
       if (isRedlining) {
           // Instability at redline
           targetFreq += (Math.random() - 0.5) * 50;
       }

       oscillatorRef.current.frequency.setTargetAtTime(targetFreq, audioCtxRef.current.currentTime, 0.1);
       gainNodeRef.current.gain.setTargetAtTime(0.1, audioCtxRef.current.currentTime, 0.1);
    }
  };

  const stopEngineSound = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }
    if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
    }
  };


  const spawnParticles = (x: number, y: number, type: 'SMOKE' | 'DIRT' | 'EXPLOSION' | 'FLAME') => {
    let count = 0;
    if (type === 'SMOKE') count = 1;
    if (type === 'FLAME') count = 5;
    if (type === 'DIRT') count = 2;
    if (type === 'EXPLOSION') count = 25;

    for(let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2;
      let speed = Math.random() * (type === 'EXPLOSION' ? 6 : 2);
      
      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed;

      // Custom velocity per type
      if (type === 'SMOKE') {
          vx = -3 - Math.random(); // Move left fast (wind)
          vy = -1 + Math.random() * 2; // Slight spread
      }
      if (type === 'FLAME') {
          // Shoot UP relative to tractor? No, just burst out
          vx = -2 + Math.random() * 4;
          vy = -4 - Math.random() * 3; // Upward burst
      }
      if (type === 'DIRT') {
          vx = -3 - Math.random() * 2; // Kick back
          vy = -3 - Math.random() * 3; // Kick up
      }

      let color = '#795548';
      let size = 3;

      if (type === 'EXPLOSION') { color = '#FF5722'; size = 8; }
      if (type === 'FLAME') { color = Math.random() > 0.5 ? '#FFD600' : '#FF3D00'; size = 4 + Math.random()*3; }
      if (type === 'SMOKE') { 
          // Check redline state for smoke color? 
          // We pass context in update, here it's generic. 
          // Let's assume passed type handles it or we override later.
          color = 'rgba(50,50,50,0.4)'; 
          size = 8 + Math.random() * 5;
      }

      stateRef.current.particles.push({
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        life: 1.0,
        color: color,
        size: size,
        type: type
      });
    }
  };

  const initGame = () => {
    // Generate some clouds
    const clouds: Cloud[] = [];
    for(let i=0; i<5; i++) {
        clouds.push({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * (GAME_HEIGHT/2),
            speed: 0.5 + Math.random() * 0.5,
            width: 60 + Math.random() * 80
        });
    }

    stateRef.current = {
      rpmY: GAME_HEIGHT / 2,
      rpmVelocity: 0,
      gates: [],
      particles: [],
      clouds: clouds,
      bgOffset: 0,
      gateTimer: 0,
      speedMultiplier: 1,
      shake: 0,
      gameOver: false,
      tractorRotation: 0,
      gameTime: 0,
      isRedlining: false
    };
    setScore(0);
    setGameState('PLAYING');
    setIsScoreSaved(false);
    startEngineSound();
  };

  const handleInput = () => {
    if (gameState === 'MENU' || gameState === 'GAME_OVER') {
      if (gameState === 'GAME_OVER' && !isScoreSaved && score > 0) return; 
      initGame();
      return;
    }
    
    const s = stateRef.current;
    s.rpmVelocity = JUMP_STRENGTH;
    
    // VISUAL FEEDBACK: FLAME
    // Calculate exhaust position roughly
    // Rotating offset is tricky without matrix, assume roughly top-right of tractor center
    spawnParticles(100 + 10, s.rpmY - 30, 'FLAME'); 
    
    // Note: We don't play SND_REV here anymore, we modulate the continuous engine sound in update()
  };

  const update = (dt: number) => {
    const s = stateRef.current;
    if (s.gameOver) {
        stopEngineSound();
        return;
    }

    s.gameTime++;

    // 1. Physics
    s.rpmVelocity += GRAVITY;
    s.rpmY += s.rpmVelocity;

    // Smooth Rotation Calculation
    const targetRot = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, s.rpmVelocity * 0.1));
    s.tractorRotation += (targetRot - s.tractorRotation) * 0.2;

    // 2. Redline Logic
    s.isRedlining = s.rpmY < GAME_HEIGHT * 0.15; // Top 15% of screen
    if (s.isRedlining) {
        s.shake = 3; // Constant vibration
        // Spawn Black Smoke
        if (s.gameTime % 5 === 0) {
           const p = {
             x: 100 + 15, y: s.rpmY - 35,
             vx: -4, vy: -1,
             life: 1.0, color: '#000000', size: 10, type: 'SMOKE' as const
           };
           s.particles.push(p);
        }
    } else {
        // Normal White Smoke
        if (s.gameTime % 10 === 0) {
           spawnParticles(100 + 15, s.rpmY - 35, 'SMOKE');
        }
    }

    // Audio Update
    updateEngineSound(s.rpmY, s.isRedlining);


    // 3. Gates Spawning
    s.gateTimer++;
    const currentRate = Math.max(60, GATE_SPAWN_RATE - Math.floor(score / 5));
    
    if (s.gateTimer > currentRate) {
        const safeHeight = Math.max(140, 200 - score * 2); 
        const minTop = 50;
        const maxTop = GAME_HEIGHT - 100 - safeHeight; 
        const y = Math.random() * (maxTop - minTop) + minTop;

        s.gates.push({
            x: GAME_WIDTH + 50,
            y: y,
            safeHeight: safeHeight,
            width: 70, 
            passed: false
        });
        s.gateTimer = 0;
    }

    // 4. Move Gates & Check Collision
    const speed = GATE_SPEED_BASE + (score * 0.05);
    const rpmX = 100; // Player horizontal fixed position
    const playerRadius = 20; // Hitbox radius approx

    for (let i = s.gates.length - 1; i >= 0; i--) {
        const g = s.gates[i];
        g.x -= speed;

        if (g.x < -100) {
            s.gates.splice(i, 1);
            continue;
        }

        if (rpmX + playerRadius > g.x && rpmX - playerRadius < g.x + g.width) {
            if (s.rpmY - playerRadius < g.y || s.rpmY + playerRadius > g.y + g.safeHeight) {
                triggerGameOver();
            }
        }

        if (!g.passed && g.x + g.width < rpmX) {
            g.passed = true;
            setScore(prev => prev + 1);
            // @ts-ignore
            zzfx(...SND_SCORE);
        }
    }

    // 5. Boundary Checks
    const groundLevel = GAME_HEIGHT - 40;
    if (s.rpmY < 0 || s.rpmY > groundLevel - 20) {
        triggerGameOver();
    }

    // 6. Visuals Logic
    s.bgOffset = (s.bgOffset + speed) % 60;
    
    s.clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.width < 0) {
            c.x = GAME_WIDTH;
            c.y = Math.random() * (GAME_HEIGHT/2);
        }
    });

    // Particles Update
    for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.type === 'SMOKE') p.size += 0.5; 
        if (p.type === 'FLAME') { p.size *= 0.9; p.color = p.life < 0.5 ? 'rgba(255,0,0,0.5)' : '#FFEB3B'; }

        p.life -= 0.02;
        if (p.life <= 0) s.particles.splice(i, 1);
    }

    if (s.shake > 0) s.shake *= 0.9;
    if (s.shake < 0.5) s.shake = 0;
  };

  const triggerGameOver = () => {
      const s = stateRef.current;
      s.gameOver = true;
      s.shake = 20;
      spawnParticles(100, s.rpmY, 'EXPLOSION');
      setGameState('GAME_OVER');
      stopEngineSound();
      // @ts-ignore
      zzfx(...SND_CRASH);
      
      if (score > highScore) {
          setHighScore(score);
          localStorage.setItem('agro_torque_highscore', score.toString());
      }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // --- 1. SKY (Gradient) ---
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(0.6, SKY_BOTTOM);
    grad.addColorStop(1, '#FFF3E0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // --- 2. CLOUDS ---
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    s.clouds.forEach(c => {
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, c.width, 25, 15);
        ctx.fill();
    });

    // --- 3. MOUNTAINS (Silhouettes) ---
    ctx.fillStyle = 'rgba(62, 39, 35, 0.2)'; // Faint brown
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT - 40);
    for(let i=0; i<=GAME_WIDTH; i+=100) {
        ctx.lineTo(i, GAME_HEIGHT - 40 - Math.random()*20 - 30); 
    }
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT - 40);
    ctx.fill();

    // Shake Context from here
    ctx.save();
    if (s.shake > 0) {
        ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);
    }

    // --- 4. GATES (Fence Posts & TORQUE ZONE) ---
    s.gates.forEach(g => {
        // TORQUE ZONE (Green Light)
        ctx.fillStyle = 'rgba(118, 255, 3, 0.25)'; // Neon Green Transparent
        ctx.fillRect(g.x, g.y, g.width, g.safeHeight);
        
        // Glow edges for zone
        ctx.strokeStyle = 'rgba(118, 255, 3, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + g.width, g.y); // Top line
        ctx.moveTo(g.x, g.y + g.safeHeight); ctx.lineTo(g.x + g.width, g.y + g.safeHeight); // Bottom line
        ctx.stroke();


        // Posts Function
        const drawPost = (py: number, ph: number) => {
             // Main Wood
             ctx.fillStyle = POST_COLOR;
             ctx.fillRect(g.x, py, g.width, ph);
             // Details (Wood grain)
             ctx.fillStyle = POST_DARK;
             ctx.fillRect(g.x + 10, py, 5, ph);
             ctx.fillRect(g.x + 40, py, 2, ph);
             // Border
             ctx.strokeStyle = '#3E2723';
             ctx.lineWidth = 2;
             ctx.strokeRect(g.x, py, g.width, ph);
        };

        // Top Post
        drawPost(0, g.y);
        // Bottom Post
        drawPost(g.y + g.safeHeight, GAME_HEIGHT - (g.y + g.safeHeight));
    });

    // --- 5. GROUND (Parallax Strip) ---
    const groundY = GAME_HEIGHT - 40;
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, groundY, GAME_WIDTH, 40);
    
    // Diagonal Stripes
    ctx.fillStyle = GROUND_STRIPE;
    ctx.beginPath();
    for (let i = -60; i < GAME_WIDTH + 60; i += 40) {
        // Move stripes with bgOffset
        const x = i - s.bgOffset; 
        ctx.moveTo(x, groundY);
        ctx.lineTo(x + 20, groundY + 40);
        ctx.lineTo(x + 10, groundY + 40);
        ctx.lineTo(x - 10, groundY);
    }
    ctx.fill();
    // Grass Top Border
    ctx.fillStyle = '#7CB342';
    ctx.fillRect(0, groundY, GAME_WIDTH, 5);

    // --- 6. PARTICLES ---
    s.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // --- 7. TRACTOR (Hero) ---
    const rpmX = 100;
    ctx.save();
    ctx.translate(rpmX, s.rpmY);
    ctx.rotate(s.tractorRotation); // Pitch up/down

    ctx.scale(0.8, 0.8);

    // Exhaust Pipe
    ctx.fillStyle = '#424242';
    ctx.fillRect(15, -35, 6, 20); 

    // Rear Wheel
    ctx.fillStyle = TRACTOR_ACCENT;
    ctx.beginPath(); ctx.arc(-20, 15, 22, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFEB3B'; 
    ctx.beginPath(); ctx.arc(-20, 15, 10, 0, Math.PI*2); ctx.fill();

    // Front Wheel
    ctx.fillStyle = TRACTOR_ACCENT;
    ctx.beginPath(); ctx.arc(35, 25, 12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFEB3B';
    ctx.beginPath(); ctx.arc(35, 25, 5, 0, Math.PI*2); ctx.fill();

    // Chassis
    ctx.fillStyle = TRACTOR_RED;
    ctx.beginPath();
    ctx.moveTo(-10, -15);
    ctx.lineTo(40, -10); 
    ctx.lineTo(40, 20);
    ctx.lineTo(-20, 20);
    ctx.fill();
    
    // Cabin
    ctx.fillStyle = '#FFF'; 
    ctx.fillRect(-35, -45, 30, 5);
    ctx.fillStyle = 'rgba(200,230,255,0.6)'; 
    ctx.fillRect(-30, -40, 25, 25);
    // Pillars
    ctx.fillStyle = TRACTOR_RED;
    ctx.fillRect(-32, -40, 4, 25); 
    ctx.fillRect(-10, -40, 4, 25); 

    // Mudguard
    ctx.fillStyle = TRACTOR_RED;
    ctx.beginPath();
    ctx.arc(-20, 15, 26, Math.PI, 0); 
    ctx.fill();

    ctx.restore(); // End Tractor Transform

    ctx.restore(); // End Shake

    // --- 8. UI: RPM GAUGE (Left Side) ---
    const gaugeX = 10;
    const gaugeY = 50;
    const gaugeH = GAME_HEIGHT - 100;

    // Background Bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(gaugeX, gaugeY, RPM_GAUGE_WIDTH, gaugeH);

    // Gradient Fill (Green -> Yellow -> Red)
    const gaugeGrad = ctx.createLinearGradient(0, gaugeY + gaugeH, 0, gaugeY);
    gaugeGrad.addColorStop(0, '#76FF03'); // Green Bottom
    gaugeGrad.addColorStop(0.5, '#FFEB3B'); // Yellow Middle
    gaugeGrad.addColorStop(0.85, '#FF3D00'); // Red High
    gaugeGrad.addColorStop(1, '#D50000'); // Deep Red Top

    ctx.fillStyle = gaugeGrad;
    ctx.fillRect(gaugeX + 4, gaugeY + 4, RPM_GAUGE_WIDTH - 8, gaugeH - 8);

    // Tick Marks
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for(let i=0; i<10; i++) {
        const y = gaugeY + (gaugeH / 10) * i;
        ctx.fillRect(gaugeX + 4, y, RPM_GAUGE_WIDTH - 8, 1);
    }

    // Needle / Indicator
    const needleY = Math.max(gaugeY, Math.min(gaugeY + gaugeH, s.rpmY));
    // Triangle Pointer
    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gaugeX + RPM_GAUGE_WIDTH + 5, needleY);
    ctx.lineTo(gaugeX + RPM_GAUGE_WIDTH + 15, needleY - 5);
    ctx.lineTo(gaugeX + RPM_GAUGE_WIDTH + 15, needleY + 5);
    ctx.fill();
    ctx.stroke();

    // Text "RPM x100"
    ctx.save();
    ctx.translate(gaugeX - 5, gaugeY + gaugeH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText("RPM x100", 0, 0);
    ctx.restore();

    // --- 9. UI: SCORE ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#FFF';
    
    ctx.font = '900 48px monospace';
    ctx.strokeText(score.toString(), GAME_WIDTH/2, 20);
    ctx.fillText(score.toString(), GAME_WIDTH/2, 20);
    
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.strokeText(`RECORD: ${highScore}`, GAME_WIDTH/2, 70);
    ctx.fillText(`RECORD: ${highScore}`, GAME_WIDTH/2, 70);

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
  }, [gameState, score]);

  // --- Supabase Logic ---
  const fetchHighScores = async () => {
    setIsLoadingRanking(true);
    const { data } = await supabase.from('game_scores').select('*').eq('game_id', 'torque_master').order('score', { ascending: false }).limit(10);
    setHighScoresList(data || []);
    setIsLoadingRanking(false);
  };
  const handleSaveScore = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    await supabase.from('game_scores').insert([{
      game_id: 'torque_master', player_name: formData.name.trim().toUpperCase(), company_name: formData.company.trim().toUpperCase(), phone: formData.phone, score: score
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
       <div className="relative group shadow-2xl overflow-hidden rounded-xl border-4 border-[#3E2723]">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            onPointerDown={handleInput}
            className="bg-[#81D4FA] w-auto h-auto max-h-[70vh] object-contain touch-none cursor-pointer"
          />

          {gameState === 'MENU' && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm p-6 text-center animate-fade-in pointer-events-none">
                <h1 className="text-5xl font-black text-white font-tech uppercase mb-2 drop-shadow-[0_4px_0_#000]">
                  Torque Master
                </h1>
                <p className="text-white font-bold mb-8 font-mono text-lg shadow-black drop-shadow-md">
                  Controle a Rotação.<br/>Mantenha o ponteiro na FAIXA VERDE.
                </p>
                <div className="px-8 py-3 bg-[#D32F2F] text-white font-bold uppercase animate-bounce rounded-full border-4 border-white pointer-events-auto cursor-pointer shadow-lg">
                  LIGAR MOTOR
                </div>
             </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
               {!isScoreSaved ? (
                 <div className="w-full max-w-sm flex flex-col justify-center h-full">
                    <h2 className="text-3xl font-black text-[#D32F2F] font-tech uppercase mb-2">MOTOR FUNDIDO!</h2>
                    <div className="text-6xl font-mono text-white mb-6 font-bold">{score}</div>
                    
                    <p className="text-white text-xs mb-4 uppercase">Salvar Ranking</p>
                    
                    <div className="flex flex-col gap-2 mb-4">
                       <input type="text" name="name" placeholder="Nome" value={formData.name} onChange={handleInputChange} className="bg-gray-800 p-3 rounded text-white border border-gray-600 font-bold" />
                       <input type="text" name="company" placeholder="Empresa" value={formData.company} onChange={handleInputChange} className="bg-gray-800 p-3 rounded text-white border border-gray-600 font-bold" />
                    </div>
                    <button onClick={handleSaveScore} disabled={!formData.name} className="bg-[#558B2F] p-3 rounded text-white font-bold uppercase mb-2 border-b-4 border-[#33691E] active:border-0 active:translate-y-1 transition-all">Registrar Ponto</button>
                    <button onClick={initGame} className="text-gray-400 text-xs uppercase hover:text-white mt-2">Tentar Novamente</button>
                 </div>
               ) : (
                 <div className="w-full h-full flex flex-col">
                    <h3 className="text-[#FFCC80] font-bold uppercase mb-4 font-tech text-xl">Top Motoristas</h3>
                    <div className="flex-grow overflow-y-auto mb-4 bg-white/10 p-2 rounded border border-white/20">
                       {isLoadingRanking ? <p className="text-white">Carregando...</p> : (
                         <table className="w-full text-left text-xs text-white font-mono font-bold">
                           <tbody>
                             {highScoresList.map((e, i) => (
                               <tr key={i} className="border-b border-white/10"><td className="py-2 pl-2 text-[#FFCC80]">{i+1}.</td><td className="py-2">{e.player_name}</td><td className="text-right pr-2">{e.score}</td></tr>
                             ))}
                           </tbody>
                         </table>
                       )}
                    </div>
                    <button onClick={initGame} className="w-full py-4 bg-white text-black font-black uppercase font-tech text-lg hover:bg-[#FFCC80] transition-colors rounded">Nova Bateria</button>
                 </div>
               )}
            </div>
          )}
       </div>
    </div>
  );
};

export default TorqueMasterCanvas;