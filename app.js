/* Клининг Сервис 24 — cinematic motion system (GSAP + ScrollTrigger + Lenis) */
"use strict";

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: "power3.out", duration: 0.85 });

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.documentElement.classList.add("has-motion");

/* ---------- FAQ data ---------- */
const FAQ = [
  ["Можно ли доверять вашим сотрудникам?",
   "Каждый сотрудник проходит предварительный отбор, обучение и стажировку. Мы не работаем с людьми, которые не разделяют наши ценности — за каждого члена команды отвечаем договором."],
  ["Нужно ли мне предоставлять химию и инвентарь?",
   "Все необходимое для уборки мы привозим с собой. В некоторых случаях по договорённости с заказчиком можем использовать стремянку или пылесос заказчика."],
  ["Работаете ли вы в выходные?",
   "Да, мы работаем 7 дней в неделю, 24 часа. Принимаем заказы на уборку в ночное время, на срочные объекты выезжаем в течение 2 часов."],
  ["Работаете ли вы по договору?",
   "Конечно! Мы работаем с физическими и юридическими лицами — как разово, так и на постоянной основе на выгодных условиях."],
  ["Как рассчитывается точная стоимость?",
   "Выезд менеджера на объект для оценки — бесплатный и ни к чему не обязывает. После осмотра фиксируем цену за м² в договоре, она не меняется в процессе работы."],
  ["Есть ли скидка для новых клиентов?",
   "Да, новым клиентам предоставляем скидку −25% на первый заказ."]
];

/* ---------- build pricing DOM ---------- */
(function buildPricing(){
  const wrap = document.getElementById("priceGroups");
  if (!wrap || typeof PRICE_DATA === "undefined") return;
  wrap.innerHTML = PRICE_DATA.map(g => `
    <div class="pg" data-reveal-group>
      <div class="pg-title" data-reveal="fade-up">${g.group}</div>
      <div class="price-list">
        ${g.items.map(it => `
          <div class="prow">
            <button class="ptoggle" aria-expanded="false">
              <span class="pname">${it.name}</span>
              <span class="pprice">${it.price}</span>
              <span class="chev">+</span>
            </button>
            <div class="ppanel"><div class="ppanel-inner">
              ${it.bullets.length ? "<ul>" + it.bullets.map(b => `<li>${b}</li>`).join("") + "</ul>" : ""}
            </div></div>
          </div>`).join("")}
      </div>
    </div>`).join("");
})();

/* ---------- build FAQ DOM ---------- */
(function buildFaq(){
  const wrap = document.getElementById("faqList");
  if (!wrap) return;
  wrap.innerHTML = FAQ.map(([q,a]) => `
    <div class="q">
      <button aria-expanded="false"><span>${q}</span><span class="plus">+</span></button>
      <div class="a"><p>${a}</p></div>
    </div>`).join("");
})();

/* ---------- accordion behaviour (pricing + faq) ---------- */
function bindAccordion(root, rowSel, btnSel, panelSel){
  root.querySelectorAll(rowSel).forEach(row => {
    const btn = row.querySelector(btnSel);
    const panel = row.querySelector(panelSel);
    btn.addEventListener("click", () => {
      const open = row.classList.contains("open");
      // close siblings within same root
      root.querySelectorAll(rowSel + ".open").forEach(r => {
        if (r === row) return;
        r.classList.remove("open");
        r.querySelector(btnSel).setAttribute("aria-expanded","false");
        gsap.to(r.querySelector(panelSel), { height: 0, duration: .45, ease: "power3.inOut" });
      });
      row.classList.toggle("open", !open);
      btn.setAttribute("aria-expanded", String(!open));
      if (open){
        gsap.to(panel,{height:0,duration:.45,ease:"power3.inOut",onComplete:()=>ScrollTrigger.refresh()});
      } else {
        gsap.set(panel,{height:"auto"});
        const h = panel.offsetHeight;
        gsap.fromTo(panel,{height:0},{height:h,duration:.5,ease:"power3.inOut",
          onComplete(){ gsap.set(panel,{height:"auto"}); ScrollTrigger.refresh(); }});
      }
    });
  });
}
bindAccordion(document.getElementById("priceGroups"), ".prow", ".ptoggle", ".ppanel");
bindAccordion(document.getElementById("faqList"), ".q", "button", ".a");

