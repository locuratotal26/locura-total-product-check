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
