/* Cuaderno de Sala · cuentas (Supabase) e IA (función de Supabase «ia»).
   Ofrece a la página la misma interfaz que usa dentro de Claude: claude.use('db' | 'user' | 'sample' | 'downloads'). */
(function(){
  const C = window.CUADERNO_CONFIG || {};
  const configurado = C.supabaseUrl && !/TU-PROYECTO/.test(C.supabaseUrl) && C.supabaseAnonKey && !/TU-ANON/.test(C.supabaseAnonKey);
  if(!configurado || !window.supabase){ console.warn('Cuaderno de Sala: falta completar config.js'); return; }
  window.__cuentaWeb = true;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
  let sesion = null, avisar = null;
  const listo = new Promise(res => { avisar = res; });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const cuandoListo = fn => document.body ? fn() : document.addEventListener('DOMContentLoaded', fn, {once:true});
  function pantalla(modo, msg, err){ cuandoListo(() => pantallaYa(modo, msg, err)); }
  function pantallaYa(modo, msg, err){
    let el = document.getElementById('cuenta');
    if(!el){ el = document.createElement('div'); el.id = 'cuenta'; el.className = 'overlay'; document.body.appendChild(el); }
    el.hidden = false; document.body.style.overflow = 'hidden';
    if(modo==='olvido' && !C.mailRecuperacion){
      el.innerHTML = `<div class="ovcard cuentaf"><div class="ovfecha">Cuaderno de Sala</div><div class="ovhola">Recuperar la contraseña</div>
        <p class="small" style="margin:0">Por ahora la web no manda mails para recuperar la contraseña. Pedile ayuda a quien te compartió el Cuaderno: te la restablece y no perdés nada de lo que cargaste.</p>
        <button type="button" class="btn pri big" data-m="entrar" style="width:100%;justify-content:center">Volver</button></div>`;
      el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => pantalla(b.dataset.m)); return;
    }
    const titulo = {entrar:'Entrar a tu cuaderno', crear:'Crear tu cuenta', olvido:'Recuperar la contraseña', nueva:'Elegí una contraseña nueva'}[modo];
    el.innerHTML = `<form class="ovcard cuentaf" novalidate>
      <div class="ovfecha">Cuaderno de Sala</div><div class="ovhola">${titulo}</div>
      ${msg?`<p class="small" style="margin:0;color:${err?'var(--err)':'var(--ink)'}">${esc(msg)}</p>`:''}
      ${modo!=='nueva'?`<label class="field" style="width:100%;text-align:left">Email<input type="email" id="cEmail" autocomplete="email" required></label>`:''}
      ${modo!=='olvido'?`<label class="field" style="width:100%;text-align:left">${modo==='nueva'?'Contraseña nueva':'Contraseña'}<input type="password" id="cPass" autocomplete="${modo==='entrar'?'current-password':'new-password'}" minlength="6" required></label>`:''}
      ${modo==='crear'||modo==='nueva'?`<label class="field" style="width:100%;text-align:left">Repetí la contraseña<input type="password" id="cPass2" autocomplete="new-password" minlength="6" required></label><p class="small muted" style="margin:-4px 0 0;text-align:left">Elegí una que recuerdes: la vas a usar cada vez que entres.</p>`:''}
      <button class="btn pri big" type="submit" style="width:100%;justify-content:center">${{entrar:'Entrar', crear:'Crear cuenta', olvido:'Mandarme el link', nueva:'Guardar contraseña'}[modo]}</button>
      ${modo==='entrar'?`<div class="row" style="justify-content:space-between;width:100%"><button type="button" class="linkish" data-m="crear">Crear una cuenta</button><button type="button" class="linkish" data-m="olvido">Olvidé mi contraseña</button></div>`:''}
      ${modo==='crear'||modo==='olvido'?`<button type="button" class="linkish" data-m="entrar">Ya tengo cuenta</button>`:''}
      <p class="small muted" style="margin:0">Tus datos y los de tus alumnos son privados: solo vos los ves.</p></form>`;
    el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => pantalla(b.dataset.m));
    const f = el.querySelector('form');
    f.onsubmit = async ev => {
      ev.preventDefault();
      const email = (el.querySelector('#cEmail')?.value || '').trim(), pass = el.querySelector('#cPass')?.value || '';
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try{
        if(modo==='entrar'){ const {error} = await sb.auth.signInWithPassword({email, password:pass}); if(error) throw error; }
        else if(modo==='crear'){
          if(!/^\S+@\S+\.\S+$/.test(email)) throw {message:'Revisá el email: parece incompleto.'};
          if(pass.length<6) throw {message:'La contraseña tiene que tener al menos 6 caracteres.'};
          if(pass !== (el.querySelector('#cPass2')?.value||'')) throw {message:'Las dos contraseñas no coinciden.'};
          const {data, error} = await sb.auth.signUp({email, password:pass, options:{emailRedirectTo: location.origin}}); if(error) throw error;
          if(!data.session){ pantalla('entrar','Te mandamos un mail para confirmar la cuenta. Abrilo y después entrá acá.'); return; }
        }
        else if(modo==='olvido'){ const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin}); if(error) throw error; pantalla('entrar','Si el email tiene cuenta, te llegó un link para elegir una contraseña nueva.'); return; }
        else if(modo==='nueva'){ if(pass.length<6) throw {message:'La contraseña tiene que tener al menos 6 caracteres.'}; if(pass !== (el.querySelector('#cPass2')?.value||'')) throw {message:'Las dos contraseñas no coinciden.'}; const {error} = await sb.auth.updateUser({password:pass}); if(error) throw error; }
      }catch(e){ btn.disabled = false; const m = String(e?.message||'');
        pantalla(modo, /invalid login/i.test(m)?'El email o la contraseña no coinciden.':/registered/i.test(m)?'Ese email ya tiene cuenta. Probá entrar.':/confirm/i.test(m)?'Falta confirmar la cuenta desde el mail que te mandamos.':/rate limit|too many/i.test(m)?'Hubo demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.':/fetch|network/i.test(m)?'No hay conexión a internet. Revisala y probá de nuevo.':/invalid.*email|email.*invalid|validate email/i.test(m)?'Revisá el email: parece incompleto.':/not authorized/i.test(m)?'No pudimos mandar el mail a esa dirección.':/password/i.test(m)&&/char|length|short/i.test(m)?'La contraseña tiene que tener al menos 6 caracteres.':/[áéíóúñ¿]|^(La|Las|Revisá|Ese|El)\b/.test(m)?m:'No se pudo. Probá de nuevo.', true); }
    };
    setTimeout(() => el.querySelector('input')?.focus(), 30);
  }
  function cerrarPantalla(){ const el = document.getElementById('cuenta'); if(el){ el.hidden = true; el.innerHTML=''; } if(document.body) document.body.style.overflow=''; }

  sb.auth.onAuthStateChange((ev, ses) => {
    if(ev === 'PASSWORD_RECOVERY'){ sesion = ses; pantalla('nueva'); return; }
    if(ses){ sesion = ses; cerrarPantalla(); avisar && avisar(); }
  });
  sb.auth.getSession().then(({data}) => { if(data.session){ sesion = data.session; avisar(); } else if(!/type=recovery/.test(location.hash)) pantalla('entrar'); });

  const db = { collection(){ return {
    get: async () => { const {data, error} = await sb.from('cuaderno_docs').select('id,data'); if(error) throw error; return {docs: data.map(r => ({id:r.id, data:() => r.data}))}; },
    doc: id => ({
      set: async body => { const {error} = await sb.from('cuaderno_docs').upsert({user_id: sesion.user.id, id, data: body, updated_at: new Date().toISOString()}); if(error) throw error; },
      delete: async () => { const {error} = await sb.from('cuaderno_docs').delete().eq('id', id); if(error) throw error; }
    })
  }; } };
  const user = { id: async () => sesion.user.id, isOwner: () => true, canEdit: () => true };
  const aB64 = b => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok({type: b.type || 'image/jpeg', data: String(r.result).split(',')[1]}); r.onerror = mal; r.readAsDataURL(b); });
  async function ia(input, opts = {}, json){
    const body = {prompt: typeof input === 'string' ? input : (input.at(-1)?.content || ''), json: !!json, tier: opts.modelTier || 'default'};
    if(opts.images?.length) body.images = await Promise.all(opts.images.slice(0,4).map(aB64));
    const {data} = await sb.auth.getSession();
    let r;
    try{ r = await fetch(C.supabaseUrl+'/functions/v1/ia', {method:'POST', headers:{'content-type':'application/json', apikey: C.supabaseAnonKey, authorization:'Bearer '+(data.session?.access_token||'')}, body: JSON.stringify(body), signal: opts.signal}); }
    catch(e){ if(e?.name==='AbortError') throw {code:'cancelled'}; throw {code:'error'}; }
    const out = await r.json().catch(() => ({}));
    if(r.status===429) throw {code:'rate_limited'};
    if(r.status===401) throw {code:'session_expired'};
    if(!r.ok) throw {code: out.error==='invalid_json' ? 'invalid_json' : out.error==='config' ? 'config' : 'error'};
    return out;
  }
  const sample = async (input, opts) => { const o = await ia(input, opts, false); return {text: o.text || '', truncated: false}; };
  sample.json = async (input, opts) => (await ia(input, opts, true)).json;
  sample.limits = async () => ({images: true});
  // ¿Está activada la IA? (si falta la clave en el servidor, no mostramos los botones de IA)
  const iaActiva = fetch(C.supabaseUrl+'/functions/v1/ia', {method:'POST', headers:{'content-type':'application/json', apikey: C.supabaseAnonKey}, body:'{}'})
    .then(r => r.json().then(o => o.error !== 'config').catch(() => true)).catch(() => true);
  const downloads = { save: async ({filename, data}) => { const url = URL.createObjectURL(data), a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); } };
  window.claude = { use: async n => { await listo; if(n==='sample') return (await iaActiva) ? sample : null; return ({db, user, sample, downloads})[n] || null; } };
  window.cuadernoSalir = async () => { try{ localStorage.removeItem('informes-sala-v2'); }catch(e){} await sb.auth.signOut(); location.reload(); };
})();
