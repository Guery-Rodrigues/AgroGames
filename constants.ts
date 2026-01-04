// Visual Identity
export const COLORS = {
  primary: '#FF6700', // Vibrant Orange
  background: '#2C3E50', // Lead/Dark Grey
  ground: '#5D4037', // Earth Brown
  groundDark: '#4E342E', // Darker Earth for scrolling effect
  weed: '#4CAF50', // Green
  weedDark: '#2E7D32',
  spray: 'rgba(0, 255, 255, 0.6)', // Semi-transparent Cyan
  text: '#FFFFFF',
  danger: '#E74C3C',
};

// Game Dimensions (Internal resolution)
export const GAME_WIDTH = 400; // Reduced width as requested
export const GAME_HEIGHT = 800;

// Game Mechanics
export const PLAYER_WIDTH = 50;
export const PLAYER_HEIGHT = 80;
export const PLAYER_SPEED = 7;

export const WEED_RADIUS = 20;
export const INITIAL_WEED_SPEED = 3;
export const SPAWN_RATE_INITIAL = 60; // Frames between spawns

export const SPRAY_WIDTH = 120; // Wider spray for "Boom/Barra" feel
export const SPRAY_HEIGHT = 60;
export const SPRAY_DURATION = 15; // Frames (approx 250ms at 60fps)

export const POINTS_PER_KILL = 10;
export const POINTS_TO_INCREASE_DIFFICULTY = 100;
export const INITIAL_LIVES = 3;