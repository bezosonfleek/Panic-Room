// Backend interface: PR.backend.create(lab) returns a session with async run(line) -> {out, err, clear} and state for objective checks.
// A real backend (WebSocket to your VPS or home lab) only needs to implement the same run().
(function(){
const U='/home/learner',pad=(a,w)=>String(a).padEnd(w),DATE=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'});
const IMG=['nginx','redis','alpine','ubuntu','busybox','httpd','postgres'],NAMES=['quirky_turing','brave_curie','calm_hopper','eager_ritchie'];
const LIM={nodes:400,file:65536,total:262144,path:200,cmd:500,out:20000};
const hex=n=>Array.from({length:n},()=>'0123456789abcdef'[Math.random()*16|0]).join('');
const ago=t=>{const s=Math.max(1,Math.round((Date.now()-t)/1000));return s<60?s+'s':Math.floor(s/60)+'m'};
const ms=f=>(f.t==='d'?'d':'-')+[...'rwxrwxrwx'].map((c,i)=>f.m&(1<<(8-i))?c:'-').join('');
class Sim{
constructor(){this.cwd=U;this.hist=[];this.pods=[];this.ctrs=[];this.imgs=[];this.saw={};
this.fs={'/':{t:'d',m:493},'/home':{t:'d',m:493},[U]:{t:'d',m:493},'/etc':{t:'d',m:493},'/tmp':{t:'d',m:511},
[U+'/welcome.txt']:{t:'f',m:420,c:'Welcome to Panic Room.\nType help to see what you can run.\n'},'/etc/hostname':{t:'f',m:420,c:'panicroom\n'}}}
p(x){x=x||'~';if(x==='~')x=U;else if(x.startsWith('~/'))x=U+x.slice(1);if(x[0]!=='/')x=this.cwd+'/'+x;const o=[];for(const s of x.split('/')){if(!s||s==='.')continue;s==='..'?o.pop():o.push(s)}return '/'+o.join('/')}
exists(x){return !!this.fs[this.p(x)]}
isDir(x){const f=this.fs[this.p(x)];return !!f&&f.t==='d'}
mode(x){const f=this.fs[this.p(x)];return f?f.m.toString(8):null}
read(x){const f=this.fs[this.p(x)];return f&&f.t==='f'?f.c:null}
kids(d){const pre=d==='/'?'/':d+'/';return Object.keys(this.fs).filter(k=>k!==d&&k.startsWith(pre)&&!k.slice(pre.length).includes('/')).map(k=>k.slice(pre.length)).sort()}
chk(n,b,q){if(q&&q.length>LIM.path)throw new Error('File name too long');if(b>LIM.file)throw new Error('File too large (limit '+LIM.file/1024+' KB in this sandbox)');const ks=Object.keys(this.fs);if(ks.length+n>LIM.nodes)throw new Error('Too many files in this sandbox');if(b&&ks.reduce((a,k)=>a+(this.fs[k].c||'').length,0)+b>LIM.total)throw new Error('Sandbox storage full')}
mk(x,t,c){const q=this.p(x),par=q.slice(0,q.lastIndexOf('/'))||'/';if(!this.isDir(par))throw new Error("cannot create '"+x+"': No such file or directory");this.chk(1,(c||'').length,q);this.fs[q]=t==='d'?{t:'d',m:493}:{t:'f',m:420,c:c||''}}
tok(s){const t=[];let c='',q=null,h=false;const fl=()=>{if(h||c){t.push(c);c='';h=false}};
for(let i=0;i<s.length;i++){const ch=s[i];if(q){ch===q?q=null:c+=ch;continue}
if(ch==='"'||ch==="'"){q=ch;h=true;continue}
if(/\s/.test(ch)){fl();continue}
if(ch==='|'||ch==='>'){fl();if(ch==='>'&&s[i+1]==='>'){t.push({op:'>>'});i++}else t.push({op:ch});continue}
c+=ch;h=true}
if(q)throw new Error('bash: unterminated quote');fl();return t}
async run(line){line=line.trim();if(!line)return{out:''};if(line.length>LIM.cmd)return{out:'Command too long (limit '+LIM.cmd+' characters)',err:true};
try{let out=this.exec(line);if(out.length>LIM.out)out=out.slice(0,LIM.out)+'\n[output truncated]';this.hist.push(line);return{out,err:false,clear:out==='\u0000clear'}}catch(e){return{out:e.message,err:true}}}
exec(line){const segs=[[]];for(const x of this.tok(line))typeof x==='object'&&x.op==='|'?segs.push([]):segs[segs.length-1].push(x);
let out='';
for(const s of segs){let rd=null;const a=[];
for(let j=0;j<s.length;j++){if(typeof s[j]==='object'){rd={m:s[j].op,f:s[j+1]};if(!rd.f)throw new Error('bash: syntax error near unexpected token `newline\'');j++}else a.push(s[j])}
if(!a.length)throw new Error('bash: syntax error');
out=this.cmd(a,out);
if(rd){const f=this.fs[this.p(rd.f)];if(f&&f.t==='d')throw new Error('bash: '+rd.f+': Is a directory');if(!f||rd.m==='>')this.mk(rd.f,'f',out);else{this.chk(0,f.c.length+out.length);f.c+=out}out=''}}
return out}
cmd(a,inp){const[c,...r]=a,fl=r.filter(x=>x[0]==='-'),ar=r.filter(x=>x[0]!=='-'),has=f=>fl.some(x=>x.includes(f));
const need=n=>{if(ar.length<n)throw new Error(c+': missing operand')};
const files=(names)=>names.map(n=>{const f=this.fs[this.p(n)];if(!f)throw new Error(c+': '+n+': No such file or directory');if(f.t==='d')throw new Error(c+': '+n+': Is a directory');return f.c});
switch(c){
case 'pwd':return this.cwd+'\n';
case 'whoami':return 'learner\n';
case 'clear':return '\u0000clear';
case 'help':return 'Shell: pwd ls cd mkdir touch cat echo rm cp mv chmod grep wc clear\nDocker: docker run | ps | images | stop | rm\nKubernetes: kubectl run | get pods | delete pod\nPipes (|) and redirects (> >>) work.\n';
case 'cd':{const q=this.p(ar[0]),f=this.fs[q];if(!f)throw new Error('bash: cd: '+ar[0]+': No such file or directory');if(f.t!=='d')throw new Error('bash: cd: '+ar[0]+': Not a directory');this.cwd=q;return ''}
case 'ls':{let o='';for(const d of ar.length?ar:['.']){const q=this.p(d),f=this.fs[q];if(!f)throw new Error("ls: cannot access '"+d+"': No such file or directory");
let n=f.t==='d'?this.kids(q):[d];if(!has('a'))n=n.filter(x=>x[0]!=='.');
const full=x=>f.t==='d'?(q==='/'?'/':q+'/')+x:q;
o+=n.length?(has('l')?n.map(x=>{const g=this.fs[full(x)];return ms(g)+' 1 learner learner '+pad(g.t==='d'?4096:(g.c||'').length,5)+' '+DATE+' '+x}).join('\n'):n.join('  '))+'\n':''}return o}
case 'mkdir':need(1);for(const x of ar){const q=this.p(x);if(this.fs[q]){if(has('p'))continue;throw new Error("mkdir: cannot create directory '"+x+"': File exists")}
if(has('p')){let cur='';for(const s of q.split('/').filter(Boolean)){cur+='/'+s;if(!this.fs[cur]){this.chk(1,0,cur);this.fs[cur]={t:'d',m:493}}}}else this.mk(x,'d')}return '';
case 'touch':need(1);for(const x of ar)if(!this.exists(x))this.mk(x,'f');return '';
case 'cat':return ar.length?files(ar).join(''):inp;
case 'echo':return r.join(' ')+'\n';
case 'rm':need(1);for(const x of ar){const q=this.p(x),f=this.fs[q];if(!f){if(has('f'))continue;throw new Error("rm: cannot remove '"+x+"': No such file or directory")}
if(f.t==='d'&&!has('r')&&!has('R'))throw new Error("rm: cannot remove '"+x+"': Is a directory");
for(const k of Object.keys(this.fs))if(k===q||k.startsWith(q+'/'))delete this.fs[k]}return '';
case 'cp':case 'mv':{need(2);const[s,d]=ar,sq=this.p(s),f=this.fs[sq];if(!f)throw new Error(c+": cannot stat '"+s+"': No such file or directory");
let dq=this.p(d);if(this.fs[dq]&&this.fs[dq].t==='d')dq+='/'+sq.split('/').pop();
if(f.t==='d'&&c==='cp')throw new Error("cp: -r not specified; omitting directory '"+s+"'");
const par=dq.slice(0,dq.lastIndexOf('/'))||'/';if(!this.isDir(par))throw new Error(c+": cannot create '"+d+"': No such file or directory");
for(const k of Object.keys(this.fs))if(k===sq||k.startsWith(sq+'/')){this.chk(c==='cp'?1:0,c==='cp'?(this.fs[k].c||'').length:0,dq+k.slice(sq.length));this.fs[dq+k.slice(sq.length)]={...this.fs[k]};if(c==='mv')delete this.fs[k]}return ''}
case 'chmod':{need(2);if(!/^[0-7]{3}$/.test(ar[0]))throw new Error("chmod: invalid mode: '"+ar[0]+"' (this lab supports octal modes like 755)");
for(const x of ar.slice(1)){const f=this.fs[this.p(x)];if(!f)throw new Error("chmod: cannot access '"+x+"': No such file or directory");f.m=parseInt(ar[0],8)}return ''}
case 'grep':{need(1);const pat=has('i')?ar[0].toLowerCase():ar[0],src=ar.length>1?files(ar.slice(1)):[inp];
return src.flatMap(t=>t.split('\n')).filter(l=>l&&(has('i')?l.toLowerCase():l).includes(pat)).map(l=>l+'\n').join('')}
case 'wc':{const t=ar.length?files(ar).join(''):inp;return (t.match(/\n/g)||[]).length+'\n'}
case 'docker':return this.docker(r);
case 'kubectl':return this.kube(r);
default:throw new Error('bash: '+c+': command not found')}}
find(x){return this.ctrs.find(c=>c.name===x||c.id.startsWith(x))}
docker(r){const s=r[0],f=r.slice(1);
if(s==='run'){let nm=null,im=null;for(let i=0;i<f.length;i++){if(f[i]==='--name')nm=f[++i];else if(['-p','-e','-v'].includes(f[i]))i++;else if(f[i][0]!=='-'&&!im)im=f[i]}
if(!im)throw new Error('docker: "docker run" requires at least 1 argument.');
const b=im.split(':')[0];if(!IMG.includes(b))throw new Error("Unable to find image '"+im+"' locally\ndocker: Error response from daemon: pull access denied for "+b+", repository does not exist");
nm=nm||NAMES[this.ctrs.length%NAMES.length];
if(this.ctrs.some(c=>c.name===nm))throw new Error('docker: Error response from daemon: Conflict. The container name "/'+nm+'" is already in use.');
const id=hex(12);this.ctrs.push({id,name:nm,im:b,t:Date.now(),up:true});if(!this.imgs.includes(b))this.imgs.push(b);return id+'\n'}
if(s==='ps'){const l=f.includes('-a')?this.ctrs:this.ctrs.filter(c=>c.up);return pad('CONTAINER ID',14)+pad('IMAGE',10)+pad('CREATED',12)+pad('STATUS',16)+'NAMES\n'+l.map(c=>pad(c.id,14)+pad(c.im,10)+pad(ago(c.t)+' ago',12)+pad(c.up?'Up '+ago(c.t):'Exited (0)',16)+c.name+'\n').join('')}
if(s==='images')return pad('REPOSITORY',14)+pad('TAG',10)+'SIZE\n'+this.imgs.map(i=>pad(i,14)+pad('latest',10)+'~70MB\n').join('');
if(s==='stop'||s==='rm'){const ns=f.filter(x=>x[0]!=='-');if(!ns.length)throw new Error('"docker '+s+'" requires at least 1 argument.');
return ns.map(n=>{const c=this.find(n);if(!c)throw new Error('Error response from daemon: No such container: '+n);
if(s==='stop')c.up=false;else{if(c.up&&!f.includes('-f'))throw new Error('Error response from daemon: cannot remove a running container. Stop the container before attempting removal or force remove');this.ctrs.splice(this.ctrs.indexOf(c),1)}
return n+'\n'}).join('')}
throw new Error("docker: '"+s+"' is not supported in this lab")}
kube(r){const s=r[0],f=r.slice(1);
if(s==='run'){const n=f.find(x=>x[0]!=='-'),im=(f.find(x=>x.startsWith('--image='))||'').slice(8);
if(!n)throw new Error('error: NAME is required for run');if(!im)throw new Error('error: required flag(s) "image" not set');
if(this.pods.some(p=>p.n===n))throw new Error('Error from server (AlreadyExists): pods "'+n+'" already exists');
this.pods.push({n,t:Date.now()});return 'pod/'+n+' created\n'}
if(s==='get'&&['pods','pod','po'].includes(f[0])){if(!this.pods.length)return 'No resources found in default namespace.\n';
let o=pad('NAME',12)+pad('READY',8)+pad('STATUS',20)+pad('RESTARTS',10)+'AGE\n';
for(const p of this.pods){const up=Date.now()-p.t>=3000;if(up)this.saw.running=true;o+=pad(p.n,12)+pad(up?'1/1':'0/1',8)+pad(up?'Running':'ContainerCreating',20)+pad('0',10)+ago(p.t)+'\n'}return o}
if(s==='delete'&&['pod','pods'].includes(f[0])){const i=this.pods.findIndex(p=>p.n===f[1]);if(i<0)throw new Error('Error from server (NotFound): pods "'+f[1]+'" not found');this.pods.splice(i,1);return 'pod "'+f[1]+'" deleted\n'}
throw new Error('error: this lab supports: kubectl run, get pods, delete pod')}}
window.PR={Sim,backend:{create:()=>new Sim()}};
})();
