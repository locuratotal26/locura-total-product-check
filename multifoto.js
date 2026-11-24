/* LOCURA TOTAL — extensión de análisis de varias fotos */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const text = value => value == null ? '' : String(value).trim();
 let photos = [];
 async function reducePhoto(file) {
   if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Utiliza JPG, PNG o WEBP');
   if (file.size > 18 * 1024 * 1024) throw new Error('Una imagen supera 18 MB');
   const bitmap = await createImageBitmap(file);
   try {
     const k = Math.min(1, 1400 / Math.max(bitmap.width,bitmap.height));
     const canvas = document.createElement('canvas');
     canvas.width = Math.max(1,Math.round(bitmap.width*k));
     canvas.height = Math.max(1,Math.round(bitmap.height*k));
     const ctx=canvas.getContext('2d');
     ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
     ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
     return canvas.toDataURL('image/jpeg',0.72);
   } finally { bitmap.close(); }
 }
 function init() {
   if (!$('productForm') || $('locuraMultifoto')) return;
   const panel = document.createElement('section');
   panel.id='locuraMultifoto'; panel.className='panel';
   panel.style.border='2px solid #f244b3';
   panel.innerHTML=`<h2>📸 Analizar varias fotos de un producto</h2>
     <p class="muted">Selecciona hasta 6 fotos del mismo producto, sin orden ni posiciones obligatorias.</p>
     <label for="multiPhotos">Fotografías</label>
     <input type="file" id="multiPhotos" multiple accept="image/jpeg,image/png,image/webp">
     <div id="multiThumbs" class="grid"></div>
     <button type="button" id="multiAnalyze">✨ Analizar todas y preparar ficha</button>
     <p id="multiStatus" role="status" aria-live="polite"></p>
     <div id="multiResult" hidden></div>`;
   $('productForm').parentElement.insertBefore(panel,$('productForm'));
   const input=$('multiPhotos'), thumbs=$('multiThumbs'), status=$('multiStatus'), result=$('multiResult'), button=$('multiAnalyze');
   function showPhotos() {
     thumbs.replaceChildren();
     photos.forEach((file,i)=>{
       const block=document.createElement('div');
       const pic=document.createElement('img');
       pic.src=URL.createObjectURL(file); pic.onload=()=>URL.revokeObjectURL(pic.src);
       pic.alt='Foto '+(i+1); pic.style='width:100%;height:100px;object-fit:contain';
       const remove=document.createElement('button'); remove.type='button'; remove.className='secondary';
       remove.textContent='Quitar foto '+(i+1);
       remove.onclick=()=>{photos.splice(i,1);result.hidden=true;showPhotos();};
       block.append(pic,remove);thumbs.append(block);
     });
     status.textContent=photos.length+'/6 fotos seleccionadas';
   }
   input.onchange=()=>{
     const files=[...input.files]; const available=6-photos.length;
     photos.push(...files.slice(0,available)); input.value=''; showPhotos();
     if(files.length>available)status.textContent='Máximo 6 fotos; elimina alguna para cambiarla.';
   };
   function fill(id,value) {
     const el=$(id);if(el && text(value)) {el.value=text(value);el.dispatchEvent(new Event('input',{bubbles:true}));}
   }
   button.onclick=async()=>{
     if(!photos.length){status.textContent='Primero selecciona las fotografías.';return;}
     const db=window.locuraDb;
     if(!db?.functions?.invoke){status.textContent='Inicia sesión en la aplicación.';return;}
     button.disabled=true;result.hidden=true;
     try {
       const session=(await db.auth.getSession()).data?.session;
       if(!session) throw new Error('Inicia sesión de nuevo');
       status.textContent='Preparando fotografías...';
       const images=await Promise.all(photos.map(reducePhoto));
       if(images.some(x=>x.length>4000000) || images.reduce((s,x)=>s+x.length,0)>15000000)throw Error('Las fotos ocupan demasiado; elige imágenes más pequeñas');
       status.textContent='La IA está leyendo todas las etiquetas...';
       const {data,error}=await db.functions.invoke('analizar-producto-multifoto',{body:{images}});
       if(error || !data?.product) throw Error(data?.error||error?.message||'Error de análisis');
       const p=data.product;
       result.replaceChildren();
       const fields=[['Producto','name'],['Marca','brand'],['Modelo','model'],['Fabricante declarado','manufacturer'],['Dirección','manufacturer_address'],['Teléfono','manufacturer_phone'],['EAN/UPC','barcode'],['Características','features'],['Peso kg','weight_kg'],['Alimentación','electrical'],['Fecha de fabricación','manufacture_date'],['Norma','standard'],['Estado','condition_observed'],['Observaciones','notes']];
       for(const [label,key] of fields){if(p[key]!=='' && p[key]!=null){const row=document.createElement('p');const strong=document.createElement('strong');strong.textContent=label+': ';row.append(strong,document.createTextNode(text(p[key])));result.append(row);}}
       const note=document.createElement('p');note.className='notice';note.textContent='Comprueba los datos de la etiqueta. La IA no certifica autenticidad ni estado nuevo.';
       const apply=document.createElement('button');apply.type='button';apply.textContent='✅ Aplicar a ficha editable';
       apply.onclick=()=>{        
fill('name', p.name);
fill('brand', p.brand);

if ($('model')) {
  $('model').value = '';
}

if (p.model && !/^(no |sin |desconocido|pendiente)/i.test(text(p.model))) {
  fill('model', p.model);
}

fill('barcode', p.barcode);
fill('manualCode', p.barcode);
fill('weight', p.weight_kg);        const details=[p.model?'Modelo: '+p.model:'',p.features,p.manufacturer_address?'Dirección fabricante: '+p.manufacturer_address:'',p.manufacturer_phone?'Contacto: '+p.manufacturer_phone:'',p.electrical?'Alimentación: '+p.electrical:'',p.manufacture_date?'Fabricación: '+p.manufacture_date:'',p.standard?'Norma: '+p.standard:'',p.notes].filter(Boolean).join('\n');
         fill('features',details);
         if($('condition'))$('condition').value='Sin comprobar';
         if($('auth'))$('auth').value='Sin verificar';
         status.textContent='Ficha rellenada para revisar. No se ha guardado ni publicado.';
         $('name').scrollIntoView({behavior:'smooth',block:'center'});
       };
       result.append(note,apply);result.hidden=false;
       status.textContent='Análisis completado: '+(data.photos_analyzed||photos.length)+' fotos.';
     } catch(e) {status.textContent='Error: '+e.message;}
     finally{button.disabled=false;}
   };
   showPhotos();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