/* ---------- LENIS smooth scroll ---------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95, anchors: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- text splitting ---------- */
function splitWords(el){
  if (el.dataset.splitDone) return;
  const text = el.textContent.trim();
  el.setAttribute("aria-label", text);
  el.textContent = "";
  let i = 0;
  text.split(/(\s+)/).forEach(part => {
    if (!part.trim()) { el.appendChild(document.createTextNode(part)); return; }
    const mask = document.createElement("span"); mask.className = "motion-word-mask"; mask.setAttribute("aria-hidden","true");
    const w = document.createElement("span"); w.className = "motion-word"; w.textContent = part;
    mask.appendChild(w); el.appendChild(mask); i++;
  });
  el.dataset.splitDone = "1";
}
function splitLines(el){
  if (el.dataset.splitDone) return;
  const raw = el.textContent.trim();
  // manual line breaks via <br> not used; split sentences into visual lines by existing markup only
  const parts = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) { splitWords(el); return; }
  el.setAttribute("aria-label", raw);
  el.textContent = "";
  parts.forEach(line => {
    const mask = document.createElement("span"); mask.className = "motion-line-mask"; mask.setAttribute("aria-hidden","true");
    const inner = document.createElement("span"); inner.className = "motion-line"; inner.textContent = line;
    mask.appendChild(inner); el.appendChild(mask); el.appendChild(document.createTextNode(" "));
  });
  el.dataset.splitDone = "1";
}

/* ---------- reveals ---------- */
const heroShown = new WeakSet();
function reveal(el, opts){
  // animate + force visibility (guards against nested data-reveal inside data-reveal-group)
  const tl = gsap.timeline({scrollTrigger: Object.assign({}, opts.st)});
  if (opts.hero) tl.to(el, {autoAlpha:1, duration:.01});
  tl.fromTo(el, opts.from, Object.assign({duration:.9}, opts.to), opts.hero ? 0 : 0);
}
function initReveals(){
  if (reduceMotion){
    gsap.set("[data-motion-text],[data-reveal],[data-reveal-item],[data-image-reveal]",{autoAlpha:1,clearProps:"all"});
    return;
  }
  document.querySelectorAll("[data-motion-text='words']").forEach(el => {
    splitWords(el);
    gsap.set(el,{autoAlpha:1});
    gsap.fromTo(el.querySelectorAll(".motion-word"),
      { yPercent:110, autoAlpha:0, filter:"blur(8px)" },
      { yPercent:0, autoAlpha:1, filter:"blur(0px)", duration:.9, ease:"power4.out", stagger:.045,
        scrollTrigger:{trigger:el,start:"top 85%",once:true} });
  });
  document.querySelectorAll("[data-motion-text='lines']").forEach(el => {
    splitLines(el);
    gsap.set(el,{autoAlpha:1});
    const targets = el.querySelectorAll(".motion-line, .motion-word");
    gsap.fromTo(targets,
      { yPercent:105, autoAlpha:0, filter:"blur(8px)" },
      { yPercent:0, autoAlpha:1, filter:"blur(0px)", duration:1, ease:"power4.out", stagger:.06,
        scrollTrigger:{trigger:el,start:"top 85%",once:true} });
  });
  document.querySelectorAll("[data-reveal-group]").forEach(gr => {
    gr.querySelectorAll("[data-reveal='fade-up'],[data-reveal='zoom']").forEach((el,i) => {
      reveal(el,{st:{trigger:gr,start:"top 85%",once:true},
        from:{y:34,autoAlpha:0}, to:{y:0,autoAlpha:1,delay:i*.08}});
    });
  });
  document.querySelectorAll(":not([data-reveal-group]) > [data-reveal='fade-up']").forEach(el => {
    reveal(el,{st:{trigger:el,start:"top 88%",once:true},from:{y:30,autoAlpha:0},to:{y:0,autoAlpha:1,duration:.85}});
  });
  document.querySelectorAll(":not([data-reveal-group]) > [data-reveal='zoom']").forEach(el => {
    reveal(el,{st:{trigger:el,start:"top 88%",once:true},from:{scale:.85,autoAlpha:0},to:{scale:1,autoAlpha:1,duration:1,ease:"expo.out"}});
  });
  // image reveal (clip wipe)
  document.querySelectorAll("[data-image-reveal]").forEach(el => {
    const tl = gsap.timeline({scrollTrigger:{trigger:el,start:"top 85%",once:true}});
    tl.set(el,{autoAlpha:1})
      .fromTo(el,{clipPath:"inset(12% 12% 12% 12%)"},{clipPath:"inset(0% 0% 0% 0%)",duration:1.1,ease:"expo.inOut"})
      .fromTo(el.querySelector("img"),{scale:1.25},{scale:1,duration:1.4,ease:"power3.out"},0);
  });
}

