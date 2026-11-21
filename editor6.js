/* LOCURA TOTAL PRODUCT CHECK — editor automático de hasta 6 fotografías.
 * Version 1: eliminación de fondo con IA en el dispositivo, fondo blanco,
 * vista previa solo de imágenes editadas. No publica en TikTok Shop.
 * Cargar ANTES de flujo-unico.js para interceptar archivos originales.
 * Dependencia bajo demanda: @bg0/browser@0.1.2 (Apache-2.0), modelo MIT.
 */
(() => {
  'use strict';
  if (window.locuraEditorSeis) return;
  window.locuraEditorSeis = true;

  const MAX = 6;
  const MAX_BYTES = 60 * 1024 * 1024;
  const $ = id => document.getElementById(id);
  const edited = file => /^locura-editada-/.test(file?.name || '');
  let processing = null;
  let forwarding = false;
  let queuedAnalysis = false;
  let statusNode = null;
  let counterNode = null;
  let slotsNode = null;
  let enginePromise = null;

  function notice(message, error = false) {
    if (statusNode) {
      statusNode.textContent = message;
      statusNode.style.color = error ? '#ffc4c4' : '#ffdc9d';
    }
  }

  // Se importa solo cuando hace falta. La primera descarga del modelo ligero
  // ronda los 100 MB. Puede tardar según red, dispositivo y navegador.
  function loadEditor() {
    enginePromise ||= import('https://esm.sh/@bg0/browser@0.1.2?bundle')
      .then(module => {
        if (typeof module.removeBackground !== 'function') {
          throw new Error('No se pudo cargar el motor de IA.');
        }
        return module.removeBackground;
      })
      .catch(error => { enginePromise = null; throw error; });
    return enginePromise;
  }

  async function whiteBackground(file, index, total) {
    const name = file.name || `foto-${index + 1}`;
    if (!file.size || file.size > MAX_BYTES) throw new Error(name + ': imagen vacía o superior a 60 MB');
    const accepted = /\.(heic|heif|jpe?g|png|webp)$/i.test(name) ||
      /^image\/(jpeg|png|webp|heic|heif)$/.test(file.type);
    if (!accepted) throw new Error(name + ': formato no admitido');

    const removeBackground = await loadEditor();
    const removal = await removeBackground(file, {
      model: 'lite', quality: 'fast',
      onProgress: ({ stage, progress }) => {
        const phase = stage === 'downloading' ? 'descargando modelo de IA' :
          stage === 'processing' ? 'quitando el fondo' : 'preparando imagen';
        notice(`Foto ${index + 1}/${total}: ${phase} (${Math.round((progress || 0) * 100)} %).`);
      }
    });
    if (!removal?.blob) throw new Error(name + ': la IA no devolvió una foto editada');

    const bitmap = await createImageBitmap(removal.blob);
    try {
      const SIZE = 1200;
      const PADDING = 64;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo preparar el fondo blanco');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      const k = Math.min((SIZE - PADDING * 2) / bitmap.width,
        (SIZE - PADDING * 2) / bitmap.height);
      const width = Math.max(1, Math.round(bitmap.width * k));
      const height = Math.max(1, Math.round(bitmap.height * k));
      ctx.drawImage(bitmap, Math.round((SIZE - width) / 2),
        Math.round((SIZE - height) / 2), width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.90));
      if (!blob?.size) throw new Error('No se pudo crear el JPG editado');
      return new File([blob], `locura-editada-${Date.now()}-${index + 1}.jpg`,
        { type: 'image/jpeg', lastModified: Date.now() });
    } finally {
      bitmap.close();
    }
  }

  // Captura las fotos ANTES de multifoto.js, app-lista.js y del convertidor.
  // Solo reenvía archivos realmente editados; nunca los originales.
  window.addEventListener('change', event => {
    const input = event.target;
    if (input?.id !== 'multiPhotos' || forwarding) return;
    const files = [...(input.files || [])];
    if (!files.length || files.every(edited)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    input.value = '';

    if (processing) {
      notice('Termina la edición actual antes de añadir más fotografías.', true);
      return;
    }
    const current = $('multiThumbs')?.children.length || 0;
    const chosen = files.slice(0, Math.max(0, MAX - current));
    if (!chosen.length) {
      notice('Ya tienes 6 fotos. Quita una antes de añadir otra.', true);
      return;
    }

    processing = (async () => {
      const finished = [];
      const errors = [];
      for (let i = 0; i < chosen.length; i++) {
        try {
          notice(`Editando fotografía ${i + 1} de ${chosen.length}...`);
          finished.push(await whiteBackground(chosen[i], i, chosen.length));
        } catch (error) {
          errors.push(`${chosen[i].name || `Foto ${i + 1}`}: ${error?.message || 'fallo de edición'}`);
        }
      }
      if (finished.length) {
        const transfer = new DataTransfer();
        finished.forEach(file => transfer.items.add(file));
        input.files = transfer.files;
        forwarding = true;
        try {
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } finally {
          forwarding = false;
          input.value = '';
        }
      }
      notice(errors.length
        ? `Editadas ${finished.length} de ${chosen.length} fotos. Fallaron: ${errors.join(' · ')}. Las originales NO se añadieron.`
        : `✅ ${finished.length} foto(s) editadas y enviadas a la ficha. Puedes completar hasta 6.`,
        Boolean(errors.length));
    })().catch(error => notice('No se pudo editar: ' + (error?.message || 'error desconocido'), true))
      .finally(() => { processing = null; });
  }, true);

  // Si la cámara dispara el análisis antes de que acabe la IA, posponerlo.
  window.addEventListener('click', event => {
    if (event.target?.id !== 'multiAnalyze' || !processing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (queuedAnalysis) return;
    queuedAnalysis = true;
    const task = processing;
    notice('Primero terminaré de editar las fotos; después iniciaré el análisis.');
    task.finally(() => {
      queuedAnalysis = false;
      const thumbs = $('multiThumbs');
      if (!thumbs) return;
      const current = thumbs.children.length;
      if (current) {
        $('multiAnalyze')?.click();
        return;
      }
      // El convertidor de formatos puede tardar un poco más en incorporar
      // las fotos editadas al analizador.
      const observer = new MutationObserver(() => {
        if (!thumbs.children.length) return;
        observer.disconnect();
        $('multiAnalyze')?.click();
      });
      observer.observe(thumbs, { childList: true });
      setTimeout(() => observer.disconnect(), 15000);
    });
  }, true);

  // No permitir que el formulario guarde imágenes mientras se procesan.
  window.addEventListener('submit', event => {
    if (event.target?.id !== 'productForm' || !processing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    notice('Espera a que termine la edición de las fotografías antes de guardar.', true);
  }, true);

  function initView() {
    const tablero = $('locuraCompacto');
    const thumbs = $('multiThumbs');
    if (!tablero || !thumbs || $('locuraEditorVistaSeis')) return;

    const style = document.createElement('style');
    style.textContent = `
      #locuraRegistroCompacto #locuraMultifoto{display:none!important}
      #locuraRegistroCompacto[data-paso="ia"] #locuraMultifoto{display:block!important}
      #locuraRegistroCompacto[data-paso="mejora"] #productForm,
      #locuraRegistroCompacto[data-paso="mejora"] #message,
      #locuraRegistroCompacto[data-paso="mejora"] #locuraTools{display:none!important}
      #locuraEditorVistaSeis{padding:12px;border:1px solid #6d4365}
      #locuraEditorVistaSeis h2{font-size:17px;margin-bottom:8px}
      #locuraEditorVistaSeis p{font-size:13px}
      #locuraEditorGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #locuraEditorGrid #multiThumbs,#locuraEditorGrid #locuraEditorHuecos{display:contents!important}
      #locuraEditorGrid #multiThumbs>div,#locuraEditorGrid .locuraHueco{
        border:1px solid #b8a9b9;border-radius:12px;background:#fff;
        color:#343039;min-width:0;min-height:154px;padding:7px;
        display:flex;flex-direction:column;justify-content:center;align-items:center;position:relative
      }
      #locuraEditorGrid #multiThumbs img{height:116px!important;width:100%!important;object-fit:contain}
      #locuraEditorGrid #multiThumbs button{font-size:11px;min-height:26px;margin:5px 0 0;
        padding:4px 8px;background:#442438;color:#fff;width:100%;border-radius:6px}
      #locuraEditorGrid .locuraHueco{color:#898389;font-size:12px;text-align:center}
    `;
    document.head.append(style);

    const view = document.createElement('section');
    view.className = 'panel';
    view.id = 'locuraEditorVistaSeis';
    const title = document.createElement('h2');
    title.textContent = '✨ Las 6 fotos editadas';
    counterNode = document.createElement('p');
    counterNode.style.cssText = 'font-weight:700;color:#ffdb9c';
    statusNode = document.createElement('p');
    statusNode.setAttribute('role','status');
    statusNode.setAttribute('aria-live','polite');
    statusNode.style.cssText = 'white-space:pre-wrap;color:#ffdc9d';
    statusNode.textContent = 'Selecciona fotos en el cuadro 1. La IA eliminará el fondo y mostrará solo las editadas.';
    const grid = document.createElement('div');
    grid.id = 'locuraEditorGrid';
    slotsNode = document.createElement('div');
    slotsNode.id = 'locuraEditorHuecos';
    grid.append(thumbs, slotsNode);
    view.append(title,counterNode,statusNode,grid);
    tablero.insertAdjacentElement('afterend', view);

    function refresh() {
      const count = thumbs.children.length;
      counterNode.textContent = `${count}/6 fotografías editadas`;
      slotsNode.replaceChildren();
      for (let i = count; i < MAX; i++) {
        const hole = document.createElement('div');
        hole.className = 'locuraHueco';
        hole.textContent = `Foto editada ${i + 1}`;
        slotsNode.append(hole);
      }
    }
    new MutationObserver(refresh).observe(thumbs,{childList:true});
    refresh();

    const button2 = tablero.querySelector('button[data-paso="mejora"]');
    if (button2) {
      button2.disabled = false;
      button2.addEventListener('click', () => {
        tablero.querySelector('p:last-child').textContent = 'La edición se inicia al elegir fotos. Aquí ves únicamente las editadas.';
        view.scrollIntoView({behavior:'smooth',block:'start'});
      });
    }
  }

  // La interfaz principal se crea en DOMContentLoaded; esperamos a que esté lista.
  if (document.readyState === 'complete') initView();
  else window.addEventListener('load',initView,{once:true});
})();
