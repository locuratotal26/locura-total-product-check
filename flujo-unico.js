/* LOCURA TOTAL PRODUCT CHECK — flujo único de fotos, IA, búsqueda web y ficha.
   Complemento no destructivo para multifoto.js, camara6.js y app-lista.js.
   Mantiene las imágenes seleccionadas para el guardado posterior del borrador.
*/
(() => {
  'use strict';
  if (window.locuraFlujoUnico) return;
  window.locuraFlujoUnico = true;
  const $ = (id) => document.getElementById(id);
  const clean = (value) => value == null ? '' : String(value).trim();
  const normalized = (value) => clean(value).toLocaleLowerCase('es').replace(/\s+/g, ' ');

  function addLine(parent, title, value) {
    if (value == null || clean(value) === '') return;
    const p = document.createElement('p');
    const label = document.createElement('strong');
    label.textContent = title + ': ';
    p.append(label, document.createTextNode(clean(value)));
    parent.append(p);
  }
  function fillEmpty(id, value) {
    if (value == null || clean(value) === '') return;
    const el = $(id);
    if (!el || clean(el.value)) return;
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function resultValue(result, label) {
    const row = [...result.querySelectorAll('p')].find((p) =>
      p.querySelector('strong')?.textContent === label + ': '
    );
    return row ? clean(row.textContent.slice(label.length + 1)) : '';
  }

  function init() {
    const panel = $('locuraMultifoto');
    const form = $('productForm');
    const analyze = $('multiAnalyze');
    const fileInput = $('multiPhotos');
    const status = $('multiStatus');
    const result = $('multiResult');
    if (!panel || !form || !analyze || !fileInput || !status || !result) return;
    if (analyze.dataset.locuraUnified === 'yes') return;
    analyze.dataset.locuraUnified = 'yes';
    const originalAnalyze = analyze.onclick;
    if (typeof originalAnalyze !== 'function') {
      status.textContent = 'Falta el analizador multifoto; comprueba que multifoto.js se haya cargado.';
      return;
    }

    // UNA pantalla de trabajo: foto(s) + único botón + ficha editable + guardado.
    panel.querySelector('h2').textContent = '📦 Nuevo producto · TODO EN UNO';
    const hint = panel.querySelector('p.muted');
    if (hint) hint.textContent = 'Elige 4 fotos de la galería (o hasta 6). Después pulsa «Analizar y buscar» una sola vez: IA, Internet y ficha editable.';
    analyze.textContent = '🔍 Analizar y buscar (IA + Internet)';

    const style = document.createElement('style');
    style.textContent = `
      #locuraFotoIA, #locuraAutoPanel, #buscadorFotoLocura,
      label[for="photo"], #photo, #preview { display:none!important; }
      #locuraMultifoto { padding:16px; border-radius:16px; margin:12px 0; }
      #locuraMultifoto #multiResult { overflow-wrap:anywhere; }
      #locuraMultifoto #multiAnalyze { width:100%; min-height:58px; }
      #locuraTools details { margin:8px 0; }
      #locuraMultifoto img { border-radius:8px; }
    `;
    document.head.append(style);
    const host = form.parentElement;
    const scanPane = $('startScan')?.closest('.panel');
    if (scanPane?.parentElement === host) host.insertBefore(panel, scanPane);
    else host.insertBefore(panel, form);
    const notice = host.querySelector(':scope > .notice');
    if (notice) notice.textContent = 'Todo en un mismo proceso: fotos, análisis visual, búsqueda web y ficha editable. Revisa los datos y guarda cuando estés conforme.';

    const webPane = $('consultarWeb')?.closest('.panel');
    if (scanPane || webPane) {
      const tools = document.createElement('details');
      tools.id = 'locuraTools';
      tools.style.cssText = 'border:1px solid #605267;border-radius:12px;padding:13px;margin-top:16px';
      const summary = document.createElement('summary');
      summary.style.cssText = 'cursor:pointer;font-weight:bold';
      summary.textContent = '⚙️ Herramientas adicionales (escáner y búsqueda manual)';
      tools.append(summary);
      if (scanPane) tools.append(scanPane);
      if (webPane) tools.append(webPane);
      host.append(tools);
    }

    // El botón Galería selecciona directamente fotos para la ficha.
    // La cámara continua sigue disponible como función secundaria.
    const gallery = $('locuraGalleryButton');
    if (gallery) {
      fileInput.hidden = true;
      const label = panel.querySelector('label[for="multiPhotos"]');
      if (label) label.hidden = true;
      gallery.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        fileInput.click();
      }, true);
    }

    let running = false;
    analyze.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopImmediatePropagation(); // Evita ejecutar la IA dos veces.
      if (running) return;
      running = true;
      analyze.disabled = true;
      try {
        // Reutilizamos el analizador de fotos ya existente y sus fotos privadas.
        await originalAnalyze.call(analyze);
        analyze.disabled = true;
        const apply = [...result.querySelectorAll('button')].find((b) =>
          b.textContent.includes('Aplicar a ficha editable')
        );
        if (result.hidden || !apply) return; // La IA ya muestra su error, si lo hay.
        apply.click(); // Automático: no hay un segundo botón que pulsar.
        apply.hidden = true;
        const name = clean($('name')?.value);
        const brand = clean($('brand')?.value);
        const model = resultValue(result, 'Modelo');
        const barcode = clean($('barcode')?.value);
        if (!name) throw new Error('La IA no ha identificado un nombre de producto fiable.');

        status.textContent = '2/3 · Buscando en Internet fabricante, características y precio orientativo...';
        const db = window.locuraDb;
        let webData = null;
        let warning = '';
        try {
          const { data, error } = await db.functions.invoke('buscar-producto-web', {
            body: { name, brand, model, barcode }
          });
          if (error || data?.error) throw new Error(data?.error || error.message);
          webData = data;
        } catch (error) {
          warning = 'La búsqueda web no se pudo completar (' + (error?.message || 'sin conexión') + '). La ficha de las fotografías sí está preparada.';
        }
        const w = webData?.product;
        const identityMatches = Boolean(
          (barcode && w?.barcode && normalized(barcode) === normalized(w.barcode)) ||
          (brand && model && w?.brand && w?.model &&
            normalized(brand) === normalized(w.brand) && normalized(model) === normalized(w.model))
        );
        const verifiedMatch = identityMatches && !webData?.identity_unverified;
        if (w && !verifiedMatch) {
          warning = 'Internet encontró datos, pero no se confirmó que sean del mismo modelo. No se mezclarán con tu ficha.';
        }

        const webSection = document.createElement('section');
        webSection.style.cssText = 'margin-top:14px;border-top:1px solid #6c5970;padding-top:12px';
        const heading = document.createElement('h3');
        heading.textContent = '🌐 Búsqueda en Internet';
        webSection.append(heading);
        if (verifiedMatch) {
          addLine(webSection, 'Marca web', w.brand);
          addLine(webSection, 'Modelo web', w.model);
          addLine(webSection, 'Fabricante encontrado (verificar)', w.manufacturer);
          addLine(webSection, 'Características web (verificar)', w.features);
          if (typeof w.market_price_eur === 'number' && w.market_price_eur > 0)
            addLine(webSection, 'Precio web orientativo (no precio de venta)', w.market_price_eur + ' €');
          addLine(webSection, 'Avisos', w.warnings);
          fillEmpty('manufacturer', w.manufacturer);
          if (typeof w.weight_kg === 'number' && w.weight_kg > 0) fillEmpty('weight', w.weight_kg);
          if (clean(w.features)) {
            const features = $('features');
            if (features && !features.value.includes('Datos web (revisar):')) {
              features.value = clean(features.value) + '\nDatos web (revisar): ' + clean(w.features);
            }
          }
          const sources = Array.isArray(webData.sources) ? webData.sources : [];
          const validSources = sources.filter((s) =>
            typeof s?.url === 'string' &&
            (s.url.startsWith('https://') || s.url.startsWith('http://'))
          ).slice(0, 6);
          if (validSources.length) {
            const title = document.createElement('strong');
            title.textContent = 'Fuentes para revisar:';
            webSection.append(title);
            for (const source of validSources) {
              const p = document.createElement('p');
              const a = document.createElement('a');
              a.href = source.url;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.textContent = clean(source.title) || source.url;
              p.append(a);
              webSection.append(p);
            }
          }
        } else {
          const p = document.createElement('p');
          p.textContent = warning || 'No hay una coincidencia exacta comprobable. Revisa los datos obtenidos de las fotografías.';
          webSection.append(p);
        }
        const note = document.createElement('p');
        note.className = 'notice';
        note.textContent = '✅ Ficha editable rellenada. Revisa fabricante, peso, estado y autenticidad. El precio de venta lo eliges tú. Todavía no se ha guardado ni publicado.';
        webSection.append(note);
        result.append(webSection);
        result.hidden = false;
        status.textContent = warning
          ? '✅ IA completada y ficha rellena. ' + warning
          : '✅ IA y búsqueda en Internet completadas. Ficha lista para revisar y guardar.';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        status.textContent = 'No se pudo completar todo el proceso: ' + (error?.message || 'error desconocido');
      } finally {
        running = false;
        analyze.disabled = false;
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* MEJORAS DE LOCURA TOTAL: selector múltiple de fotos y borrado de borradores.
   Mantiene el mismo archivo flujo-unico.js para no tener que modificar index.html.
   Cualquier borrado de producto necesita confirmación explícita.
*/
(() => {
  'use strict';
  if (window.locuraMejoras2026) return;
  window.locuraMejoras2026 = true;
  const $ = id => document.getElementById(id);
  const LIMIT = 6;
  const BUCKET = 'locura-productos';
  const allowed = /^image\/(jpeg|png|webp)$/;

  function initPhotoPicker() {
    const panel = $('locuraMultifoto');
    const input = $('multiPhotos');
    const thumbs = $('multiThumbs');
    if (!panel || !input || !thumbs || $('locuraChooseMany')) return;

    // El atributo multiple funciona tanto en Windows como en el selector de Android.
    input.multiple = true;
    input.accept = 'image/jpeg,image/png,image/webp';
    input.removeAttribute('capture');
    input.hidden = true;
    const oldLabel = panel.querySelector('label[for="multiPhotos"]');
    if (oldLabel) oldLabel.hidden = true;
    const oldGallery = $('locuraGalleryButton');
    if (oldGallery) oldGallery.hidden = true;
    // En algunos CSS antiguos los botones tienen display:inline-block !important.
    const oldStyle = document.createElement('style');
    oldStyle.textContent = '#locuraGalleryButton{display:none!important}#locuraMultifoto #multiThumbs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}#locuraMultifoto #multiThumbs>div{min-width:0;border:1px solid #67526d;padding:6px;border-radius:12px}#locuraMultifoto #multiThumbs button{font-size:14px;padding:10px;max-width:100%;background:#56394d;color:#fff}#locuraChooseMany{display:block;width:100%;background:#f244b3;color:#16101a;margin:10px 0;font-weight:750}#locuraAddMany{background:#54425c;color:white}#locuraClearPhotos{background:#533442;color:#fff}#locuraPhotoSummary{margin:12px 0;color:#ffe2a6;font-weight:650}#locuraPhotoGuide{font-size:14px;color:#ddd0df}#locuraDropArea{border:1px dashed #a17bb0;border-radius:10px;padding:12px;margin:10px 0;color:#e2d2e6;text-align:center}@media(max-width:430px){#locuraMultifoto #multiThumbs{grid-template-columns:repeat(2,minmax(0,1fr))}}';
    document.head.append(oldStyle);

    const picker = document.createElement('button');
    picker.type = 'button';
    picker.id = 'locuraChooseMany';
    picker.textContent = '🖼️ Elegir 4 fotos juntas (hasta 6)';
    picker.addEventListener('click', () => input.click());
    const camera = $('locuraCameraButton');
    if (camera) panel.insertBefore(picker, camera);
    else panel.insertBefore(picker, input);
    if (camera) camera.textContent = '📷 Hacer fotos con la cámara (opcional)';

    const guide = document.createElement('p');
    guide.id = 'locuraPhotoGuide';
    guide.textContent = 'Ordenador: mantén Ctrl y marca 4 fotos; pulsa Abrir. Móvil: toca 4 fotos y confirma la selección. También puedes añadirlas en varias tandas.';
    picker.after(guide);
    const count = document.createElement('p');
    count.id = 'locuraPhotoSummary';
    guide.after(count);
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px';
    const add = document.createElement('button');
    add.type = 'button';
    add.id = 'locuraAddMany';
    add.textContent = '➕ Añadir más fotos';
    add.addEventListener('click', () => {
      if (thumbs.children.length >= LIMIT) {
        count.textContent = 'Ya tienes las 6 fotos. Quita alguna para añadir otra.';
      } else input.click();
    });
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.id = 'locuraClearPhotos';
    clear.textContent = '🗑️ Quitar todas las fotos';
    clear.addEventListener('click', () => {
      if (!thumbs.children.length) return;
      if (!window.confirm('¿Quitar todas las fotos seleccionadas de este producto? No se borran fotos que ya estén guardadas en otros borradores.')) return;
      for (let n = 0; n < LIMIT; n++) {
        const remove = thumbs.querySelector('button');
        if (!remove) break;
        remove.click(); // Reutiliza el borrado de multifoto.js y sincroniza app-lista.js.
      }
      update();
    });
    actions.append(add, clear);
    count.after(actions);

    const drop = document.createElement('div');
    drop.id = 'locuraDropArea';
    drop.textContent = '💻 En ordenador también puedes arrastrar aquí tus 4 fotos juntas';
    actions.after(drop);
    drop.addEventListener('dragover', ev => {
      if (ev.dataTransfer?.types?.includes('Files')) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'copy';
      }
    });
    drop.addEventListener('drop', ev => {
      ev.preventDefault();
      const files = [...(ev.dataTransfer?.files || [])];
      addFiles(files);
    });

    function update() {
      const amount = thumbs.children.length;
      count.textContent = amount + '/6 fotos seleccionadas. ' +
        (amount === 4 ? '✅ Perfecto: ya puedes analizar las 4 juntas.' :
         amount === 6 ? '✅ Máximo de fotos listo. Pulsa Analizar y buscar.' :
         amount ? 'Puedes analizar o añadir más fotos.' : 'Elige fotos para empezar.');
      add.disabled = amount >= LIMIT;
      clear.disabled = amount === 0;
    }
    // El flujo antiguo ya es acumulativo. Usamos su evento para conservar
    // las fotos tanto en el analizador como en el guardado privado de Supabase.
    function addFiles(files) {
      const remaining = LIMIT - thumbs.children.length;
      const clean = files.filter(f => f && allowed.test(f.type) && f.size <= 18 * 1024 * 1024);
      const picked = clean.slice(0, Math.max(0, remaining));
      if (!picked.length) {
        count.textContent = remaining <= 0 ? 'Ya hay 6 fotos. Quita una para añadir otra.' : 'No se añadieron fotos: usa JPG, PNG o WEBP de menos de 18 MB.';
        return;
      }
      try {
        const transfer = new DataTransfer();
        for (const file of picked) transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (clean.length < files.length || picked.length < clean.length) {
          const warn = document.createElement('p');
          warn.style.color = '#ffd49c';
          warn.textContent = 'Aviso: se omitieron ' + (files.length - picked.length) + ' fotos por formato, tamaño o límite de 6.';
          warn.setAttribute('role', 'status');
          const previous = $('locuraRejectedPhotos');
          if (previous) previous.remove();
          warn.id = 'locuraRejectedPhotos';
          drop.after(warn);
        }
      } catch (err) {
        count.textContent = 'No se pudieron incorporar las fotos: ' + (err?.message || 'error del navegador');
      }
    }
    // Si un selector de Android devuelve solo 2 fotos, el botón Añadir más
    // permite completar 4 o 6 sin reemplazar las ya elegidas.
    thumbs.addEventListener('click', () => setTimeout(update, 0));
    new MutationObserver(update).observe(thumbs, { childList: true });
    update();
  }

  function initDeleteProducts() {
    const items = $('items');
    if (!items || items.dataset.locuraDeleteReady === 'yes') return;
    items.dataset.locuraDeleteReady = 'yes';
    let busy = false;
    let scheduled = false;
    async function attach() {
      if (busy || !window.locuraDb) return;
      const cards = [...items.querySelectorAll(':scope > .item')];
      if (!cards.length || cards.every(card => card.querySelector('.locura-delete-product'))) return;
      busy = true;
      try {
        const db = window.locuraDb;
        const { data, error } = await db.from('productos')
          .select('id,name,created_at,approved').order('created_at', { ascending: false });
        if (error || !Array.isArray(data) || data.length !== cards.length) return;
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i], row = data[i];
          if (card.querySelector('.locura-delete-product')) continue;
          // No vinculamos botones a registros si cambió el orden al cargar.
          const heading = card.querySelector('h3')?.textContent || '';
          const created = [...card.querySelectorAll('p')]
            .find(p => p.textContent.startsWith('Creado: '))?.textContent;
          const expected = 'Creado: ' + new Date(row.created_at).toLocaleString('es-ES');
          if (heading !== row.name || created !== expected) continue;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'secondary locura-delete-product';
          button.textContent = '🗑️ Eliminar producto';
          button.style.cssText = 'display:block;margin:12px 0 2px;background:#7b233a;color:#fff;border:1px solid #e35a81;font-weight:700';
          const local = document.createElement('p');
          local.setAttribute('role', 'status');
          local.style.cssText = 'color:#ffd6df;white-space:pre-wrap';
          button.addEventListener('click', async () => {
            const question = '¿Eliminar definitivamente «' + row.name + '» y sus fotos guardadas?\n\nEsta acción no se puede deshacer.';
            if (!window.confirm(question)) return;
            button.disabled = true;
            local.textContent = 'Eliminando producto...';
            try {
              const { data: auth, error: authError } = await db.auth.getUser();
              if (authError || !auth?.user?.id) throw new Error('Inicia sesión de nuevo.');
              const { data: record, error: readError } = await db.from('productos')
                .select('id,name,image_urls').eq('id', row.id).single();
              if (readError || !record) throw new Error(readError?.message || 'No se encuentra el producto.');
              if (String(record.id) !== String(row.id) || record.name !== row.name)
                throw new Error('El registro ha cambiado. Actualiza la lista antes de eliminar.');
              const paths = (Array.isArray(record.image_urls) ? record.image_urls : [])
                .filter(path => typeof path === 'string' &&
                  path.startsWith(auth.user.id + '/' + record.id + '/') && path.length < 300);
              const { data: deleted, error: delError } = await db.from('productos')
                .delete().eq('id', row.id).select('id');
              if (delError || deleted?.length !== 1)
                throw new Error(delError?.message || 'No se pudo eliminar el registro. Comprueba los permisos.');
              let photoError = '';
              if (paths.length) {
                const { error } = await db.storage.from(BUCKET).remove(paths);
                if (error) photoError = error.message || 'No se pudo borrar una o varias fotos privadas.';
              }
              $('refresh')?.click();
              if (photoError) {
                window.alert('Producto eliminado, pero algunas fotos podrían seguir en el almacenamiento privado: ' + photoError);
              } else {
                window.alert('✅ Producto eliminado correctamente' + (paths.length ? ' junto con sus fotos.' : '.'));
              }
            } catch (err) {
              local.textContent = 'No se pudo eliminar: ' + (err?.message || 'error desconocido');
              button.disabled = false;
            }
          });
          card.append(button, local);
        }
      } catch (err) {
        // Si la sesión todavía no está lista, la siguiente actualización reintentará.
        console.warn('No se pudo preparar la eliminación:', err);
      } finally { busy = false; }
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; attach(); }, 50);
    }
    new MutationObserver(mutations => {
      if (mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && n.classList?.contains('item'))))
        schedule();
    }).observe(items, { childList: true });
    $('refresh')?.addEventListener('click', () => setTimeout(schedule, 100));
    schedule();
  }

  function init() {
    initPhotoPicker();
    initDeleteProducts();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();


/* Correccion: algunas galerias (Samsung/Windows) entregan fotos HEIC, AVIF
   o archivos sin vista previa. Se prueban y convierten localmente a JPEG
   ANTES de que multifoto.js y app-lista.js los incorporen. Si la imagen no
   puede abrirse, se omite sin romper el analisis de las demas fotografias.
   Esta funcion no sube ni elimina archivos del servidor. */
(() => {
  'use strict';
  if (window.locuraFotosCompatibles) return;
  window.locuraFotosCompatibles = true;
  const $ = id => document.getElementById(id);
  const MAX = 6;
  const LIMIT = 18 * 1024 * 1024;
  let forwarding = false;
  let pending = null;
  let queuedAnalysis = false;

  async function openBitmap(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        const b = await createImageBitmap(file);
        return { width:b.width, height:b.height,
          draw:ctx=>ctx.drawImage(b,0,0), close:()=>b.close() };
      } catch (_) { /* probar el lector de imagen del navegador */ }
    }
    const objectURL = URL.createObjectURL(file);
    try {
      const pic = new Image();
      pic.decoding = 'async';
      await new Promise((resolve,reject) => {
        pic.onload = resolve;
        pic.onerror = () => reject(new Error('Formato de imagen no admitido'));
        pic.src = objectURL;
      });
      return { width:pic.naturalWidth, height:pic.naturalHeight,
        draw:ctx=>ctx.drawImage(pic,0,0), close:()=>{} };
    } finally { URL.revokeObjectURL(objectURL); }
  }
  async function toJpeg(file) {
    if (!file || !file.size || file.size > LIMIT) throw Error('El archivo está vacío o supera 18 MB');
    // Para convertir HEIC/AVIF el navegador debe poder decodificarlo. Nunca
    // se cambia solo la extension porque eso crearia una falsa foto JPEG.
    const bitmap = await openBitmap(file);
    try {
      if (!(bitmap.width>0 && bitmap.height>0)) throw Error('La fotografía no tiene dimensiones válidas');
      const scale = Math.min(1,2048/Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(bitmap.width*scale));
      canvas.height = Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d');
      if (!ctx) throw Error('No se pudo preparar la fotografía');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      bitmap.draw(ctx);
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.84));
      if (!blob || blob.type!=='image/jpeg' || !blob.size) throw Error('No se pudo convertir a JPEG');
      const simple = (file.name||'foto').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,55);
      return new File([blob],simple+'-locura.jpg',{type:'image/jpeg',lastModified:Date.now()});
    } finally { bitmap.close(); }
  }
  function init() {
    const input = $('multiPhotos'), thumbs = $('multiThumbs'), analyze = $('multiAnalyze');
    const panel = $('locuraMultifoto');
    if (!input || !thumbs || !panel || !analyze) return;
    const warn = document.createElement('p');
    warn.id='locuraFormatNotice'; warn.setAttribute('role','status');
    warn.style.cssText='color:#ffd49c;white-space:pre-wrap;margin:8px 0;font-size:14px';
    const count = $('locuraPhotoSummary');
    if (count) count.after(warn); else input.after(warn);

    // Capturar el evento ANTES de los modulos antiguos para que nunca
    // guarden archivos HEIC/corruptos como si fueran JPG/PNG/WEBP.
    window.addEventListener('change', event => {
      if (event.target !== input || forwarding) return;
      event.stopImmediatePropagation();
      const selected = Array.from(input.files||[]);
      input.value='';
      const available = Math.max(0,MAX-thumbs.children.length);
      const chosen = selected.slice(0,available);
      if (!selected.length) return;
      warn.textContent='Preparando '+chosen.length+' fotografía(s)...';
      const processing = (async () => {
        const safe=[],errors=[];
        for (const file of chosen) {
          try { safe.push(await toJpeg(file)); }
          catch (e) { errors.push((file.name||'Foto')+': '+(e?.message||'formato incompatible')); }
        }
        if (selected.length>chosen.length) errors.push('Se superó el máximo de 6 fotografías.');
        if (safe.length) {
          const data = new DataTransfer();
          for (const file of safe) data.items.add(file);
          input.files = data.files;
          forwarding=true;
          try { input.dispatchEvent(new Event('change',{bubbles:true})); }
          finally { forwarding=false; }
        }
        warn.textContent = errors.length
          ? '✅ '+safe.length+' foto(s) listas. Se omitieron '+errors.length+':\n'+errors.join('\n')+'\nPara las que fallen, elige JPG/PNG o realiza una captura de pantalla.'
          : '✅ '+safe.length+' fotografía(s) preparadas. Puedes añadir más o analizar todas juntas.';
      })();
      pending=processing;
      processing.catch(e => {warn.textContent='Error al preparar las fotos: '+(e?.message||'error desconocido');});
      const clearPending=()=>{if (pending===processing) pending=null;};
      processing.then(clearPending,clearPending);
    },true);

    // La camara6.js lanza el analisis justo tras enviar las fotos. Si aun
    // estan convirtiendose, lo posponemos para evitar previews rotas.
    window.addEventListener('click',event=>{
      if (event.target !== analyze || !pending) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (queuedAnalysis) return;
      queuedAnalysis=true;
      const task=pending;
      task.finally(()=>{
        queuedAnalysis=false;
        if (thumbs.children.length && !pending) analyze.click();
      });
    },true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
