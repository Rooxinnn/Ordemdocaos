/* ==========================================================
   IMAGEM DO PERSONAGEM
   Sistema independente e autocontido, adicionado sobre a
   arquitetura já existente — mesmo padrão da Bandeja de
   Rolagens e das Conexões da Ficha (ver character-connections.js):
   só ENVOLVE (sem redefinir) as funções que já existem, e usa o
   mesmo campo oculto dentro de #tab-agentes para guardar o dado,
   então saveAgent()/loadAgent()/duplicateSheet()/export-import
   já cuidam de salvar, carregar, duplicar e exportar a imagem
   automaticamente — nenhuma dessas funções foi reescrita.

   ARMAZENAMENTO: a imagem é redimensionada no navegador (canvas)
   para no máximo 480px no lado maior e recomprimida como JPEG
   (qualidade 0.85) antes de virar uma data URL — isso mantém o
   arquivo pequeno o bastante para caber com folga no mesmo
   armazenamento que a ficha já usa (window.storage, ou
   localStorage quando o HTML é aberto direto no navegador), sem
   precisar de nenhum sistema de arquivos separado.

   GERENCIADOR DE FICHAS: não guarda uma cópia redundante da
   imagem em sheetsIndex (isso criaria uma segunda fonte de
   verdade que poderia ficar desatualizada em duplicação/edição/
   importação). Em vez disso, ao renderizar os cards, busca a
   imagem de cada ficha diretamente do armazenamento já existente
   (storageGet(sheetStorageKey(id))) — a mesma fonte usada por
   openSheet()/loadAgent().
   ========================================================== */
