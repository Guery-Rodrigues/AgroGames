import React, { useRef, useEffect, useState } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { supabase, ScoreEntry } from '../supabaseClient';

// --- ZzFX Micro-library ---
// @ts-ignore
let zzfxX: AudioContext | null = null;
// @ts-ignore
const zzfx = (...t)=>{let e=zzfxX||new(window.AudioContext||window.webkitAudioContext);zzfxX=e;let s=e.createBufferSource(),r=e.createBuffer(1,t.length,44100);t.map((e,t)=>r.getChannelData(0)[t]=e),s.buffer=r,s.connect(e.destination),s.start()};

// Sounds
const SND_CLICK_SWITCH = [1.1,,150,.01,.01,.05,,1.1,-5.6,,,,,.1,,.1,,.53,.07]; // Mechanical click
const SND_ERROR        = [0.9,,133,.03,.33,.53,4,2.5,-0.6,.2,,,,,1.3,,.2,.16,.71]; // Harsh Buzz
const SND_SPRAY_LOOP   = [0.1,,377,.03,.06,.23,3,1.69,-6.4,,,,,.6,,.5,,.63,.06]; // Hiss

// --- Visual Constants (Agro Pro) ---
const COLOR_SOIL_BASE   = '#2e7d32'; // Base Crop Green
const COLOR_SOIL_DARK   = '#1b5e20'; // Planting Rows
const COLOR_WET_CROP    = 'rgba(0, 30, 0, 0.4)'; // Unified Dark Wet Look

// Heatmap Overlay (Transparent)
const COLOR_DOSE_LOW    = 'rgba(255, 235, 59, 0.3)'; // Yellow Transparent
const COLOR_DOSE_MED    = 'rgba(255, 152, 0, 0.3)';  // Orange Transparent
const COLOR_DOSE_HIGH   = 'rgba(244, 67, 54, 0.3)';  // Red Transparent

// Machine Palette
const MACHINE_BODY      = '#2E7D32'; // Modern Green
const MACHINE_HOOD      = '#1B5E20'; // Darker Green
const MACHINE_ACCENT    = '#FFC107'; // Gold/Yellow
const MACHINE_GLASS     = '#81D4FA'; 
const MACHINE_TIRE      = '#1a1a1a';
const MACHINE_STRUT     = '#37474F'; // Suspension Arms
const BOOM_COLOR        = '#212121'; // Carbon Fiber look

const TRACTOR_Y = GAME_HEIGHT - 250; // Machine position
const BOOM_WIDTH_PCT = 0.85;

type DoseType = 'LOW' | 'MED' | 'HIGH';

interface MapZone {
  y: number;
  height: number;
  type: DoseType;
}

interface TrailSegment {
  y: number;
  height: number;
  status: 'TREATED' | 'BURNT';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  alpha: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
}

const VariableRateMasterCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Audio Refs
  const engineOscRef = useRef<OscillatorNode | null>(null);
  const engineGainRef = useRef<GainNode | null>(null);

  // UI State
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAME_OVER'>('MENU');
  const [score, setScore] = useState(0);
  const [efficiency, setEfficiency] = useState(100);
  const [highScore, setHighScore] = useState(0);
  const [currentDose, setCurrentDose] = useState<DoseType>('LOW');

  // Form / Supabase
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [isScoreSaved, setIsScoreSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [highScoresList, setHighScoresList] = useState<ScoreEntry[]>([]);

  // Mutable Game State
  const stateRef = useRef({
    mapZones: [] as MapZone[],
    trail: [] as TrailSegment[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    scrollSpeed: 5,
    distanceTraveled: 0,
    shake: 0,
    gameOver: false,
    lastZoneY: 0,
    difficultyTimer: 0,
    bgOffset: 0,
    isSpraying: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('variable_rate_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
    return () => stopEngine();
  }, []);

  // --- Audio Engine ---
  const startEngine = () => {
    if (!window.AudioContext && !(window as any).webkitAudioContext) return;
    const ctx = zzfxX || new (window.AudioContext || (window as any).webkitAudioContext)();
    // @ts-ignore
    zzfxX = ctx; // Ensure global context is set

    if (!engineOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 60; // Low rumble
        gain.gain.value = 0.05; // Quiet background
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        engineOscRef.current = osc;
        engineGainRef.current = gain;
    }
  };

  const stopEngine = () => {
      if (engineOscRef.current) {
          engineOscRef.current.stop();
          engineOscRef.current.disconnect();
          engineOscRef.current = null;
      }
  };

  // --- Game Logic ---
  const initGame = () => {
    stateRef.current = {
      mapZones: [],
      trail: [],
      particles: [],
      floatingTexts: [],
      scrollSpeed: 5,
      distanceTraveled: 0,
      shake: 0,
      gameOver: false,
      lastZoneY: 0,
      difficultyTimer: 0,
      bgOffset: 0,
      isSpraying: true
    };

    // Fill initial map
    let currentY = -GAME_HEIGHT; 
    while (currentY < GAME_HEIGHT) {
        addZone(currentY);
        currentY = stateRef.current.lastZoneY;
    }

    setScore(0);
    setEfficiency(100);
    setCurrentDose('LOW');
    setGameState('PLAYING');
    setIsScoreSaved(false);
    startEngine();
  };

  const addZone = (startY: number) => {
    const s = stateRef.current;
    const minH = Math.max(150, 350 - (s.distanceTraveled * 0.01)); 
    const maxH = Math.max(250, 600 - (s.distanceTraveled * 0.01));
    const height = Math.random() * (maxH - minH) + minH;
    
    const types: DoseType[] = ['LOW', 'MED', 'HIGH'];
    const prevType = s.mapZones.length > 0 ? s.mapZones[s.mapZones.length-1].type : null;
    let type = types[Math.floor(Math.random() * types.length)];
    
    if (type === prevType && Math.random() > 0.6) {
         type = types.find(t => t !== prevType) || 'LOW';
    }

    s.mapZones.push({ y: startY, height, type });
    s.lastZoneY = startY + height;
  };

  const spawnMist = (dose: DoseType) => {
    const s = stateRef.current;
    const boomWidth = GAME_WIDTH * BOOM_WIDTH_PCT;
    const startX = (GAME_WIDTH - boomWidth) / 2;
    
    // Density based on dose
    let density = 1;
    if (dose === 'MED') density = 3;
    if (dose === 'HIGH') density = 6;

    // Distribute particles along the boom
    for (let i = 0; i < density; i++) {
        // Random point on boom
        const px = startX + Math.random() * boomWidth;
        const py = TRACTOR_Y + 15;

        s.particles.push({
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 0.5, // Slight spread
            vy: 2 + Math.random() * 3, // Fast down speed (spray pressure)
            life: 1.0,
            size: 1 + Math.random() * 2,
            alpha: 0.6
        });
    }
  };

  const spawnFloatingText = (text: string) => {
      stateRef.current.floatingTexts.push({
          x: GAME_WIDTH / 2 + (Math.random()-0.5)*100,
          y: TRACTOR_Y - 50,
          text: text,
          life: 1.0
      });
  };

  const update = (dt: number) => {
    const s = stateRef.current;
    if (s.gameOver) return;

    // Difficulty
    s.difficultyTimer += dt;
    if (s.difficultyTimer > 8000) {
        s.scrollSpeed += 0.3;
        s.difficultyTimer = 0;
    }
    s.distanceTraveled += s.scrollSpeed;
    s.bgOffset = (s.bgOffset + s.scrollSpeed) % 40; // Row spacing

    // Map Management
    if (s.mapZones.length > 0 && s.mapZones[0].y > GAME_HEIGHT) {
        s.mapZones.shift();
    }
    s.mapZones.forEach(z => z.y += s.scrollSpeed);

    // Infinite Map Generation (Top down)
    // Find min Y
    const minY = s.mapZones.reduce((min, z) => Math.min(min, z.y), 10000);
    if (minY > -100) {
        const height = Math.random() * 300 + 200;
        const types: DoseType[] = ['LOW', 'MED', 'HIGH'];
        s.mapZones.push({
            y: minY - height,
            height: height,
            type: types[Math.floor(Math.random() * 3)]
        });
        // Sort just in case order gets messed up
        s.mapZones.sort((a, b) => b.y - a.y); // Draw bottom first? No, position logic handles it
    }

    // Logic Check
    const activeZone = s.mapZones.find(z => z.y <= TRACTOR_Y && z.y + z.height > TRACTOR_Y);
    let status: 'TREATED' | 'BURNT' = 'TREATED';
    
    if (activeZone) {
        if (activeZone.type === currentDose) {
            setScore(prev => prev + 1);
            if (efficiency < 100) setEfficiency(prev => Math.min(100, prev + 0.02));
        } else {
            // ERROR
            status = 'BURNT';
            setEfficiency(prev => prev - 0.2);
            s.shake = 2;
            if (Math.random() > 0.95 && s.floatingTexts.length < 2) {
                spawnFloatingText("ERRO DE DOSE!");
                // @ts-ignore
                zzfx(...SND_ERROR);
            }
        }
    }

    // Trail Generation
    // We add a segment at TRACTOR_Y representing what just happened
    s.trail.push({ y: TRACTOR_Y - s.scrollSpeed, height: s.scrollSpeed, status });
    
    s.trail.forEach(t => t.y += s.scrollSpeed);
    if (s.trail.length > 0 && s.trail[0].y > GAME_HEIGHT) s.trail.shift();

    // Particles (Mist)
    spawnMist(currentDose);
    for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05; // Fade fast
        p.size += 0.1; // Expand
        if (p.life <= 0) s.particles.splice(i, 1);
    }

    // Floating Text
    for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
        const t = s.floatingTexts[i];
        t.y -= 1;
        t.life -= 0.02;
        if (t.life <= 0) s.floatingTexts.splice(i, 1);
    }

    // Game Over
    if (efficiency <= 0) {
        s.gameOver = true;
        setGameState('GAME_OVER');
        stopEngine();
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('variable_rate_highscore', score.toString());
        }
    }

    if (s.shake > 0) s.shake *= 0.9;
    if (s.shake < 0.5) s.shake = 0;
  };

  const drawMachine = (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      // Machine Center
      const cx = GAME_WIDTH / 2;
      const cy = TRACTOR_Y - 40; // Body center offset

      // --- 1. SUSPENSION ARMS (STRUTS) ---
      // X-Shape connecting chassis to wheels
      ctx.strokeStyle = MACHINE_STRUT;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      const wheelBase = 60; // Forward/Back distance
      const trackWidth = 55; // Side distance

      ctx.beginPath();
      // Front Left to Center
      ctx.moveTo(cx - trackWidth, cy - wheelBase); ctx.lineTo(cx, cy - 20);
      // Front Right to Center
      ctx.moveTo(cx + trackWidth, cy - wheelBase); ctx.lineTo(cx, cy - 20);
      // Rear Left to Center
      ctx.moveTo(cx - trackWidth, cy + wheelBase); ctx.lineTo(cx, cy + 20);
      // Rear Right to Center
      ctx.moveTo(cx + trackWidth, cy + wheelBase); ctx.lineTo(cx, cy + 20);
      ctx.stroke();

      // --- 2. TIRES ---
      ctx.fillStyle = MACHINE_TIRE;
      const tireW = 14;
      const tireH = 38;

      const drawTire = (x: number, y: number) => {
          ctx.beginPath();
          ctx.roundRect(x - tireW/2, y - tireH/2, tireW, tireH, 4);
          ctx.fill();
          // Tread detail
          ctx.fillStyle = '#333';
          for(let i=0; i<3; i++) ctx.fillRect(x - tireW/2 + 2, y - tireH/2 + 6 + i*10, tireW-4, 4);
          ctx.fillStyle = MACHINE_TIRE;
      };

      drawTire(cx - trackWidth, cy + wheelBase); // Rear L
      drawTire(cx + trackWidth, cy + wheelBase); // Rear R
      drawTire(cx - trackWidth, cy - wheelBase); // Front L
      drawTire(cx + trackWidth, cy - wheelBase); // Front R

      // --- 3. BOOM (SPRAY BAR) ---
      const boomW = GAME_WIDTH * BOOM_WIDTH_PCT;
      const boomY = TRACTOR_Y;
      
      // Central Boom Mount
      ctx.fillStyle = '#333';
      ctx.fillRect(cx - 25, boomY - 10, 50, 10);

      // Main Truss
      ctx.fillStyle = BOOM_COLOR;
      ctx.fillRect(cx - boomW/2, boomY, boomW, 5);
      
      // Truss Details
      ctx.strokeStyle = '#607D8B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const trussGap = 15;
      for(let x = cx - boomW/2; x < cx + boomW/2; x += trussGap) {
          ctx.moveTo(x, boomY); ctx.lineTo(x + trussGap/2, boomY + 5);
          ctx.lineTo(x + trussGap, boomY);
      }
      ctx.stroke();

      // Nozzles
      ctx.fillStyle = '#CFD8DC';
      for(let x = cx - boomW/2; x <= cx + boomW/2; x += 10) {
          ctx.beginPath(); ctx.arc(x, boomY + 3, 1.5, 0, Math.PI*2); ctx.fill();
      }

      // --- 4. CHASSIS BODY (AERODYNAMIC) ---
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 25, 60, 0, 0, Math.PI*2);
      ctx.fill();

      // Main Hood (Sleek Shape)
      ctx.fillStyle = MACHINE_BODY;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 40); // Rear Left
      ctx.lineTo(cx - 18, cy);      // Mid Left
      ctx.lineTo(cx - 12, cy - 60); // Front Left
      ctx.quadraticCurveTo(cx, cy - 75, cx + 12, cy - 60); // Nose Curve
      ctx.lineTo(cx + 18, cy);      // Mid Right
      ctx.lineTo(cx + 15, cy + 40); // Rear Right
      ctx.closePath();
      ctx.fill();

      // Hood Detail (Darker Center)
      ctx.fillStyle = MACHINE_HOOD;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 65);
      ctx.lineTo(cx + 5, cy - 65);
      ctx.lineTo(cx + 8, cy - 10);
      ctx.lineTo(cx - 8, cy - 10);
      ctx.fill();

      // Vents
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(cx - 6, cy - 50, 12, 2);
      ctx.fillRect(cx - 7, cy - 45, 14, 2);
      ctx.fillRect(cx - 8, cy - 40, 16, 2);

      // --- 5. CABIN ---
      ctx.fillStyle = '#212121'; // Frame
      ctx.fillRect(cx - 18, cy - 25, 36, 30);
      
      // Windshield
      ctx.fillStyle = MACHINE_GLASS;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy - 23);
      ctx.lineTo(cx + 16, cy - 23);
      ctx.lineTo(cx + 14, cy + 2);
      ctx.lineTo(cx - 14, cy + 2);
      ctx.fill();

      // Roof
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.roundRect(cx - 19, cy - 15, 38, 24, 4);
      ctx.fill();

      // --- 6. TANK & REAR ---
      // Tank
      ctx.fillStyle = '#ECEFF1'; // White Plastic Tank
      ctx.beginPath();
      ctx.arc(cx, cy + 30, 16, 0, Math.PI*2);
      ctx.fill();
      
      // Yellow Cap
      ctx.fillStyle = MACHINE_ACCENT;
      ctx.beginPath(); ctx.arc(cx, cy + 30, 6, 0, Math.PI*2); ctx.fill();

      // --- 7. LIGHTS (HEADLIGHTS) ---
      ctx.globalCompositeOperation = 'screen';
      const drawLight = (x: number, y: number, angle: number) => {
          // Beam
          const grad = ctx.createLinearGradient(x, y, x + Math.sin(angle)*60, y + Math.cos(angle)*(-60));
          grad.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
          grad.addColorStop(1, 'rgba(255, 255, 200, 0)');
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 15, y - 60);
          ctx.lineTo(x + 15, y - 60);
          ctx.fill();

          // Bulb
          ctx.fillStyle = '#FFF';
          ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill();
      };
      
      drawLight(cx - 14, cy - 62, 0);
      drawLight(cx + 14, cy - 62, 0);
      ctx.globalCompositeOperation = 'source-over';

      ctx.restore();
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Apply Shake
    ctx.save();
    if (s.shake > 0) ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);

    // --- 1. SOIL BACKGROUND (Realistic Rows) ---
    ctx.fillStyle = COLOR_SOIL_BASE;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Planting Rows (Scroll Effect)
    ctx.fillStyle = COLOR_SOIL_DARK;
    const rowWidth = 4;
    const rowGap = 30;
    
    for (let x = 10; x < GAME_WIDTH; x += rowGap) {
        ctx.fillRect(x, 0, rowWidth, GAME_HEIGHT);
    }
    
    // --- 2. TRAIL (UNIFIED WET COLOR) ---
    // Ground looks "wet"/darker wherever spray passed, regardless of dose accuracy
    s.trail.forEach(t => {
        if (t.y < GAME_HEIGHT) {
            ctx.fillStyle = COLOR_WET_CROP;
            ctx.fillRect(0, t.y, GAME_WIDTH, t.height + 1);
        }
    });

    // --- 3. HEATMAP OVERLAY (Translucent GPS) ---
    ctx.save();
    ctx.globalAlpha = 0.4; // See-through
    s.mapZones.forEach(z => {
        if (z.y + z.height > 0 && z.y < GAME_HEIGHT) {
            ctx.fillStyle = z.type === 'LOW' ? 'yellow' : (z.type === 'MED' ? 'orange' : 'red');
            ctx.fillRect(0, z.y, GAME_WIDTH, z.height);
            
            // Grid lines to look like digital projection
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, z.y, GAME_WIDTH, z.height);
        }
    });
    ctx.restore();

    // --- 4. MACHINE ---
    drawMachine(ctx);

    // --- 5. MIST PARTICLES ---
    s.particles.forEach(p => {
        ctx.globalAlpha = p.alpha * p.life;
        ctx.fillStyle = '#E0F7FA'; // White mist
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // --- 6. FLOATING TEXT ---
    s.floatingTexts.forEach(t => {
        ctx.globalAlpha = t.life;
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 20px "Orbitron", sans-serif';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;

    ctx.restore(); // End Shake

    // --- 7. HUD ---
    // Efficiency Bar
    const effPct = efficiency / 100;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(10, 10, GAME_WIDTH - 20, 20);
    // Gradient Green to Red
    const barColor = effPct > 0.5 ? '#00E676' : '#FF1744';
    ctx.fillStyle = barColor;
    ctx.fillRect(12, 12, (GAME_WIDTH - 24) * effPct, 16);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`EFICIÊNCIA: ${Math.floor(efficiency)}%`, GAME_WIDTH/2, 23);
    
    // Score
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px "Orbitron", sans-serif';
    ctx.fillStyle = '#FFF';
    ctx.fillText(`SCORE: ${score}`, GAME_WIDTH - 20, 50);
  };

  const handleDoseChange = (dose: DoseType) => {
      setCurrentDose(dose);
      // @ts-ignore
      zzfx(...SND_CLICK_SWITCH);
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
  }, [gameState, efficiency, currentDose, score]); 

  // --- Supabase ---
  const fetchHighScores = async () => {
    setIsLoadingRanking(true);
    const { data } = await supabase.from('game_scores').select('*').eq('game_id', 'variable_rate').order('score', { ascending: false }).limit(10);
    setHighScoresList(data || []);
    setIsLoadingRanking(false);
  };
  const handleSaveScore = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    await supabase.from('game_scores').insert([{
      game_id: 'variable_rate', player_name: formData.name.trim().toUpperCase(), company_name: formData.company.trim().toUpperCase(), phone: formData.phone, score: score
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
       <div className="relative group shadow-2xl">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="bg-[#2e7d32] w-auto h-auto max-h-[60vh] object-contain border-4 border-[#1b5e20] shadow-xl"
          />

          {/* COMMAND ARM UI (3D BUTTONS) */}
          <div className="absolute bottom-0 w-full h-[120px] bg-[#263238] border-t-4 border-[#37474F] flex items-center justify-center gap-4 px-4 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
             
             {/* Yellow Button (Low) */}
             <button 
                className={`flex-1 h-20 rounded-lg font-tech font-bold text-xl text-black shadow-lg transition-all transform active:scale-95 border-b-8 
                ${currentDose === 'LOW' 
                   ? 'bg-[#FFEB3B] border-[#FBC02D] translate-y-1 shadow-[0_0_15px_#FFEB3B]' 
                   : 'bg-[#FDD835] border-[#F9A825] hover:bg-[#FFEE58]'}`}
                onPointerDown={() => handleDoseChange('LOW')}
             >
                LOW
                <div className="w-full h-1 bg-black/10 mt-1"></div>
             </button>

             {/* Orange Button (Med) */}
             <button 
                className={`flex-1 h-20 rounded-lg font-tech font-bold text-xl text-black shadow-lg transition-all transform active:scale-95 border-b-8 
                ${currentDose === 'MED' 
                   ? 'bg-[#FF9800] border-[#F57C00] translate-y-1 shadow-[0_0_15px_#FF9800]' 
                   : 'bg-[#FF9800] border-[#EF6C00] hover:bg-[#FFA726]'}`}
                onPointerDown={() => handleDoseChange('MED')}
             >
                MED
                <div className="w-full h-1 bg-black/10 mt-1"></div>
             </button>

             {/* Red Button (High) */}
             <button 
                className={`flex-1 h-20 rounded-lg font-tech font-bold text-xl text-white shadow-lg transition-all transform active:scale-95 border-b-8 
                ${currentDose === 'HIGH' 
                   ? 'bg-[#F44336] border-[#D32F2F] translate-y-1 shadow-[0_0_15px_#F44336]' 
                   : 'bg-[#EF5350] border-[#C62828] hover:bg-[#E57373]'}`}
                onPointerDown={() => handleDoseChange('HIGH')}
             >
                HIGH
                <div className="w-full h-1 bg-black/10 mt-1"></div>
             </button>
          </div>

          {gameState === 'MENU' && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-6 text-center animate-fade-in z-20">
                <h1 className="text-3xl font-black text-white font-tech uppercase mb-2 tracking-widest drop-shadow-[0_4px_0_#000]">
                  Variable Rate<br/><span className="text-[#00E676]">Pro</span>
                </h1>
                <div className="w-64 h-1 bg-gradient-to-r from-transparent via-[#00E676] to-transparent mb-6"></div>
                <p className="text-gray-300 mb-8 font-mono-hud text-sm bg-black/50 p-4 rounded border border-white/10">
                  <span className="text-[#FFEB3B] font-bold">AMARELO</span> = BAIXA DOSE<br/>
                  <span className="text-[#FF9800] font-bold">LARANJA</span> = MÉDIA DOSE<br/>
                  <span className="text-[#F44336] font-bold">VERMELHO</span> = ALTA DOSE
                </p>
                <button className="px-10 py-4 bg-[#00E676] text-black font-black text-xl uppercase animate-pulse rounded shadow-[0_0_20px_#00E676] hover:scale-105 transition-transform" onClick={initGame}>
                  LIGAR BOMBA
                </button>
             </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center p-6 z-20 animate-fade-in">
               {!isScoreSaved ? (
                 <div className="w-full max-w-sm flex flex-col justify-center h-full">
                    <h2 className="text-3xl font-black text-[#FF1744] font-tech uppercase mb-1 drop-shadow-[0_0_10px_red]">FALHA NA APLICAÇÃO</h2>
                    <div className="text-6xl font-mono text-white mb-6 font-bold">{score} <span className="text-sm text-gray-500">ha</span></div>
                    
                    <div className="flex flex-col gap-3 mb-6">
                       <input type="text" name="name" placeholder="OPERADOR" value={formData.name} onChange={handleInputChange} className="bg-gray-800 p-4 rounded text-white border border-gray-700 font-mono text-sm uppercase focus:border-[#00E676] outline-none" />
                       <input type="text" name="company" placeholder="FAZENDA" value={formData.company} onChange={handleInputChange} className="bg-gray-800 p-4 rounded text-white border border-gray-700 font-mono text-sm uppercase focus:border-[#00E676] outline-none" />
                    </div>
                    <button onClick={handleSaveScore} disabled={!formData.name} className="bg-[#00E676] text-black p-4 rounded font-bold uppercase mb-2 hover:bg-green-400 font-tech shadow-lg">REGISTRAR MAPA</button>
                    <button onClick={initGame} className="text-gray-500 text-xs uppercase hover:text-white mt-4 font-bold tracking-widest">REINICIAR SISTEMA</button>
                 </div>
               ) : (
                 <div className="w-full h-full flex flex-col">
                    <h3 className="text-[#00E676] font-bold uppercase mb-4 font-tech tracking-wider text-sm border-b border-gray-800 pb-2">RANKING DE EFICIÊNCIA</h3>
                    <div className="flex-grow overflow-y-auto mb-4 bg-gray-900/50 p-2 border border-gray-800 rounded">
                       {isLoadingRanking ? <p className="text-[#00E676] font-mono text-xs p-4">CARREGANDO...</p> : (
                         <table className="w-full text-left text-xs text-gray-400 font-mono">
                           <tbody>
                             {highScoresList.map((e, i) => (
                               <tr key={i} className="border-b border-gray-800 hover:bg-green-900/20"><td className="py-3 pl-2 text-white">{i+1}.</td><td className="py-3"><span className="text-gray-300 font-bold">{e.player_name}</span></td><td className="text-right pr-2 text-[#00E676]">{e.score}</td></tr>
                             ))}
                           </tbody>
                         </table>
                       )}
                    </div>
                    <button onClick={initGame} className="w-full py-4 bg-white text-black font-bold uppercase font-tech hover:bg-[#00E676] hover:text-white transition-colors">NOVA APLICAÇÃO</button>
                 </div>
               )}
            </div>
          )}
       </div>
    </div>
  );
};

export default VariableRateMasterCanvas;