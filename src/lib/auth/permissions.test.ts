import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESIGN_GENERAL_PERMISSIONS } from './permissions';

describe('GENERAL design permission catalog and seed', () => {
  it('declares exactly the five approved permissions without duplicates', () => {
    expect(DESIGN_GENERAL_PERMISSIONS).toEqual([
      'design.general.start',
      'design.general.deliver',
      'design.general.deliverable.upload',
      'design.general.priority.update',
      'design.general.cancellation.resolve',
    ]);
    expect(new Set(DESIGN_GENERAL_PERMISSIONS).size).toBe(DESIGN_GENERAL_PERMISSIONS.length);
  });

  it('registers the permissions and grants them only through the design role', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261115000100_design_general_specific_permissions.sql'), 'utf8');
    for (const permission of DESIGN_GENERAL_PERMISSIONS) expect(sql).toContain(`'${permission}'`);
    expect(sql).toContain("select 'design', permission.code");
    expect(sql).not.toMatch(/select\s+'admin'\s*,\s*permission\.code/i);
  });

  it('excludes only the five new permissions from the admin seed grant', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/seed.sql'), 'utf8');
    const adminGrant = sql.match(/insert into public\.role_permissions \(role_code, permission_code\)[\s\S]*?on conflict do nothing;/i)?.[0];
    expect(adminGrant).toBeDefined();
    expect(adminGrant).toContain("select 'admin', code");
    expect(adminGrant).toContain('where code not in');
    for (const permission of DESIGN_GENERAL_PERMISSIONS) expect(adminGrant).toContain(`'${permission}'`);
  });
});
