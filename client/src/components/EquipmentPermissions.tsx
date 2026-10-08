import type {CharacterClass} from '@shared/schema';
import {equipmentPermissions} from '@shared/equipment-rules';
export function EquipmentPermissions({job}:{job:CharacterClass}) {
 const permissions=equipmentPermissions(job);
 return <section aria-label="Equipment permissions" className="rounded-md border p-3 text-sm space-y-1">
  <p><strong>Allowed weapons:</strong> {permissions.weapons.join(', ')}</p>
  <p><strong>Allowed armor:</strong> {permissions.armor.join(', ')}</p>
  <p><strong>Allowed off hands:</strong> {permissions.offhands.length ? permissions.offhands.join(', ') : 'None'}</p>
  <p className="text-xs text-muted-foreground">Armor rules apply to head, chest, arms, hands, pants and feet. Shields pair with swords, quivers with bows, and potion off hands with herbs. Two-handed swords cannot use an off hand.</p>
 </section>;
}
