(() => {
  'use strict';
  const scriptBase=new URL('./',document.currentScript?.src || new URL(location.href.includes('/board/')?'../access.js':'./access.js',location.href));
  const origin = 'https://shinagawa-discussion.delpiero.chatgpt.site';
  const key='xmeetup:shinagawa:page-proof:v1';
  const gate=document.getElementById('event-access');
  const page=document.body.dataset.eventPage;
  const content=document.getElementById('event-content');
  const form=document.getElementById('event-access-form');
  const input=document.getElementById('event-password');
  const status=document.getElementById('event-access-status');
  const button=form.querySelector('button');
  const permitted=new Set(['/api/access','/api/ideas','/api/themes','/api/comments','/api/reactions','/api/guide','/api/cover','/api/board','/api/materials']);
  let token='',showing=false;
  const read=()=>{try{return sessionStorage.getItem(key)||'';}catch{return '';}};
  const remember=value=>{try{if(value) sessionStorage.setItem(key,value); else sessionStorage.removeItem(key);}catch{}};
  function api(path,init={},proof=token) {
    const url=new URL(path,origin);
    if(url.origin!==origin||!(permitted.has(url.pathname)||/^\/api\/asset\/slides\/(?:event|worksheet)-[1-9][0-9]?\.webp$/u.test(url.pathname))) return Promise.reject(new Error('Unsupported API address'));
    const headers=new Headers(init.headers);
    if(proof) headers.set('Authorization','Bearer '+proof);
    else headers.delete('Authorization');
    return fetch(url,{...init,headers,credentials:'omit',cache:'no-store',mode:'cors',redirect:'error'});
  }
  let returning=false;
  function expire() {
    token='';remember('');
    if(showing&&!returning){returning=true;location.reload();}
  }
  Object.defineProperty(window,'__XMEETUP_ACCESS__',{value:Object.freeze({
    async request(path,init){
      if(!token) throw new Error('Login required');
      const response=await api(path,init);
      if(response.status===401) expire();
      return response;
    },
  })});
  async function approved() {
    if(showing) return;
    let fragment;
    if(page==='cover'){
      const response=await api('/api/cover');
      if(response.status===401||response.status===403){expire();throw Error('Cover login expired');}
      if(!response.ok||!(response.headers.get('Content-Type')||'').includes('text/html')) throw Error('Cover not available');
      const html=new DOMParser().parseFromString(await response.text(),'text/html');
      if(!html.querySelector('.mast')||!html.querySelector('#main'))throw Error('Unexpected cover HTML');
      for(const style of html.head.querySelectorAll('style'))document.head.append(document.importNode(style,true));
      fragment=document.createDocumentFragment();
      for(const element of html.body.children) fragment.append(document.importNode(element,true));
    }else fragment=content.content.cloneNode(true);
    showing=true;gate.remove();
    const scripts=Array.from(fragment.querySelectorAll('script'));
    for(const script of scripts)script.remove();
    content.replaceWith(fragment);
    for(const script of scripts){
      const executable=document.createElement('script');
      if(script.src){executable.src=script.getAttribute('src');executable.async=false;}
      else executable.text=script.textContent;
      document.body.append(executable);
    }
    syncManual();
    if(location.hash) requestAnimationFrame(()=>{
      let id='';try{id=decodeURIComponent(location.hash.slice(1));}catch{}
      document.getElementById(id)?.scrollIntoView();
    });
  }
  function setStatus(text){status.textContent=text;}
  async function initialize() {
    const proof=read();
    if(!proof){setStatus('');return;}
    button.disabled=true;setStatus('ログイン状態を確認しています…');
    try {
      const result=await api('/api/access',{},proof);
      if(result.status===204){token=proof;await approved();return;}
      if(result.status===401||result.status===403){expire();setStatus('ログインの有効期限が切れました。');}
      else setStatus('入口に接続できませんでした。時間をおいてお試しください。');
    } catch {setStatus('入口に接続できませんでした。時間をおいてお試しください。');}
    finally {button.disabled=false;}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(button.disabled||!input.value) return;
    const password=input.value;
    input.value='';button.disabled=true;setStatus('確認しています…');
    try {
      const result=await api('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})},'');
      if(result.status===429){setStatus('入力回数が上限に達しました。時間をおいてお試しください。');return;}
      if(result.status===401||result.status===403){setStatus('パスワードを確認して、もう一度お試しください。');return;}
      if(!result.ok) throw Error('Access request failed');
      const response=await result.json();
      if(typeof response.token!=='string'||!response.token||response.token.length>4096) throw Error('Invalid proof');
      token=response.token;remember(token);await approved();
    } catch {setStatus('入口に接続できませんでした。通信をご確認ください。');}
    finally {button.disabled=false;if(!showing) input.focus();}
  });
  let manual=null, manualOpener=null;
  function closeManual(){
    const locationUrl=new URL(location.href);
    if(history.state?.xmeetupManual){history.back();return;}
    locationUrl.searchParams.delete('manual');
    history.replaceState(history.state,'',locationUrl);
    syncManual();
  }
  function hideManual(){
    if(!manual)return;
    const {dialog,controller,urls,pdf}=manual;
    manual=null;controller.abort();
    void pdf?.destroy().catch(()=>{});
    if(dialog.open)dialog.close();
    dialog.remove();
    for(const url of urls)URL.revokeObjectURL(url);
    if(manualOpener?.isConnected)manualOpener.focus({preventScroll:true});
  }
  function syncManual(){
    if(!showing||new URL(location.href).searchParams.get('manual')!=='1'){hideManual();return;}
    if(manual)return;
    const dialog=document.createElement('dialog');
    dialog.className='event-manual';
    dialog.setAttribute('aria-labelledby','event-manual-title');
    dialog.innerHTML='<header class="event-manual-bar"><button type="button" data-manual-close>戻る</button><h1 id="event-manual-title">マニュアル</h1><button type="button" data-manual-pdf>PDFを保存</button></header><p class="event-manual-status" role="status">マニュアルを読み込んでいます…</p><div class="event-manual-pages"></div>';
    const controller=new AbortController(), urls=[];
    const current={dialog,controller,urls,pdf:null};
    manual=current;
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('[data-manual-close]').addEventListener('click',closeManual);
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeManual();});
    const note=dialog.querySelector('.event-manual-status');
    const pages=dialog.querySelector('.event-manual-pages');
    let guard=null;
    function fetchPdf(){
      if(!guard)guard=window.__XMEETUP_ACCESS__.request('/api/guide',{signal:controller.signal}).then(async response=>{
        if(!response.ok||!(response.headers.get('Content-Type')||'').toLowerCase().startsWith('application/pdf'))throw Error('PDF unavailable');
        return response.arrayBuffer();
      }).catch(error=>{guard=null;throw error;});
      return guard;
    }
    dialog.querySelector('[data-manual-pdf]').addEventListener('click',async event=>{
      const button=event.currentTarget;
      button.disabled=true;button.textContent='取得中…';
      try {
        const data=await fetchPdf();
        const blob=new Blob([data],{type:'application/pdf'});
        if(manual!==current)return;
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;a.download='x-meetup-shinagawa-guide.pdf';
        document.body.append(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),300000);
      }catch {if(manual===current)note.textContent='PDFを取得できませんでした。接続を確認して、もう一度お試しください。';}
      finally{button.disabled=false;button.textContent='PDFを保存';}
    });
    void (async ()=>{
      try {
        const [pdfjs,data]=await Promise.all([
          import(new URL('vendor/pdfjs/pdf.min.mjs?v=6.2.108',scriptBase).href),
          fetchPdf(),
        ]);
        if(manual!==current)return;
        pdfjs.GlobalWorkerOptions.workerSrc=new URL('vendor/pdfjs/pdf.worker.min.mjs?v=6.2.108',scriptBase).href;
        // Give the worker its own copy so the original bytes stay available for download.
        current.pdf=pdfjs.getDocument({data:data.slice(0),isEvalSupported:false,useSystemFonts:false,standardFontDataUrl:new URL("vendor/pdfjs/standard_fonts/",scriptBase).href});
        const doc=await current.pdf.promise;
        const stageWidth=Math.max(280,Math.min(765,dialog.clientWidth-12));
        const density=Math.min(devicePixelRatio||1,2,1200/stageWidth);
        for(let pageNo=1;pageNo<=doc.numPages;pageNo++){
          const model=await doc.getPage(pageNo);
          if(manual!==current)return;
          const original=model.getViewport({scale:1});
          const viewport=model.getViewport({scale:(stageWidth/original.width)*density});
          const surface=document.createElement('div');
          surface.className='event-manual-page';
          surface.id='event-manual-page-'+pageNo;
          const pic=document.createElement('canvas');
          pic.setAttribute('role','img');
          pic.setAttribute('aria-label','操作マニュアル '+pageNo+'ページ目（全'+doc.numPages+'ページ）');
          pic.width=Math.ceil(viewport.width);pic.height=Math.ceil(viewport.height);
          surface.append(pic);pages.append(surface);
          await model.render({canvasContext:pic.getContext('2d',{alpha:false}),viewport}).promise;
          if(manual!==current)return;
          for(const item of await model.getAnnotations({intent:'display'})){
            if(item.subtype!=='Link'||!item.rect||(!item.url&&!item.dest))continue;
            const [x1,y1,x2,y2]=viewport.convertToViewportRectangle(item.rect);
            const annotation=document.createElement('a');
            annotation.className='event-manual-annotation';
            annotation.style.cssText='left:'+(100*Math.min(x1,x2)/viewport.width)+'%;top:'+(100*Math.min(y1,y2)/viewport.height)+'%;width:'+(100*Math.abs(x1-x2)/viewport.width)+'%;height:'+(100*Math.abs(y1-y2)/viewport.height)+'%';
            if(item.url){
              let address;try{address=new URL(item.url);}catch{continue;}
              if(address.protocol!=='https:')continue;
              annotation.href=address.href;
              annotation.setAttribute('aria-label','マニュアル内のリンクを開く');
            }else{
              const reference=typeof item.dest==='string'?await doc.getDestination(item.dest):item.dest;
              if(!Array.isArray(reference)||!reference.length)continue;
              const index=typeof reference[0]==='number'?reference[0]:await doc.getPageIndex(reference[0]).catch(()=>-1);
              if(index<0)continue;
              annotation.href='#event-manual-page-'+(index+1);
              annotation.setAttribute('aria-label','マニュアル '+(index+1)+'ページ目へ');
              annotation.addEventListener('click',event=>{
                const target=document.getElementById('event-manual-page-'+(index+1));
                if(target){event.preventDefault();target.scrollIntoView({block:'start'});}
              });
            }
            surface.append(annotation);
          }
          note.textContent=pageNo<doc.numPages?'マニュアルを読み込んでいます（'+pageNo+'/'+doc.numPages+'）…':'';
          model.cleanup();
        }
      }catch{
        if(manual===current)note.textContent='画面に表示できません。「PDFを保存」からマニュアルを確認できます。';
      }
    })();
  }
  document.addEventListener('click',event=>{
    const anchor=event.target instanceof Element ? event.target.closest('a[href]') : null;
    if(!anchor||!showing||!token) return;
    const href=new URL(anchor.href);
    if(href.pathname!=='/guide.pdf'||(href.origin!==origin&&href.origin!==location.origin)) return;
    event.preventDefault();
    manualOpener=anchor;
    const target=new URL(location.href);
    if(target.searchParams.get('manual')!=='1'){
      target.searchParams.set('manual','1');
      try{history.pushState({...history.state,xmeetupManual:true},'',target);}
      catch { location.assign(target);return; }
    }
    syncManual();
  },true);
  window.addEventListener('popstate',syncManual);
  window.addEventListener('pageshow',async event=>{
    if(!event.persisted||!showing||!token)return;
    try {
      const result=await api('/api/access');
      if(result.status===401||result.status===403)expire();
    } catch {}
  });
  void initialize();
})();
