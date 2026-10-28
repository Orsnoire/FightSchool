// Browser-only review fixture; no application route or production bundle import.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { TerrainTile } from '../../client/src/features/campaign/CampaignMap';
import { BORDER_MASKS } from '../../client/src/features/campaign/autotiles';
import '../../client/src/pages/campaign.css';

export async function renderBorderSheet() {
  const root = document.createElement('div'); document.body.replaceChildren(root);
  document.body.style.cssText = 'background:#14221e;color:#f5e6bd;padding:32px;font-family:system-ui';
  createRoot(root).render(<main><h1 style={{fontSize:28,marginBottom:24}}>Connected terrain · 47 arrangements per material</h1>
    {['mountain','wall','forest'].map(kind => <section key={kind} style={{marginBottom:32}}>
      <h2 style={{fontSize:22,marginBottom:12}}>{kind === 'wall' ? 'Cave walls' : kind === 'mountain' ? 'Overworld mountain border' : 'Forest'}</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(12,64px)',gap:12}}>{BORDER_MASKS.map(mask => <div key={mask} data-review-mask={mask}>
        <div style={{position:'relative',width:64,height:64,background:kind==='wall'?'#677388':'#607a3f'}}><TerrainTile kind={kind} mask={mask}/></div><small>{String(mask).padStart(3,'0')}</small>
      </div>)}</div>
    </section>)}
  </main>);
}
