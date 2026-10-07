/** Lightweight vector scenery: no texture downloads or per-frame canvas work. */
export function BattleScenery() {
  return <svg className="battle-scenery" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="battle-sky" x2="0" y2="1"><stop stopColor="#9ccbd0"/><stop offset="1" stopColor="#e6ead1"/></linearGradient>
      <linearGradient id="battle-meadow" x2="0" y2="1"><stop stopColor="#a3b966"/><stop offset="1" stopColor="#566e46"/></linearGradient>
      <radialGradient id="battle-light"><stop stopColor="#fff7d3" stopOpacity=".5"/><stop offset="1" stopColor="#fff7d3" stopOpacity="0"/></radialGradient>
    </defs>
    <path fill="url(#battle-sky)" d="M0 0h1600v900H0z"/>
    <ellipse cx="1080" cy="180" rx="580" ry="310" fill="url(#battle-light)"/>
    <g fill="#f4f3df" opacity=".52"><path d="M640 160q48-40 105-5 53-65 130-11 53-18 88 21H640z"/><path d="M170 87q65-43 104 0 59-14 90 22H135z"/></g>
    <path fill="#8faeae" d="M0 374 173 241l115 98 220-191 155 161 163-203 208 252 110-77 218 125 238-161v303H0z"/>
    <path fill="#cad4c2" d="m431 215 77-67 60 62-43-14-16 24-27-24zM754 205l72-99 98 119-53-36-44 15-13-49z"/>
    <path fill="#779889" d="M0 399q180-86 347 13 226-94 473 8 155-75 366-7 260-129 414-34v213H0z"/>
    <path fill="#849e67" d="M0 464q217-70 425 23 191-70 394-12 185-44 345-17 206-91 436 14v428H0z"/>
    <path fill="url(#battle-meadow)" d="M0 520q365-67 750 16 442-99 850 2v362H0z"/>
    <path fill="#c4c08a" opacity=".18" d="M838 484q-237 176-64 416h461q-391-268-240-409z"/>
    <g fill="#4e7562"><path d="M-15 552 29 354l51 188zM89 535l56-267 62 267zM227 528l40-177 40 177zM1340 478l42-160 43 160zM1430 492l54-207 58 207zM1520 510l60-223 59 223z"/></g>
    <g fill="#385c4c"><path d="M-20 572 40 293l70 279zM108 557l55-255 62 255zM-5 663 69 383l70 280z"/></g>
    <path fill="#5c7144" opacity=".6" d="M0 825q365-33 687 42 497-78 913-11v44H0z"/>
    <g fill="none" stroke="#3d5f40" strokeWidth="3" opacity=".35"><path d="m111 754-8-18m8 18 6-13m322 52-6-12m6 12 9-20m894-66-7-20m7 20 10-12m-259 196-5-19m5 19 9-15m479-59-8-17"/></g>
  </svg>;
}
