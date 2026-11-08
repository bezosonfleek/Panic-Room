(function(){const f=document.getElementById('f'),m=document.getElementById('msg'),mode=document.body.dataset.mode;
f.addEventListener('submit',async e=>{e.preventDefault();m.textContent='';const b=f.querySelector('button');b.disabled=true;
try{const r=await fetch('/api/'+mode,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});
const d=await r.json().catch(()=>({}));if(r.ok)location.href='courses.html';else m.textContent=d.error||'Something went wrong. Try again.'}
catch(err){m.textContent='Could not reach the server.'}finally{b.disabled=false}})})();
