(() => {
  'use strict';
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
  document.addEventListener('click',async event=>{
    const anchor=event.target instanceof Element ? event.target.closest('a[href]') : null;
    if(!anchor||!showing||!token) return;
    const href=new URL(anchor.href);
    if(href.pathname!=='/guide.pdf'||(href.origin!==origin&&href.origin!==location.origin)) return;
    event.preventDefault();
    const tab=window.open('about:blank','_blank');
    if(tab)tab.opener=null;
    try {
      const response=await window.__XMEETUP_ACCESS__.request('/api/guide');
      if(!response.ok||!(response.headers.get('Content-Type')||'').toLowerCase().startsWith('application/pdf'))throw Error('Guide not available');
      const url=URL.createObjectURL(await response.blob());
      if(tab) tab.location.replace(url);
      else location.assign(url);
      setTimeout(()=>URL.revokeObjectURL(url),120000);
    } catch {tab?.close();window.alert('マニュアルを開けませんでした。接続を確認して、もう一度お試しください。');}
  },true);
  window.addEventListener('pageshow',async event=>{
    if(!event.persisted||!showing||!token)return;
    try {
      const result=await api('/api/access');
      if(result.status===401||result.status===403)expire();
    } catch {}
  });
  void initialize();
})();
