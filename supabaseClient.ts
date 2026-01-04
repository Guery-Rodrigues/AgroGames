import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Credenciais do Projeto Supabase
const supabaseUrl = 'https://nnvyivqsmbmjbdfcturf.supabase.co';
// Usamos a Publishable Key (anon key) para o frontend. 
// A Secret Key não deve ser exposta aqui por segurança.
const supabaseKey = 'sb_publishable_N6R2na656XP5WWnCkevSHw_D2lZ3pgi';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Tipagem para facilitar o uso nos componentes
export interface ScoreEntry {
  id?: number;
  game_id: 'weed_control' | 'memory_map' | 'torque_master' | 'drone_rush' | 'agro_panic' | 'variable_rate';
  player_name: string;
  company_name: string;
  phone?: string;
  score: number;
  created_at?: string;
}