/* LOCURA TOTAL PRODUCT CHECK — cámara continua y galería, hasta 6 fotos libres.
   Se pueden mezclar fotos de ambas fuentes. Complementa multifoto.js y no guarda imágenes en la nube.
*/
(() => {
  'use strict';
  if (window.locuraCamara6Loaded) return;
  window.locuraCamara6Loaded = true;

  const $ = id => document.getElementById(id);
  const MAX = 6;
  let stream = null;
  let shots = [];
  let busy = false;
  let opening = false;
  let front = false;
  let galleryInput = null;

  const css = `
    #locuraCameraOverlay[hidden]{display:none!important}
    #locuraCameraOverlay{position:fixed;inset:0;z-index:2147483000;background:#090810f7;color:white;
      display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;
      font-family:system-ui,Arial,sans-serif}
    #locuraCameraBox{width:min(100%,520px);max-height:96dvh;overflow-y:auto;border:2px solid #f244b3;
      border-radius:16px;background:#211a29;padding:14px;box-sizing:border-box}
    #locuraCameraBox *{box-sizing:border-box}
    #locuraCameraBox h2{font-size:19px;margin:0 0 5px}
    #locuraCameraBox .lc-sub{font-size:14px;color:#e4d5e6;margin:5px 0 10px}
    #locuraCameraVideo{width:100%;max-height:45dvh;min-height:210px;background:#000;border-radius:12px;
      object-fit:contain;display:block}
    #locuraCameraPreview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:10px}
    .locuraSlot{height:66px;border:1px dashed #8f7797;border-radius:8px;display:grid;place-items:center;
      overflow:hidden;font-size:16px;background:#110e18}
    .locuraSlot img{width:100%;height:100%;object-fit:cover}
    #locuraCameraOverlay button{border:0;border-radius:10px;padding:12px 14px;min-height:45px;
      background:#f244b3;color:#140b19;font-weight:750;font:inherit;cursor:pointer}
    #locuraCameraOverlay button.secondary{background:#504357;color:white}
    #locuraCameraOverlay button:disabled{opacity:.45;cursor:not-allowed}
    #locuraCameraActions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px}
    #locuraCameraStatus{font-size:14px;white-space:pre-wrap;margin:10px 0;min-height:22px;color:#f2d9a9}
    #locuraCameraButton,#locuraGalleryButton{display:inline-block;margin:10px 8px 10px 0!important}
    #locuraCameraButton{background:#f244b3!important;color:#140b19!important}
    #locuraGalleryButton{background:#504357!important;color:#fff!important}
    #locuraCameraVideo[hidden]{display:none!important}
  `;

  function report(message){
    const target = $('locuraCameraStatus');
    if(target) target.textContent = message;
  }
  function stopCamera(){
    if(stream){for(const track of stream.getTracks()) track.stop();stream=null;}
    const v=$('locuraCameraVideo');
    if(v){v.pause();v.srcObject=null;}
  }
  function closeCamera(){
    stopCamera();
    const overlay=$('locuraCameraOverlay');
    if(overlay) overlay.hidden=true;
    opening=false;
    for(const photo of shots) URL.revokeObjectURL(photo.preview);
    shots=[];
  }
  function render(){
    const holder=$('locuraCameraPreview');
    if(!holder)return;
    holder.replaceChildren();
    for(let i=0;i<MAX;i++){
      const slot=document.createElement('div');
      slot.className='locuraSlot';
      if(shots[i]){
        const img=document.createElement('img');
        img.src=shots[i].preview;
        img.alt='Foto '+(i+1);
        slot.append(img);
      } else slot.textContent=String(i+1);
      holder.append(slot);
    }
    const remaining=MAX-shots.length;
    $('locuraShoot').disabled=busy||!stream||remaining===0;
    $('locuraShoot').textContent=remaining ? `📸 Capturar (${shots.length}/${MAX})` : '✅ 6 fotos listas';
    $('locuraUse').disabled=busy||shots.length===0;
    $('locuraUse').textContent=shots.length ? `✅ Analizar ${shots.length} foto${shots.length===1?'':'s'}` : '✅ Analizar fotos';
    $('locuraUndo').disabled=busy||shots.length===0;
  }
  async function startCamera(){
    if(opening)return;
    opening=true;
    try{
      if(!navigator.mediaDevices?.getUserMedia){
        throw new Error('Este navegador no permite usar la cámara integrada. Abre la web en Chrome con HTTPS.');
      }
      if(shots.length>=MAX){report('Ya tienes 6 fotos. Analiza o quita una.');return;}
      stopCamera();
      stream=await navigator.mediaDevices.getUserMedia({
        audio:false,video:{facingMode:{ideal:front?'user':'environment'},width:{ideal:1920},height:{ideal:1080}}
      });
      const v=$('locuraCameraVideo');
      v.hidden=false;
      v.srcObject=stream;
      await v.play();
      report(`Cámara lista. ${shots.length}/${MAX} fotos. Puedes disparar o elegir de la galería, sin orden.`);
      render();
    }catch(err){
      stopCamera();
      report('No se pudo abrir la cámara: '+(err?.message||'comprueba el permiso en Chrome')+'. Puedes elegir fotos de la galería.');
    }finally{opening=false;}
  }
  function openCamera(){
    for(const photo of shots) URL.revokeObjectURL(photo.preview);
    shots=[];front=false;
    $('locuraCameraOverlay').hidden=false;
    $('locuraCameraVideo').hidden=false;
    render();
    report('Abriendo cámara...');
    startCamera();
  }
  async function takePhoto(){
    if(busy||shots.length>=MAX||!stream)return;
    busy=true;
    try{
      const video=$('locuraCameraVideo');
      if(!video.videoWidth||!video.videoHeight) throw new Error('La cámara todavía no está preparada.');
      const k=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(video.videoWidth*k));
      canvas.height=Math.max(1,Math.round(video.videoHeight*k));
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.8));
      if(!blob)throw new Error('No se pudo capturar la fotografía.');
      const file=new File([blob],`locura-foto-${shots.length+1}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
      shots.push({file,preview:URL.createObjectURL(blob)});
      if(shots.length===MAX){
        report('¡6 fotos realizadas! Revisa las miniaturas o pulsa «Analizar las fotos».');
        stopCamera(); // cámara usada una sola vez; ya están las seis fotos en memoria
      }else report('Foto '+shots.length+' guardada. Haz la siguiente sin salir de la cámara.');
    }catch(e){report('Error en la foto: '+e.message);}
    finally{busy=false;render();}
  }
  function undo(){
    if(!shots.length||busy)return;
    const removed=shots.pop();
    URL.revokeObjectURL(removed.preview);
    report('Última foto eliminada. Puedes capturar otra o elegir de la galería.');
    render();
  }
  function usePhotos(){
    if(busy||shots.length===0){report('Selecciona o captura al menos una foto.');return;}
    const input=$('multiPhotos');
    const analysis=$('multiAnalyze');
    if(!input||!analysis){report('No se encuentra el módulo multifoto. Actualiza la página.');return;}
    try{
      // El módulo multifoto guarda las fotos internamente. Vaciamos las anteriores
      // mediante sus propios botones, y disparamos su evento de cambio nativo.
      const thumbs=$('multiThumbs');
      for(let n=0;n<MAX;n++){
        const remove=thumbs?.querySelector('button');
        if(!remove)break;
        remove.click();
      }
      const transfer=new DataTransfer();
      for(const s of shots)transfer.items.add(s.file);
      input.files=transfer.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
      const count=shots.length;
      closeCamera();
      const status=$('multiStatus');
      if(status)status.textContent=`${count} fotos incorporadas. Comenzando análisis...`;
      analysis.click();
      analysis.scrollIntoView({block:'center',behavior:'smooth'});
    }catch(e){report('No se pudieron incorporar las fotos: '+e.message);}
  }
  function init(){
    const section=$('locuraMultifoto'),input=$('multiPhotos');
    if(!section||!input||$('locuraCameraButton'))return;
    const hint=section.querySelector('p.muted');
    if(hint)hint.textContent='Hasta 6 fotos del mismo producto. Cámara o galería, sin orden ni posiciones obligatorias.';
    const style=document.createElement('style');style.textContent=css;document.head.append(style);
    const btn=document.createElement('button');
    btn.type='button';btn.id='locuraCameraButton';
    btn.textContent='📷 Abrir cámara (hasta 6 fotos)';
    input.insertAdjacentElement('beforebegin',btn);
    const galleryBtn=document.createElement('button');
    galleryBtn.type='button';galleryBtn.id='locuraGalleryButton';
    galleryBtn.textContent='🖼️ Elegir de la galería';
    btn.insertAdjacentElement('afterend',galleryBtn);
    galleryInput=document.createElement('input');
    galleryInput.type='file';galleryInput.multiple=true;
    galleryInput.accept='image/jpeg,image/png,image/webp';
    galleryInput.id='locuraGalleryPicker';galleryInput.hidden=true;
    document.body.append(galleryInput);
    const overlay=document.createElement('div');
    overlay.id='locuraCameraOverlay';overlay.hidden=true;
    overlay.innerHTML=`<div id="locuraCameraBox" role="dialog" aria-modal="true" aria-label="Cámara para seis fotos">
      <h2>📷 LOCURA TOTAL · 6 FOTOS</h2>
      <p class="lc-sub">Captura o elige hasta 6 fotos como quieras, sin orden.</p>
      <video id="locuraCameraVideo" autoplay playsinline muted></video>
      <div id="locuraCameraPreview" aria-label="Fotos capturadas"></div>
      <p id="locuraCameraStatus" role="status" aria-live="polite"></p>
      <div id="locuraCameraActions">
        <button type="button" id="locuraShoot">📸 Capturar foto</button>
        <button type="button" id="locuraPickGallery" class="secondary">🖼️ Galería</button>
        <button type="button" id="locuraRestartCamera" class="secondary">📷 Usar cámara</button>
        <button type="button" id="locuraUse" class="secondary">✅ Analizar fotos</button>
        <button type="button" id="locuraUndo" class="secondary">↩ Repetir última</button>
        <button type="button" id="locuraCancel" class="secondary">✖ Salir</button>
      </div></div>`;
    document.body.append(overlay);
    btn.addEventListener('click',openCamera);
    const pickGallery=()=>{if(!busy)galleryInput.click();};
    galleryBtn.addEventListener('click',pickGallery);
    $('locuraPickGallery').addEventListener('click',pickGallery);
    $('locuraRestartCamera').addEventListener('click',()=>{if(!busy)startCamera();});
    galleryInput.addEventListener('change',()=>{
      const chosen=[...galleryInput.files];galleryInput.value='';
      if(!chosen.length)return;
      const wasClosed=$('locuraCameraOverlay').hidden;
      if(wasClosed){
        stopCamera();
        for(const photo of shots)URL.revokeObjectURL(photo.preview);
        shots=[];
        $('locuraCameraOverlay').hidden=false;
      }
      let rejected=0;
      for(const f of chosen){
        if(shots.length>=MAX){rejected++;continue;}
        if(!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size>18*1024*1024){rejected++;continue;}
        shots.push({file:f,preview:URL.createObjectURL(f)});
      }
      if(shots.length===MAX)stopCamera();
      $('locuraCameraVideo').hidden=!stream;
      report(`${shots.length}/6 fotos añadidas. ${rejected?'Algunas no se añadieron (máximo 6 o formato no admitido). ':''}Puedes analizar o completar usando la cámara.`);
      render();
    });
    $('locuraShoot').addEventListener('click',takePhoto);
    $('locuraUse').addEventListener('click',usePhotos);
    $('locuraUndo').addEventListener('click',undo);
    $('locuraCancel').addEventListener('click',closeCamera);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden&& !$('locuraCameraOverlay')?.hidden){
        stopCamera();report('Cámara detenida al salir de la aplicación. Pulsa Salir y vuelve a abrirla si es necesario.');render();
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