/* ---------- counters ---------- */
function initCounters(){
  document.querySelectorAll(".cnt").forEach(el => {
    const target = +el.dataset.count;
    if (reduceMotion){ el.textContent = target.toLocaleString("ru-RU"); return; }
    ScrollTrigger.create({ trigger: el, start:"top 90%", once:true, onEnter(){
      gsap.fromTo(el,{innerText:0},{innerText:target,duration:1.8,ease:"power2.out",snap:{innerText:1},
        onUpdate(){ el.textContent = Math.round(+el.textContent).toLocaleString("ru-RU"); }});
    }});
  });
}

/* ---------- parallax ---------- */
function initParallax(){
  if (reduceMotion) return;
  gsap.utils.toArray("[data-parallax-image]").forEach(img => {
    gsap.to(img,{yPercent:-12,ease:"none",scrollTrigger:{trigger:img.closest("[data-image-reveal],.hero-media,figure,section"),start:"top bottom",end:"bottom top",scrub:1.2}});
  });
  const bgw = document.querySelector(".hero-bg-word");
  if (bgw) gsap.to(bgw,{xPercent:-18,ease:"none",scrollTrigger:{trigger:".hero",start:"top top",end:"bottom top",scrub:1}});
}

/* ---------- process steps progress ---------- */
function initProcess(){
  if (reduceMotion) return;
  document.querySelectorAll("[data-step]").forEach(step => {
    gsap.to(step.querySelector(".step-progress i"),{
      scaleY:1,ease:"none",
      scrollTrigger:{trigger:step,start:"top 75%",end:"bottom 40%",scrub:.8}
    });
    gsap.fromTo(step,{y:60,autoAlpha:0},{y:0,autoAlpha:1,duration:.9,
      scrollTrigger:{trigger:step,start:"top 85%",once:true}});
  });
}

/* ---------- works horizontal drag ---------- */
function initWorks(){
  const viewport = document.getElementById("worksViewport");
  const track = document.getElementById("worksTrack");
  if (!viewport || !track) return;
  let tx = 0, dragging = false, startX = 0, startTx = 0, downY = 0, moved = false;
  const maxX = () => Math.min(0, -(track.scrollWidth - viewport.clientWidth));
  const clamp = v => Math.max(maxX(), Math.min(0, v));
  const apply = (anim) => {
    if (anim && !reduceMotion) gsap.to(track,{x:clamp(tx),duration:.6,ease:"power3.out"});
    else gsap.set(track,{x:clamp(tx)});
  };
  // wheel passthrough: allow vertical page scroll, shift/wheel-x drags the strip
  viewport.addEventListener("pointerdown", e => {
    dragging = true; moved = false; startX = e.clientX; startTx = tx; downY = e.clientY;
    viewport.classList.add("dragging"); viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener("pointermove", e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) moved = true;
    tx = clamp(startTx + dx);
    gsap.set(track,{x:tx});
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false; viewport.classList.remove("dragging");
    if (moved){ tx = clamp(tx); apply(true); }
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("click", e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  viewport.addEventListener("wheel", e => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); tx = clamp(tx - e.deltaX); apply(true); }
  }, {passive:false});
  ScrollTrigger.create({trigger:viewport,start:"top 80%",once:!reduceMotion,onEnter(){
    if (reduceMotion) return;
    gsap.fromTo(track.children,{x:80,autoAlpha:0},{x:0,autoAlpha:1,stagger:.08,duration:.8,clearProps:"opacity,transform"});
  }});
  window.addEventListener("resize", () => apply(false));
}