(function(){

  var HIDDEN_FIELD_ID = "agente_imagem_data";
  var MAX_DIM = 480;
  var JPEG_QUALITY = 0.85;
  var MAX_INPUT_BYTES = 20 * 1024 * 1024; // 20MB — só uma trava de sanidade contra arquivos absurdos

  /* ---------- acesso ao campo oculto (mesma fonte de verdade da ficha) ---------- */

  function ensureHiddenField(){
    var el = document.getElementById(HIDDEN_FIELD_ID);
    if(!el){
      var tabAgentes = document.getElementById("tab-agentes");
      if(!tabAgentes) return null;
      el = document.createElement("input");
      el.type = "hidden";
      el.id = HIDDEN_FIELD_ID;
      el.value = "";
      tabAgentes.appendChild(el);
    }
    return el;
  }

  function getImageData(){
    var el = ensureHiddenField();
    return el ? (el.value || "") : "";
  }

  function setImageData(dataUrl){
    var el = ensureHiddenField();
    if(!el) return;
    el.value = dataUrl || "";
    if(typeof markAgentDirty === "function") markAgentDirty();
  }

  // Reset silencioso (sem marcar a ficha como suja) — só usado ao
  // trocar/criar ficha, para a imagem da ficha anterior nunca
  // aparecer por um instante na ficha seguinte antes do carregamento.
  function resetImageDataSilent(){
    var el = ensureHiddenField();
    if(el) el.value = "";
  }

  /* ---------- processamento da imagem (redimensionar + comprimir) ---------- */

  function fileToResizedDataUrl(file){
    return new Promise(function(resolve, reject){
      if(!file || file.type.indexOf("image/") !== 0){
        reject(new Error("not-an-image"));
        return;
      }
      if(file.size > MAX_INPUT_BYTES){
        reject(new Error("file-too-large"));
        return;
      }
      var img = new Image();
      var objectUrl = URL.createObjectURL(file);
      img.onload = function(){
        try{
          var w = img.naturalWidth, h = img.naturalHeight;
          if(w <= 0 || h <= 0){ throw new Error("invalid-image"); }
          var scale = Math.min(1, MAX_DIM / Math.max(w, h));
          var outW = Math.max(1, Math.round(w * scale));
          var outH = Math.max(1, Math.round(h * scale));

          var canvas = document.createElement("canvas");
          canvas.width = outW;
          canvas.height = outH;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, outW, outH);

          var dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
          URL.revokeObjectURL(objectUrl);
          resolve(dataUrl);
        }catch(err){
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = function(){
        URL.revokeObjectURL(objectUrl);
        reject(new Error("decode-failed"));
      };
      img.src = objectUrl;
    });
  }

  /* ==========================================================
     FICHA (ABA AGENTES) — retrato pequeno na titlebar
     Inserido como último filho de ".titlebar-head" — o logo, o
     título e o field-row com Nome/Profissão/Idade/EXP/Nível não
     são tocados nem movidos.
     ========================================================== */

  function ensurePortraitWidget(){
    if(document.getElementById("pchar_portrait")) return;
    var head = document.querySelector(".titlebar-head");
    if(!head) return;

    var wrap = document.createElement("div");
    wrap.className = "pchar-portrait";
    wrap.id = "pchar_portrait";
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "button");
    wrap.setAttribute("aria-label", "Imagem do personagem — clique para adicionar ou trocar");
    wrap.innerHTML =
      '<div class="pchar-portrait-frame">' +
        '<img id="pchar_portrait_img" alt="Imagem do personagem" style="display:none;">' +
        '<div class="pchar-portrait-placeholder" id="pchar_portrait_placeholder">' +
          '<span class="pchar-plus">+</span><span class="pchar-label">Imagem</span>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="pchar-portrait-remove" id="pchar_portrait_remove" ' +
        'style="display:none;" aria-label="Remover imagem do personagem">&times;</button>';

    head.appendChild(wrap);

    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.id = "pchar_portrait_input";
    fileInput.style.display = "none";
    head.appendChild(fileInput);

    wrap.addEventListener("click", function(e){
      if(e.target.closest("#pchar_portrait_remove")) return;
      fileInput.value = "";
      fileInput.click();
    });
    wrap.addEventListener("keydown", function(e){
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        fileInput.value = "";
        fileInput.click();
      }
    });

    fileInput.addEventListener("change", function(){
      var file = fileInput.files && fileInput.files[0];
      if(!file) return;
      fileToResizedDataUrl(file).then(function(dataUrl){
        setImageData(dataUrl);
        renderPortrait();
      }).catch(function(){
        alert("Não foi possível usar este arquivo como imagem do personagem. Tente outro arquivo de imagem (PNG, JPG, WEBP…).");
      });
    });

    document.getElementById("pchar_portrait_remove").addEventListener("click", function(e){
      e.stopPropagation();
      setImageData("");
      renderPortrait();
    });
  }

  function renderPortrait(){
    ensurePortraitWidget();
    var img = document.getElementById("pchar_portrait_img");
    var placeholder = document.getElementById("pchar_portrait_placeholder");
    var removeBtn = document.getElementById("pchar_portrait_remove");
    if(!img || !placeholder || !removeBtn) return;

    var data = getImageData();
    if(data){
      img.src = data;
      img.style.display = "block";
      placeholder.style.display = "none";
      removeBtn.style.display = "flex";
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
      placeholder.style.display = "flex";
      removeBtn.style.display = "none";
    }
  }

  /* ==========================================================
     GERENCIADOR DE FICHAS — miniatura em cada card
     Não altera renderSheetCards(): só a envolve, e depois de ela
     rodar, busca (sob demanda, do próprio armazenamento das
     fichas) a imagem de cada ficha listada e injeta a miniatura.
     ========================================================== */

  async function decoratePortraitThumbs(){
    var cards = document.querySelectorAll("#sheet_list .sheet-card");
    if(!cards.length) return;

    await Promise.all(Array.prototype.map.call(cards, async function(card){
      var openBtn = card.querySelector("[data-open]");
      var id = openBtn && openBtn.dataset.open;
      if(!id) return;

      var thumb = document.createElement("div");
      thumb.className = "pchar-card-thumb";
      thumb.innerHTML = '<div class="pchar-portrait-placeholder"><span class="pchar-plus">+</span></div>';
      card.appendChild(thumb);

      try{
        var raw = await storageGet(sheetStorageKey(id));
        if(!raw) return;
        var data = JSON.parse(raw);
        var imagem = data[HIDDEN_FIELD_ID];
        if(imagem){
          thumb.innerHTML = '<img src="' + imagem + '" alt="Imagem do personagem">';
        }
      }catch(e){
        // mantém o placeholder — nunca deixa um card quebrado por causa da miniatura
      }
    }));
  }

  /* ==========================================================
     INTEGRAÇÃO COM O FLUXO JÁ EXISTENTE
     Mesmo padrão da Bandeja de Rolagens e das Conexões da Ficha:
     envolve openSheet() / createNewSheet() / renderSheetCards()
     sem reescrevê-las.
     ========================================================== */

  function wrapSheetFunctions(){
    if(typeof openSheet === "function"){
      var _origOpenSheet = openSheet;
      openSheet = async function(id){
        resetImageDataSilent();
        await _origOpenSheet(id);
        renderPortrait();
      };
    }
    if(typeof createNewSheet === "function"){
      var _origCreateNewSheet = createNewSheet;
      createNewSheet = async function(){
        await _origCreateNewSheet();
        resetImageDataSilent();
        renderPortrait();
      };
    }
    if(typeof renderSheetCards === "function"){
      var _origRenderSheetCards = renderSheetCards;
      renderSheetCards = function(){
        _origRenderSheetCards();
        decoratePortraitThumbs();
      };
    }
  }

  /* ---------- boot ---------- */
  function initPersonagem(){
    ensureHiddenField();
    wrapSheetFunctions();
    ensurePortraitWidget();
    renderPortrait();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initPersonagem);
  } else {
    initPersonagem();
  }

})();
