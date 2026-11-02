import { Database } from '../database.types';
import { CanalEnum } from '../enums';

// Tipos base directos de la base de datos
export type Publicacion = Database['public']['Tables']['publicaciones']['Row'];
export type PublicacionInsert = Database['public']['Tables']['publicaciones']['Insert'];
export type PublicacionUpdate = Database['public']['Tables']['publicaciones']['Update'];

export type ChecklistRodaje = Database['public']['Tables']['checklist_rodaje']['Row'];
export type PublicacionCanal = Database['public']['Tables']['publicacion_canales']['Row'];
export type SocialAccount = Database['public']['Tables']['social_accounts']['Row'];

export interface SocialAccountOption {
  id: string;
  platform: CanalEnum;
  handle: string;
  display_name: string;
  active: boolean;
}

export function isSocialAccountPlatform(
  platform: Database['public']['Enums']['canal_enum'],
): platform is CanalEnum {
  return platform !== 'YOUTUBE_SHORTS';
}

export function toSocialAccountOptions(
  accounts: Pick<SocialAccount, 'id' | 'platform' | 'handle' | 'display_name' | 'active'>[],
): SocialAccountOption[] {
  return accounts.flatMap((account) =>
    isSocialAccountPlatform(account.platform)
      ? [{
          id: account.id,
          platform: account.platform,
          handle: account.handle,
          display_name: account.display_name,
          active: account.active,
        }]
      : [],
  );
}

export interface PublicacionConCuentas extends Publicacion {
  social_account_ids: string[];
}

// Tipos Extendidos / DTOs para Frontend y Server Actions
export interface PublicacionConDetalles extends Publicacion {
  canales?: PublicacionCanal[];
  checklist?: ChecklistRodaje[];
}
