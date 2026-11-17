/* LOCURA TOTAL PRODUCT CHECK - reconocimiento visual IA
   Complemento del index.html existente: no altera el escaner ni el guardado Supabase.
   Requiere desplegar Edge Function: analizar-producto-foto.
*/
(() => {
  'use strict';
  const PROJECT_URL = 'https://bepeiatxumpovpijmwmc.supabase.co';
  const PROJECT_REF = new URL(PROJECT_URL).hostname.split('.')[0];

  function publicKey() {
    // La clave publishable ya esta presente en el index.html actual.
    for (const tag of document.querySelectorAll('script:not([src])')) {
      const found = tag.textContent.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*['"](sb_publishable_[^'"\s]+)['"]/);
      if (found) return found[1];
    }
    return '';
  }
  function sessionToken() {
    try {
      const data = JSON.parse(localStorage.getItem(`sb-${PROJECT_REF}-auth-token`) || 'null');
      return data?.access_token || data?.currentSession?.access_token || '';
    } catch { return ''; }
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = (id) => document.getElementById(id);

  function init() {
    const input = $('photo');
    if (!input || $('locuraFotoIA')) return;
    // Ocultamos el antiguo lector OCR: no reconoce bien la identidad de articulos.
    const antiguo = $('buscadorFotoLocura');
    if (antiguo) antiguo.hidden = true;

    const panel = document.createElement('section');
    panel.id = 'locuraFotoIA';
    panel.style.cssText = 'border:2px solid #f244b3;border-radius:14px;padding:16px;margin:16px 0;background:#24192b;color:white';
    panel.innerHTML = `
      <h3 style="margin:0 0 8px">📸 Reconocer producto con IA</h3>
      <p style="color:#ded0e2">Selecciona la foto arriba y pulsa Analizar. La IA propondrá datos para revisar; no confirmará autenticidad ni estado real.</p>
      <button id="locuraAnalizarIA" type="button">✨ Analizar foto con IA</button>
      <p id="locuraEstadoIA" role="status" aria-live="polite"></p>
      <div id="locuraResultadoIA" hidden style="margin-top:12px"></div>`;
    const preview = $('preview');
    if (preview) preview.insertAdjacentElement('afterend', panel);
    else input.insertAdjacentElement('afterend', panel);

    const boton = $('locuraAnalizarIA');
    const estado = $('locuraEstadoIA');
    const salida = $('locuraResultadoIA');
    let propuesta = null;

    boton.addEventListener('click', async () => {
      const file = input.files?.[0];
      if (!file) { estado.textContent = 'Primero selecciona una foto en el campo Fotografía.'; return; }
      if (!file.type.startsWith('image/')) { estado.textContent = 'Selecciona una imagen válida.'; return; }
      const key = publicKey();
      const token = sessionToken();
      if (!key) { estado.textContent = 'No se pudo leer la clave pública de Supabase del archivo index.html.'; return; }
      if (!token) { estado.textContent = 'Inicia sesión de nuevo en la aplicación antes de analizar.'; return; }
      boton.disabled = true;
      salida.hidden = true;
      estado.textContent = 'Reconociendo marca, producto y datos visibles...';
      try {
        const image = await imagenReducida(file);
        const respuesta = await fetch(`${PROJECT_URL}/functions/v1/analizar-producto-foto`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'apikey': key,
            'authorization': `Bearer ${token}`
          },
          body: JSON.stringify({image})
        });
        const resultado = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) throw new Error(resultado.error || resultado.message || `Error de conexión (${respuesta.status})`);
        propuesta = resultado.producto;
        if (!propuesta || typeof propuesta !== 'object') throw new Error('La IA no devolvió datos utilizables.');

        const campos = [
          ['Nombre', propuesta.name], ['Marca', propuesta.brand], ['Modelo', propuesta.model],
          ['EAN', propuesta.barcode], ['Fabricante', propuesta.manufacturer],
          ['Peso (kg)', propuesta.weight_kg], ['Características', propuesta.features]
        ];
        const filas = campos.filter(([,v]) => v !== '' && v !== null && v !== undefined)
          .map(([k,v]) => `<p style="margin:6px 0"><strong>${esc(k)}:</strong> ${esc(v)}</p>`).join('');
        salida.innerHTML = `${filas || '<p>No se pudo identificar el producto con confianza.</p>'}
          <p style="color:#ffd49c"><strong>Confianza:</strong> ${esc(propuesta.confidence || 'baja')}.</p>
          <p style="color:#ffd49c">${esc(propuesta.warning || 'Revisa todos los datos; la IA puede equivocarse.')}</p>
          <button id="locuraAplicarIA" type="button">Aplicar datos a la ficha</button>
          <a id="locuraBuscarIA" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:8px;color:#ff8ad0">Comprobar en Internet</a>`;
        const consulta = [propuesta.brand, propuesta.model, propuesta.name].filter(Boolean).join(' ');
        $('locuraBuscarIA').href = 'https://www.google.com/search?q=' + encodeURIComponent(consulta + ' fabricante ficha técnica');
        $('locuraAplicarIA').onclick = () => {
          const set = (id, val) => { if ($(id) && val !== null && val !== undefined && String(val).trim()) {
            $(id).value = String(val); $(id).dispatchEvent(new Event('change', {bubbles:true}));
          }};
          set('name', propuesta.name);
          set('brand', propuesta.brand);
          set('manufacturer', propuesta.manufacturer);
          set('barcode', propuesta.barcode);
          set('manualCode', propuesta.barcode);
          set('weight', propuesta.weight_kg);
          set('features', propuesta.features);
          // No cambiar precio, autenticidad ni estado: hay que comprobar el producto fisico.
          if ($('condition')) $('condition').value = 'Sin comprobar';
          if ($('auth')) $('auth').value = 'Sin verificar';
          estado.textContent = 'Datos propuestos aplicados. Revisa y después guarda el borrador.';
        };
        salida.hidden = false;
        estado.textContent = 'Análisis terminado. Comprueba los resultados antes de aplicarlos.';
      } catch (e) {
        estado.textContent = `No se pudo analizar: ${e.message}. Comprueba la función Supabase y tu sesión.`;
      } finally { boton.disabled = false; }
    });
  }

  async function imagenReducida(file) {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.78);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
