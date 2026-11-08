(function(){
const $=(s,r=document)=>r.querySelector(s),K='lf.progress',LV=250;
const load=()=>{try{return JSON.parse(localStorage.getItem(K))||{done:{},xp:0}}catch(e){return{done:{},xp:0}}};
const save=p=>{try{localStorage.setItem(K,JSON.stringify(p))}catch(e){}};
const lvl=xp=>Math.floor(xp/LV)+1;
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('lf.theme',t)}catch(e){}const b=$('#theme');if(b){b.textContent=t==='dark'?'Light mode':'Dark mode';b.setAttribute('aria-label','Switch to '+(t==='dark'?'light':'dark')+' theme')}}
function nav(){const pg=document.body.dataset.page,p=load();const U=window.PRUSER,esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';'),acct=U?`<span class="chip">@${esc(U.username)}</span><button id="logout" class="btn ghost">Log out</button>`:'<a class="btn ghost" href="login.html">Log in</a><a class="btn" href="signup.html">Start free</a>';
const L=[['index.html','Home','home'],['courses.html','Courses','courses'],['lab.html?lab=playground','Playground','play'],['courses.html#progress','Progress','']];
$('#nav').innerHTML=`<a class="logo" href="index.html"><b>&gt;_</b>Panic Room</a><button class="menu btn ghost" aria-expanded="false">Menu</button><div class="links">${L.map(l=>`<a href="${l[0]}"${l[2]===pg?' class="on"':''}>${l[1]}</a>`).join('')}</div><span class="chip">Lvl ${lvl(p.xp)} · ${p.xp} XP</span><button id="theme" class="btn ghost"></button>${acct}`;
setTheme(document.documentElement.dataset.theme||'dark');
$('#theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');const lo=$('#logout');if(lo)lo.onclick=async()=>{await fetch('/api/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});location.href='index.html'};
const m=$('.menu');m.onclick=()=>m.setAttribute('aria-expanded',$('#nav').classList.toggle('open'))}
function terminal(host,lab,onRun){
const sim=PR.backend.create(lab),H=[];let hi=0;
host.innerHTML=`<div class="tbar"><span></span><span style="color:#4ade80">● sandbox ready</span></div><div class="tout"></div><form class="tin"><span class="pr"></span><input autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Terminal input"></form>`;
$('.tbar span',host).textContent=lab.title;
const out=$('.tout',host),inp=$('input',host),pr=$('.pr',host);
const P=()=>'learner@panicroom:'+(sim.cwd===sim.p('~')?'~':sim.cwd.startsWith('/home/learner/')?'~'+sim.cwd.slice(13):sim.cwd)+'$';
const add=(t,c)=>{const d=document.createElement('div');if(c)d.className=c;d.textContent=t;out.appendChild(d);out.scrollTop=out.scrollHeight};
pr.textContent=P();(lab.intro||['Welcome to the Panic Room sandbox. Type help to see what you can run.']).forEach(l=>add(l,'mute'));
host.onclick=()=>inp.focus();
$('form',host).onsubmit=async e=>{e.preventDefault();const v=inp.value;inp.value='';
const row=document.createElement('div');row.innerHTML='<span class="pr"></span> ';row.firstChild.textContent=P();row.append(v);out.appendChild(row);
if(v.trim()){H.push(v);hi=H.length;const r=await sim.run(v);
if(r.clear)out.innerHTML='';else if(r.out.trim())add(r.out.replace(/\n+$/,''),r.err?'err':'');
pr.textContent=P();out.scrollTop=out.scrollHeight;onRun&&onRun(sim)}};
inp.onkeydown=e=>{if(e.key==='ArrowUp'&&hi>0){inp.value=H[--hi];e.preventDefault()}else if(e.key==='ArrowDown'){hi=Math.min(hi+1,H.length);inp.value=H[hi]||'';e.preventDefault()}};
return{sim,add}}
function home(){terminal($('#demo'),{title:'sandbox · try anything',intro:['Welcome to the Panic Room sandbox. Type help to see what you can run.','Try: mkdir demo  ·  docker run -d --name web nginx  ·  kubectl run pod1 --image=nginx']})}
function courses(){const p=load(),T=[['Linux & Bash','linux'],['Docker & Kubernetes','cloud']],Lv=['Beginner','Intermediate','Advanced'];
const total=LABS.filter(l=>l.xp).length,done=Object.keys(p.done).length,into=p.xp%LV;
$('#main').innerHTML=`<h1>Courses</h1><section id="progress" class="prog"><div><b>Level ${lvl(p.xp)}</b><span>${p.xp} XP · ${done}/${total} labs cleared</span></div><div class="bar"><i style="width:${into/LV*100}%"></i></div><small>${LV-into} XP to level ${lvl(p.xp)+1}. Progress is saved in this browser.</small></section>`+
T.map(t=>`<section class="track"><h2>${t[0]}</h2>${Lv.map(v=>{const ls=LABS.filter(l=>l.trackId===t[1]&&l.level===v);return `<div class="lvl"><h3>${v}</h3><div class="grid">${ls.length?ls.map(l=>`<a class="card${p.done[l.id]?' done':''}" href="lab.html?lab=${l.id}"><span class="tag">${l.tool}</span><b>${l.title}</b><span>${l.summary}</span><small>${p.done[l.id]?'✓ Cleared':'+'+l.xp+' XP'}</small></a>`).join(''):'<div class="card soon"><b>Coming soon</b><span>More labs are on the way.</span></div>'}</div></div>`}).join('')}</section>`).join('')}
function labPage(){const id=new URLSearchParams(location.search).get('lab')||'playground',lab=LABS.find(l=>l.id===id);
if(!lab){$('#main').innerHTML='<p>Lab not found. <a href="courses.html">Back to courses</a></p>';return}
document.body.dataset.page=id==='playground'?'play':'courses';document.title=lab.title+' · Panic Room';
const objs=lab.objectives||[];let awarded=!!load().done[lab.id],T;
$('#main').innerHTML=`<div class="lab"><section class="lesson"><div class="meta">${lab.track}${lab.level?' · '+lab.level:''}</div><h1>${lab.title}</h1>${lab.lesson}${objs.length?'<h2>Objectives <span id="cnt"></span></h2><ol id="obj" class="obj"></ol>':''}<button id="reset" class="btn ghost">Reset sandbox</button><div id="done" class="doneBox" hidden></div></section><section class="term" id="term"></section></div>`;
$('#reset').onclick=()=>location.reload();const finish=()=>{if(!awarded){awarded=true;const q=load();q.done[lab.id]=1;q.xp+=lab.xp;save(q);T.add('✓ Lab cleared · +'+lab.xp+' XP','ok');nav()}
const i=LABS.indexOf(lab),nx=LABS[i+1];$('#done').hidden=false;$('#done').innerHTML='<b>Lab cleared</b>'+(nx?`<a class="btn" href="lab.html?lab=${nx.id}">Next: ${nx.title}</a>`:'<a class="btn" href="courses.html">Back to courses</a>')};
const draw=s=>{if(!objs.length)return;const st=objs.map(o=>{try{return !!o.check(s)}catch(e){return false}}),first=st.indexOf(false);
$('#obj').innerHTML=objs.map((o,i)=>`<li class="${st[i]?'ok':''}"><span class="tick">${st[i]?'✓':''}</span><span>${o.text}${i===first&&o.hint?`<small>Hint: ${o.hint}</small>`:''}</span></li>`).join('');
$('#cnt').textContent=st.filter(Boolean).length+'/'+objs.length;if(first<0)finish()};
T=terminal($('#term'),lab,draw);draw(T.sim)}
const pg=document.body.dataset.page;
if(pg==='home')home();else if(pg==='courses')courses();else if(pg==='lab')labPage();
nav();fetch('/api/me',{credentials:'same-origin'}).then(r=>r.json()).then(d=>d.user).catch(()=>null).then(u=>{window.PRUSER=u;nav()})})();