/* ---------- header state ---------- */
function initHeader(){
  const hdr = document.getElementById("hdr");
  ScrollTrigger.create({start:"top -80",onUpdate(self){ hdr.classList.toggle("solid", self.scroll() > 80); }});
}

/* ---------- magnetic buttons ---------- */
function initMagnetic(){
  if (reduceMotion || matchMedia("(pointer:coarse)").matches) return;
  document.querySelectorAll("[data-magnetic]").forEach(el => {
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect();
      gsap.to(el,{x:(e.clientX-r.left-r.width/2)*.25,y:(e.clientY-r.top-r.height/2)*.35,duration:.4});
    });
    el.addEventListener("pointerleave",()=>gsap.to(el,{x:0,y:0,duration:.6,ease:"elastic.out(1,.4)"}));
  });
}

/* ---------- custom cursor ---------- */
function initCursor(){
  const cur = document.getElementById("cursor");
  if (!cur || reduceMotion || matchMedia("(pointer:coarse)").matches) { if(cur) cur.style.display="none"; return; }
  const xTo = gsap.quickTo(cur,"x",{duration:.35,ease:"power3"});
  const yTo = gsap.quickTo(cur,"y",{duration:.35,ease:"power3"});
  addEventListener("pointermove", e => { xTo(e.clientX); yTo(e.clientY); });
  document.querySelectorAll("a,button,.work-card,.ptoggle").forEach(el=>{
    el.addEventListener("pointerenter",()=>cur.classList.add("big"));
    el.addEventListener("pointerleave",()=>cur.classList.remove("big"));
  });
}

/* ---------- FAB call menu ---------- */
(function initFab(){
  const fab = document.getElementById("fab"), btn = document.getElementById("fabBtn");
  if (!fab || !btn) return;
  btn.addEventListener("click", () => {
    const open = fab.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", e => {
    if (!fab.contains(e.target)) { fab.classList.remove("open"); btn.setAttribute("aria-expanded","false"); }
  });
})();

/* ---------- loader ---------- */
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  const countEl = document.getElementById("loadCount");
  const barEl = document.getElementById("loadBar");
  const finish = () => {
    const tl = gsap.timeline({ defaults:{ease:"power4.out"} });
    tl.to(loader,{yPercent:-100,duration:1.1,onComplete(){ loader.style.display="none"; }})
      .add(()=>{ initReveals(); initCounters(); initParallax(); initProcess(); initWorks(); initHeader(); initMagnetic(); initCursor(); ScrollTrigger.refresh(); },"-=0.6");
    // hero first paint
    gsap.fromTo(".hero .badge",{y:20,autoAlpha:0},{y:0,autoAlpha:1,duration:.7,delay:.2});
  };
  if (reduceMotion){ loader.style.display="none"; initReveals(); initCounters(); initWorks(); initHeader(); initMagnetic(); return; }
  const obj = {v:0};
  gsap.to(obj,{v:100,duration:1.4,ease:"power2.inOut",
    onUpdate(){ countEl.textContent = Math.round(obj.v); gsap.set(barEl,{scaleX:obj.v/100}); },
    onComplete: finish});
});
