import type {CharacterClass} from '@shared/schema';
import {equipmentPermissions} from '@shared/equipment-rules';
import { AA_CATALOG, type AARanks } from '@shared/aa';
export function EquipmentPermissions({job,ranks={}}:{job:CharacterClass;ranks?:AARanks}) {
 const permissions=equipmentPermissions(job,ranks);
 const armorLicenses=AA_CATALOG.filter(upgrade=>upgrade.kind==='armor'&&(ranks[upgrade.id]||0)>0);
 return <section aria-label="Equipment permissions" className="rounded-md border p-3 text-sm space-y-1">
  <p><strong>Allowed weapons:</strong> {permissions.weapons.join(', ')}</p>
  <p><strong>Allowed armor:</strong> {permissions.armor.join(', ')}</p>
  {!!armorLicenses.length && <p><strong>AA armor access:</strong> {armorLicenses.map(upgrade=>upgrade.name).join(', ')}</p>}
  <p><strong>Allowed off hands:</strong> {permissions.offhands.length ? permissions.offhands.join(', ') : 'None'}</p>
  <p className="text-xs text-muted-foreground">Armor rules apply to head, chest, arms, hands, pants and feet. Shields pair with swords, quivers with bows, potion off hands with herbs, and spell books with wands. Two-handed swords cannot use an off hand.</p>
 </section>;
}
