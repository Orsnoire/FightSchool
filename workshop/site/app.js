(() => {
  const $ = id => document.getElementById(id), catalog = window.WORKSHOP_CATALOG;
  if (!catalog?.entries?.length) { $('status').textContent = 'The catalog could not load. Refresh the page to try again.'; return; }
  const entries = [...catalog.entries], localUrls = [];
  let selected;
  $('revision').textContent = catalog.revision;
  function show(entry) {
    selected = entry;
    $('title').textContent = entry.title;$('detail').textContent = entry.notes;
    $('type').hidden = false;$('type').textContent = entry.local ? 'Local ' + entry.kind : entry.kind;
    $('download').hidden = false;$('download').href = entry.url;
    $('viewer').replaceChildren();
    const element = document.createElement(entry.kind === 'workshop' ? 'iframe' : entry.kind === 'video' ? 'video' : 'img');
    if (entry.kind === 'workshop') { element.title = entry.title;element.setAttribute('sandbox', 'allow-scripts allow-downloads'); }
    if (entry.kind === 'video') { element.controls = true;element.loop = true;element.muted = true;element.playsInline = true; }
    if (entry.kind === 'image') element.alt = entry.title;
    element.src = entry.url;
    element.addEventListener('error', () => { $('status').textContent = 'This file could not load. Refresh or choose another file.'; });
    $('viewer').append(element);$('status').textContent = entry.kind === 'video' ? 'Use the video controls to play. Looping is enabled.' : entry.local ? 'Local preview only; nothing was uploaded.' : 'Selected: ' + entry.title;
    if (!entry.local) { const url = new URL(location.href);url.searchParams.set('asset',entry.id);history.replaceState(null,'',url); }
  }
  function filter() {
    const query = $('search').value.trim().toLowerCase(), kind = $('kind').value;
    const matches = entries.filter(e => (kind === 'all' || (kind === 'local' ? e.local : e.kind === kind)) && `${e.title} ${e.tags} ${e.notes}`.toLowerCase().includes(query));
    $('files').replaceChildren(...matches.map(e => new Option(e.title,e.id)));
    $('count').textContent = `${matches.length} of ${entries.length} files`;
    if (matches.some(e => e.id === selected?.id)) $('files').value = selected.id;
    else $('files').selectedIndex = -1;
    if (!matches.length) $('status').textContent = 'No matching files. Clear the search or change the file type.';
    return matches;
  }
  $('files').addEventListener('change', () => { const entry = entries.find(e => e.id === $('files').value);if (entry) show(entry); });
  $('search').addEventListener('input', filter);$('kind').addEventListener('change', filter);
  $('refresh').addEventListener('click', () => location.reload());
  $('import').addEventListener('change', event => {
    let first, skipped = 0;
    for (const file of event.target.files) {
      const extension = file.name.split('.').pop().toLowerCase();
      const kind = /^(html|htm)$/.test(extension) ? 'workshop' : /^(mp4|webm)$/.test(extension) ? 'video' : /^(png|jpg|jpeg|webp|gif)$/.test(extension) ? 'image' : null;
      if (!kind) { skipped++;continue; }
      const blob = /^(html|htm)$/.test(extension) ? new Blob([file],{type:'text/html'}) : file;
      const url = URL.createObjectURL(blob);localUrls.push(url);
      const entry = {id:'local-'+crypto.randomUUID(),title:file.name,kind,url,local:true,tags:'local '+extension,notes:'Local file preview. This file is available only in this tab and is not published.'};
      entries.push(entry);first ||= entry;
    }
    $('search').value='';$('kind').value='local';filter();
    if (first) { $('files').value=first.id;show(first); }
    if (skipped) $('status').textContent=`${skipped} unsupported file(s) skipped. Use workshop HTML, images, or videos.`;
    event.target.value='';
  });
  window.addEventListener('pagehide', () => localUrls.forEach(url => URL.revokeObjectURL(url)));
  filter();const initial = entries.find(e => e.id === new URL(location.href).searchParams.get('asset')) || entries[0];
  $('files').value=initial.id;show(initial);
})();
