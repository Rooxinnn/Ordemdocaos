/* ==========================================================================
   MÓDULO SONORO — ESTADO "ABORTO LÍMBICO"
   ==========================================================================
   Não cria nenhum sistema novo de ativação. Só observa a classe
   "limbo-active" que o próprio index.html já liga/desliga em
   renderAbortoLimbico() (via classList.toggle no #agent-sheet-capture) —
   a mesma fonte de verdade usada pelo redesign visual (limbic-abortion.css).

   Usa MutationObserver no atributo "class" desse elemento em vez de
   reescrever/anexar um segundo listener no botão de toggle: assim o som
   dispara corretamente em QUALQUER caminho que ative o estado (clique no
   botão, carregar uma ficha salva já ativa, duplicar ficha, etc.) sem
   nunca duplicar ou substituir a lógica original.

   Toca uma única vez na transição desativado -> ativado. Não toca ao
   desativar. Não repete enquanto o estado permanece ativo. Se o navegador
   bloquear autoplay de áudio, falha silenciosamente — o Aborto Límbico
   continua funcionando normalmente independente do som.
   ========================================================================== */
(function(){
  "use strict";

  const sheet = document.getElementById("agent-sheet-capture");
  if(!sheet) return;

  const audio = new Audio("audio/limbic-abortion.mp3");
  audio.preload = "auto";
  audio.volume = 0.28; // ~20-35% pedido

  // Fallback para navegadores sem suporte a mp3 (ex.: alguns builds do
  // Firefox antigos) -- troca a fonte para ogg só se o mp3 realmente
  // falhar ao carregar, sem afetar o caminho normal.
  audio.addEventListener("error", function onError(){
    audio.removeEventListener("error", onError);
    audio.src = "audio/limbic-abortion.ogg";
  }, { once:true });

  function playActivationSound(){
    try{
      audio.currentTime = 0;
      const p = audio.play();
      if(p && typeof p.catch === "function"){
        p.catch(function(){ /* autoplay bloqueado pelo navegador: ignora silenciosamente */ });
      }
    }catch(e){ /* som é só um complemento; nunca deve interromper o Aborto Límbico */ }
  }

  let wasActive = sheet.classList.contains("limbo-active");

  const observer = new MutationObserver(function(){
    const isActive = sheet.classList.contains("limbo-active");
    if(isActive && !wasActive){
      playActivationSound();
    }
    wasActive = isActive;
  });

  observer.observe(sheet, { attributes:true, attributeFilter:["class"] });
})();
