/* ==========================================================================
   GROWVA — script.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Preloader ---------- */
  const preloader = document.getElementById('preloader');
  window.addEventListener('load', () => {
    setTimeout(() => preloader.classList.add('done'), 600);
  });
  // Fallback in case load event is delayed
  setTimeout(() => preloader.classList.add('done'), 2500);

  /* ---------- Custom cursor ---------- */
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  let mx = window.innerWidth/2, my = window.innerHeight/2;
  let rx = mx, ry = my;
  window.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx+'px'; dot.style.top = my+'px';
  });
  (function tick(){
    rx += (mx-rx)*0.16; ry += (my-ry)*0.16;
    ring.style.left = rx+'px'; ring.style.top = ry+'px';
    requestAnimationFrame(tick);
  })();
  document.querySelectorAll('[data-hover]').forEach(el=>{
    el.addEventListener('mouseenter', ()=>ring.classList.add('hovered'));
    el.addEventListener('mouseleave', ()=>ring.classList.remove('hovered'));
  });

  /* ---------- Nav ---------- */
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  });
  const burger = document.getElementById('navBurger');
  const navMobile = document.getElementById('navMobile');
  burger.addEventListener('click', () => navMobile.classList.toggle('open'));
  navMobile.querySelectorAll('a').forEach(a => a.addEventListener('click', ()=>navMobile.classList.remove('open')));

  /* ---------- Year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal-up, .reveal-line');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  },{threshold:0.15, rootMargin:'0px 0px -60px 0px'});
  revealEls.forEach(el=>io.observe(el));

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach(item=>{
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', ()=>{
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(open=>{
        open.classList.remove('open');
        open.querySelector('.faq-a').style.maxHeight = null;
      });
      if(!isOpen){
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  /* ---------- Stat counters ---------- */
  const statNums = document.querySelectorAll('.stat-num');
  const statIO = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        const el = entry.target;
        const target = parseInt(el.dataset.count,10);
        let cur = 0;
        const duration = 1400;
        const start = performance.now();
        function step(now){
          const p = Math.min((now-start)/duration,1);
          const eased = 1 - Math.pow(1-p,3);
          cur = Math.round(eased*target);
          el.textContent = cur;
          if(p<1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        statIO.unobserve(el);
      }
    });
  },{threshold:0.4});
  statNums.forEach(el=>statIO.observe(el));

  /* ---------- GSAP ScrollTrigger: process line fill ---------- */
  if(window.gsap && window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);
    gsap.to('#processLineFill', {
      width:'100%',
      ease:'none',
      scrollTrigger:{
        trigger:'.process-track-wrap',
        start:'top 70%',
        end:'bottom 60%',
        scrub:0.6
      }
    });

    // subtle parallax on case visuals
    document.querySelectorAll('.case-visual-inner').forEach(el=>{
      gsap.to(el,{
        yPercent:-8,
        ease:'none',
        scrollTrigger:{
          trigger:el,
          start:'top bottom',
          end:'bottom top',
          scrub:true
        }
      });
    });
  }

  /* ================= THREE.js — Hero background ================= */
  (function heroScene(){
    const canvas = document.getElementById('heroCanvas');
    if(!canvas || !window.THREE) return;
    const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth/canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 3.4, 7.2);

    function resize(){
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w,h,false);
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
    }

    // Wireframe terrain mesh (the "growth" signature)
    const geo = new THREE.PlaneGeometry(16, 16, 64, 64);
    geo.rotateX(-Math.PI/2.6);
    const mat = new THREE.MeshBasicMaterial({color:0x50b964, wireframe:true, transparent:true, opacity:0.5});
    const terrain = new THREE.Mesh(geo, mat);
    terrain.position.y = -1.6;
    scene.add(terrain);

    const pos = geo.attributes.position;
    const base = new Float32Array(pos.array.length);
    base.set(pos.array);

    // Floating particles
    const pCount = 260;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount*3);
    for(let i=0;i<pCount;i++){
      pPos[i*3] = (Math.random()-0.5)*14;
      pPos[i*3+1] = Math.random()*6-1;
      pPos[i*3+2] = (Math.random()-0.5)*14;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3));
    const pMat = new THREE.PointsMaterial({color:0xf6f6f6, size:0.03, transparent:true, opacity:0.5});
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    let targetX = 0, targetY = 0;
    window.addEventListener('mousemove', (e)=>{
      targetX = (e.clientX/window.innerWidth - 0.5);
      targetY = (e.clientY/window.innerHeight - 0.5);
    });

    const clock = new THREE.Clock();
    function animate(){
      const t = clock.getElapsedTime();

      // animate terrain vertices (wave / growth pulse)
      const arr = pos.array;
      for(let i=0;i<arr.length;i+=3){
        const x = base[i], z = base[i+2];
        arr[i+1] = base[i+1] + Math.sin(x*0.5 + t*0.6)*0.35 + Math.cos(z*0.5 + t*0.4)*0.35;
      }
      pos.needsUpdate = true;

      particles.rotation.y = t*0.02;

      camera.position.x += (targetX*1.6 - camera.position.x)*0.02;
      camera.position.y += (3.4 - targetY*1.0 - camera.position.y)*0.02;
      camera.lookAt(0,0,0);

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    resize();
    window.addEventListener('resize', resize);
    animate();
  })();

  /* ================= THREE.js — CTA background (subtle particle field) ================= */
  (function ctaScene(){
    const canvas = document.getElementById('ctaCanvas');
    if(!canvas || !window.THREE) return;
    const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth/canvas.clientHeight, 0.1, 100);
    camera.position.set(0,0,6);

    function resize(){
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w,h,false);
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
    }

    const count = 180;
    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(count*3);
    for(let i=0;i<count;i++){
      posArr[i*3] = (Math.random()-0.5)*12;
      posArr[i*3+1] = (Math.random()-0.5)*7;
      posArr[i*3+2] = (Math.random()-0.5)*6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArr,3));
    const mat = new THREE.PointsMaterial({color:0x50b964, size:0.045, transparent:true, opacity:0.55});
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const clock = new THREE.Clock();
    let visible = false;
    const io = new IntersectionObserver(entries=>{
      entries.forEach(e=>visible=e.isIntersecting);
    },{threshold:0.05});
    io.observe(canvas);

    function animate(){
      if(visible){
        const t = clock.getElapsedTime();
        points.rotation.y = t*0.035;
        points.rotation.x = Math.sin(t*0.1)*0.05;
        renderer.render(scene, camera);
      }
      requestAnimationFrame(animate);
    }
    resize();
    window.addEventListener('resize', resize);
    animate();
  })();

});
