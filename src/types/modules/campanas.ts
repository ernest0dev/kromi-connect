import { Database } from '../database.types';

export type Campana = Database['public']['Tables']['campanas']['Row'];
export type CampanaInsert = Database['public']['Tables']['campanas']['Insert'];
export type CampanaUpdate = Database['public']['Tables']['campanas']['Update'];

export type CampanaEvaluacion = Database['public']['Tables']['campana_evaluaciones']['Row'];