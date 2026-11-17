
/* LOCURA TOTAL PRODUCT CHECK - foto + web + ficha en un clic */
(() => {
  'use strict';
  if (window.locuraAutoReady) return;
  window.locuraAutoReady = true;
  const $ = id => document.getElementById(id);
  const txt = value => value == null ? '' : String(value).trim();
  const same = (a, b) => txt(a).toLowerCase() === txt(b).toLowerCase();
  const generic = /gen[eé]ric[oa]|sin marca|unbranded|marca blanca/i;
  const accessory = /^(cable|adaptador|cargador|funda|protector|conector|auriculares)\b/i;

  async function photoData(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type))
      throw Error('Selecciona una foto JPG, PNG o WEBP.');
    if (file.size > 15 * 1024 * 1024) throw Error('La foto supera los 15 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/jpeg', 0.72);
      if (image.length > 5500000) throw Error('La foto es demasiado grande.');
      return image;
    } finally { bitmap.close(); }
  }

  function fillEmpty(id, value) {
    const field = $(id);
    if (!field || txt(field.value) || !txt(value)) return;
    field.value = txt(value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function init() {
    const input = $('photo');
    if (!input || $('locuraAutoPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'locuraAutoPanel';
    panel.style.cssText = 'border:2px solid #f244b3;border-radius:14px;background:#24192b;padding:16px;margin:16px 0;color:white';
    const title = document.createElement('h3');
    title.textContent = '📸 Analizar y preparar ficha automáticamente';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '✨ Analizar foto + buscar en Internet';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const result = document.createElement('p');
    result.style.whiteSpace = 'pre-wrap';
    panel.append(title, button, status, result);
    const beside = $('locuraFotoIA') || $('preview') || input;
    beside.insertAdjacentElement('afterend', panel);

    button.onclick = async () => {
      const file = input.files && input.files[0];
      const db = window.locuraDb;
      if (!file) { status.textContent = 'Selecciona primero una fotografía.'; return; }
      if (!db?.functions?.invoke) {
        status.textContent = 'Inicia sesión en la aplicación.';
        return;
      }
      button.disabled = true;
      result.textContent = '';
      try {
        const session = (await db.auth.getSession()).data?.session;
        if (!session) throw Error('Inicia sesión de nuevo en la aplicación.');
        status.textContent = '1/3 · Reconociendo el producto...';
        const image = await photoData(file);
        const barcode = txt($('barcode')?.value);
        const ai = await db.functions.invoke('analizar-producto', {
          body: { image, barcode }
        });
        if (ai.error || ai.data?.error)
          throw Error(ai.data?.error || ai.error?.message || 'Falló el análisis.');
        const p = ai.data?.producto || ai.data?.product;
        if (!p || typeof p !== 'object' || !txt(p.name))
          throw Error('La IA no devolvió datos suficientes.');

        const detectedName = txt(p.name);
        const detectedBrand = txt(p.brand);
        const detectedModel = txt(p.model);
        const isGeneric = generic.test(detectedName + ' ' + detectedBrand) ||
          (accessory.test(detectedName) && !barcode);
        const nameParts = [detectedName];
        if (!isGeneric && detectedBrand && !detectedName.toLowerCase().includes(detectedBrand.toLowerCase()))
          nameParts.push(detectedBrand);
        if (!isGeneric && detectedModel && !detectedName.toLowerCase().includes(detectedModel.toLowerCase()))
          nameParts.push(detectedModel);
        const name = nameParts.join(' ');

        status.textContent = '2/3 · Buscando información en Internet...';
        let web = null;
        let warning = '';
        try {
          const search = await db.functions.invoke('buscar-producto-web', {
            body: { name, brand: isGeneric ? '' : detectedBrand,
              model: isGeneric ? '' : detectedModel, barcode }
          });
          if (search.error || search.data?.error)
            throw Error(search.data?.error || search.error?.message || 'Búsqueda fallida');
          web = search.data?.product || search.data?.producto || null;
          if (search.data?.identity_unverified)
            warning = 'Identidad comercial no verificada.';
        } catch (error) { warning = 'Búsqueda web incompleta: ' + error.message; }

        status.textContent = '3/3 · Preparando la ficha...';
        fillEmpty('name', name);
        fillEmpty('brand', isGeneric ? '' : detectedBrand);
        fillEmpty('barcode', barcode);
        const verifiedMatch = !isGeneric && detectedBrand && detectedModel &&
          same(web?.brand, detectedBrand) && same(web?.model, detectedModel) && !warning;
        if (verifiedMatch) fillEmpty('manufacturer', web?.manufacturer);
        const notes = [
          detectedModel && !isGeneric ? 'Modelo propuesto (revisar): ' + detectedModel : '',
          p.features ? 'Datos de la foto (revisar): ' + txt(p.features) : '',
          verifiedMatch && web?.features ? 'Datos web (revisar): ' + txt(web.features) : '',
          warning
        ].filter(Boolean).join('\n');
        fillEmpty('features', notes);
        if ($('condition')?.value === 'Nuevo') $('condition').value = 'Sin comprobar';
        status.textContent = 'Ficha preparada para revisar. No se ha guardado ni publicado.';
        result.textContent = 'Producto: ' + name + '\n' +
          'Marca: ' + (isGeneric ? 'Sin marca verificada' : detectedBrand || 'Sin confirmar') + '\n' +
          'Modelo: ' + (isGeneric ? 'Sin verificar' : detectedModel || 'Sin verificar') + '\n' +
          'Peso: pendiente de comprobar\n' +
          'Precio de venta: pendiente de establecer\n' +
          (web?.market_price_eur != null && !isGeneric ?
            'Referencia web NO verificada: ' + web.market_price_eur + ' €\n' : '') +
          (warning ? 'Aviso: ' + warning + '\n' : '') +
          'Comprueba el estado, la autenticidad y todos los datos antes de guardar.';
      } catch (error) {
        status.textContent = 'No se pudo completar: ' + error.message;
      } finally { button.disabled = false; }
    };
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
