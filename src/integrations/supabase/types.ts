// Tipos mínimos de compatibilidad durante migración Supabase -> ScorpionFlow.API
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = Record<string, never>;
