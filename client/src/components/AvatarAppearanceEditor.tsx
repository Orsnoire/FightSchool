import { CHANNELS, COLOR_FIELDS, PALETTES, type AvatarAppearance } from '@shared/avatar/appearance';
export function AvatarAppearanceEditor({ value, onChange, modelLocked=false }: { value:AvatarAppearance; onChange:(appearance:AvatarAppearance)=>void; modelLocked?:boolean }) {
  return <div className="grid grid-cols-2 gap-3">
    <label className="text-sm">Body model<select aria-label="Body model" className="block w-full mt-1 rounded border p-2 bg-background" value={value.modelId} disabled={modelLocked} onChange={e=>onChange({...value,modelId:e.target.value as AvatarAppearance['modelId']})}>
      <option value="human-male-v1">Male</option><option value="human-female-v1">Female</option>
    </select></label>
    {CHANNELS.map(channel=><label className="text-sm capitalize" key={channel}>{channel}<select aria-label={channel} className="block w-full mt-1 rounded border p-2 bg-background" value={value[COLOR_FIELDS[channel]]} onChange={e=>onChange({...value,[COLOR_FIELDS[channel]]:e.target.value})}>
      {PALETTES[channel].map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
    </select></label>)}
  </div>;
}
