/* LOCURA TOTAL PRODUCT CHECK — versión móvil: guardado de 6 fotos + instalación PWA.
   Complemento de la aplicación existente. No publica en TikTok Shop.
   Las fotografías se guardan en Supabase Storage, bucket privado locura-productos.
*/
(() => {
  'use strict';
  if (window.locuraAppLista) return;
  window.locuraAppLista = true;
  const $ = id => document.getElementById(id);
  const BUCKET = 'locura-productos';
  const MAX = 6;
  const selected = [];
  let saving = false;
  let reviewing = false;

  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = './manifest.webmanifest';
  document.head.append(manifest);
  const themeMeta = document.createElement('meta');
  themeMeta.name = 'theme-color';
  themeMeta.content = '#181321';
  document.head.append(themeMeta);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  function notify(message, error = false) {
    const box = $('message');
    if (!box) return;
    box.textContent = message;
    box.classList.toggle('danger', error);
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function textValue(id) { return String($(id)?.value || '').trim(); }
  function valueOrNull(id) { return textValue(id) || null; }
  const validPhoto = f => f && /^image\/(jpeg|png|webp)$/.test(f.type) && f.size <= 18*1024*1024;

  // «multifoto.js» borra el input al seleccionar fotos; capturamos los Files
  // en fase capture antes de que se limpien y seguimos los botones «Quitar foto».
  document.addEventListener('change', e => {
    if (e.target?.id !== 'multiPhotos') return;
    const added = [...(e.target.files || [])];
    selected.push(...added.filter(validPhoto).slice(0, Math.max(0, MAX - selected.length)));
  }, true);
  document.addEventListener('click', e => {
    const button = e.target?.closest?.('#multiThumbs button');
    if (!button) return;
    const parent = button.parentElement;
    const index = Array.prototype.indexOf.call(parent?.parentElement?.children || [], parent);
    if (index >= 0 && index < selected.length) selected.splice(index, 1);
  }, true);

  async function jpegFromFile(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const limit = 2048;
      const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
      if (!blob || blob.size > 10*1024*1024) throw new Error('Fotografía demasiado grande');
      return blob;
    } finally { bitmap.close(); }
  }

  async function saveProduct(e) {
    if (e.target?.id !== 'productForm') return;
    // Interceptamos antes del guardado antiguo para que NO se creen dos borradores.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (saving) return;
    const db = window.locuraDb;
    if (!db) { notify('Inicia sesión primero.', true); return; }
    if (!textValue('name')) { notify('Falta el nombre del producto.', true); return; }
    saving = true;
    const saveButton = $('saveBtn');
    if (saveButton) saveButton.disabled = true;
    try {
      const {data:auth, error:authError} = await db.auth.getUser();
      if (authError || !auth?.user?.id) throw new Error('Debes iniciar sesión para guardar.');

const fotosInternet =
  (window.locuraObtenerFotosWeb?.() || []).slice(0, 5);

const huecos = Math.max(0, MAX - fotosInternet.length);

const files = selected.length
  ? selected.slice(0, huecos)
  : [...($('photo')?.files || [])].slice(0, Math.min(1, huecos));

for (const [i, foto] of fotosInternet.entries()) {
  if (foto.archivo) {
    files.push(foto.archivo);
    continue;
  }

  try {
    notify('Preparando foto web ' + (i + 1));

   let blob;

try {
  const respuesta = await fetch(foto.url, {
    credentials: 'omit',
    signal: AbortSignal.timeout(15000)
  });

  if (!respuesta.ok) throw new Error();

  blob = await respuesta.blob();

  if (!validPhoto(blob)) throw new Error();

} catch {
  notify('Importando foto web ' + (i + 1) + ' desde Supabase...');

  const { data, error, response } =
    await db.functions.invoke('importar-foto-web', {
      body: { url: foto.url }
    });

if (error) {
  let motivo = error.message;

  try {
    const detalle = await error.context.clone().json();
    motivo = detalle.error || motivo;
  } catch {}

  throw new Error(motivo);
}

if (!(data instanceof Blob)) {
  throw new Error('Supabase no devolvió una imagen válida');
}

  const bytes = new Uint8Array(
    await data.slice(0, 12).arrayBuffer()
  );

  let tipo = response?.headers.get('X-Image-Type');

  if (!tipo) {
    if (bytes[0] === 255 && bytes[1] === 216) {
      tipo = 'image/jpeg';
    } else if (bytes[0] === 137 && bytes[1] === 80) {
      tipo = 'image/png';
    } else if (
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    ) {
      tipo = 'image/webp';
    }
  }

  blob = new Blob([data], { type: tipo || '' });

  if (!validPhoto(blob)) {
    throw new Error('Formato de imagen no compatible');
  }
}
    const archivo = new File(
      [blob],
      'foto-web-' + (i + 1),
      { type: blob.type }
    );

    if (!validPhoto(archivo)) throw new Error();

    files.push(archivo);

} catch (error) {
  const servidor = new URL(foto.url).hostname;

  throw new Error(
    'Foto web ' + (i + 1) +
    ' | Servidor: ' + servidor +
    ' | Motivo: ' + error.message
  );
}
}      const row = {
        name: textValue('name'), barcode: valueOrNull('barcode'), brand: valueOrNull('brand'),
        manufacturer: valueOrNull('manufacturer'),  
         model: valueOrNull('model'),
   weight: textValue('weight') === '' ? null : Number(textValue('weight')),
        price: textValue('price') === '' ? null : Number(textValue('price')),
        condition: textValue('condition'), auth: textValue('auth'),
        features: valueOrNull('features'), approved: false
      };
      notify('Guardando borrador en Supabase...');
      const {data:record, error:insertError} = await db.from('productos')
        .insert(row).select('id').single();
      if (insertError || !record?.id) throw new Error(insertError?.message || 'No se pudo guardar la ficha');
      const paths = [];
      const failures = [];
      for (let i = 0; i < files.length; i++) {
        try {
          notify(`Ficha guardada. Subiendo foto ${i+1} de ${files.length}...`);
          const blob = await jpegFromFile(files[i]);
          const path = `${auth.user.id}/${record.id}/foto-${i+1}-${Date.now()}.jpg`;
          const {error} = await db.storage.from(BUCKET).upload(path, blob, {
            contentType:'image/jpeg', cacheControl:'3600', upsert:false
          });
          if (error) throw error;
          paths.push(path);
        } catch (err) { failures.push(`Foto ${i+1}: ${err?.message || 'falló la subida'}`); }
      }
      let linked = true;
      if (paths.length) {
        const {error} = await db.from('productos').update({image_urls: paths}).eq('id', record.id);
        if (error) { linked = false; failures.push('No se pudieron asociar las fotos al borrador: '+error.message); }
      }
      // El borrador existe incluso si alguna foto no consiguió subirse.
      if (failures.length) {
        notify(`Borrador ${record.id} guardado, pero faltan fotos. ${linked ? paths.length : 0}/${files.length} vinculadas. ${failures.join(' · ')}`, true);
      } else {
        const count = paths.length;
        notify(`Borrador y ${count} fotografía${count===1?'':'s'} guardados en Supabase. Pendiente de revisión.`);
        // Solo limpiamos las fotos cuando todo se ha completado correctamente.
        for (let i = 0; i < MAX; i++) {
          const remove = $('multiThumbs')?.querySelector('button');
          if (!remove) break;
          remove.click();
        }
        e.target.reset();
      }
      $('refresh')?.click();
    } catch(err) {
      notify('No se pudo guardar: ' + (err?.message || 'error desconocido'), true);
    } finally {
      saving = false;
      if (saveButton) saveButton.disabled = false;
    }
  }
  document.addEventListener('submit', saveProduct, true);

  // Añade un botón «Ver fotos» a los borradores que tengan imágenes privadas.
  async function augmentItems() {
    if (reviewing || !window.locuraDb) return;
    const cards = [...($('items')?.querySelectorAll(':scope > .item') || [])];
    if (!cards.length || cards.every(card => card.querySelector('.locura-see-photos'))) return;
    reviewing = true;
    try {
      const db = window.locuraDb;
      const {data,error} = await db.from('productos')
        .select('id,image_urls').order('created_at',{ascending:false});
      if (error) return;
      cards.forEach((card,i) => {
        if (card.querySelector('.locura-see-photos')) return;
        const paths = Array.isArray(data?.[i]?.image_urls) ? data[i].image_urls.filter(s=>typeof s==='string' && s.length<300) : [];
        if (!paths.length) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'secondary locura-see-photos';
        btn.textContent = `🖼️ Ver ${paths.length} foto${paths.length===1?'':'s'} guardadas`;
        const gallery = document.createElement('div');
        gallery.className = 'grid';
        gallery.style.cssText = 'margin-top:10px';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Abriendo fotografías...';
          gallery.replaceChildren();
          let count = 0;
          for (const p of paths) {
            const {data:link,error:linkError} = await db.storage.from(BUCKET).createSignedUrl(p, 600);
            if (linkError || !link?.signedUrl) continue;
            const img = document.createElement('img');
            img.src = link.signedUrl;
            img.alt = 'Foto del producto';
            img.loading = 'lazy';
            img.style.cssText = 'width:100%;max-height:180px;object-fit:contain;border-radius:9px;background:#14121c';
            gallery.append(img);
            count++;
          }
          btn.textContent = count ? `🖼️ ${count} fotos visibles (10 min)` : 'No se pudieron abrir las fotos';
          btn.disabled = false;
        });
        card.append(btn, gallery);
      });
    } finally { reviewing = false; }
  }

  function init() {
    const form = $('productForm');
    if (!form) return;
    const btn = $('saveBtn');
    if (btn) btn.textContent = '💾 Guardar ficha y fotografías';
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = 'Al guardar, las fotos seleccionadas (hasta 6) se guardan de forma privada junto al borrador. No se publica en TikTok Shop.';
    form.append(note);
    const list = $('items');
    if (list) {
      const observer = new MutationObserver(mutations => {
        // Ignorar las modificaciones del propio complemento.
        if (mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && n.classList?.contains('item')))) {
          augmentItems().catch(()=>{});
        }
      });
      observer.observe(list, {childList:true});
      augmentItems().catch(()=>{});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
