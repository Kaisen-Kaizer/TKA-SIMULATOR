// Simulator TKA - client only. Uses BroadcastChannel + localStorage to share progress across tabs.
(function(){
  // Helpers
  const $ = sel=>document.querySelector(sel);
  const qs = sel=>Array.from(document.querySelectorAll(sel));

  // Elements
  const btnCalon = $('#btn-calon');
  const btnPanitia = $('#btn-panitia');
  const calonPanel = $('#calon-panel');
  const panitiaPanel = $('#panitia-panel');
  const roleSelect = $('#role-select');
  const startBtn = $('#start-quiz');
  const levelSelect = $('#level-select');
  const nameInput = $('#candidate-name');
  const loginUsername = $('#login-username');
  const loginPassword = $('#login-password');
  const loginBtnEl = $('#login-btn');
  const loginStatusEl = $('#login-status');
  const levelWrap = $('#level-wrap');
  const nameWrap = $('#name-wrap');
  const quizPanel = $('#quiz-panel');
  const questionArea = $('#question-area');
  const quizInfo = $('#quiz-info');
  const quizProgress = $('#quiz-progress');
  const prevBtn = $('#prev-btn');
  const nextBtn = $('#next-btn');
  const finishBtn = $('#finish-btn');
  const resultPanel = $('#result-panel');
  const resultSummary = $('#result-summary');
  const returnHome = $('#return-home');
  const panitiaList = $('#panitia-list');
  const panitiaLoginPanel = $('#panitia-login');
  const panitiaPasswordInput = $('#panitia-password');
  const panitiaLoginBtn = $('#panitia-login-btn');
  const panitiaSetupBtn = $('#panitia-setup-btn');
  const panitiaLoginStatus = $('#panitia-login-status');
  const tabMonitorBtn = $('#tab-monitor');
  const tabWhitelistBtn = $('#tab-whitelist');
  const panitiaMonitorDiv = $('#panitia-monitor');
  const panitiaWhitelistDiv = $('#panitia-whitelist');
  const panitiaLogoutBtn = $('#panitia-logout');

  // Storage & channel
  const LS_KEY = 'tka_candidates_v1';
  const LAST_SESSION_KEY = 'tka_last_session_v1';
  const ch = (window.BroadcastChannel) ? new BroadcastChannel('tka_monitor') : null;
  const WHITELIST_KEY = 'tka_whitelist_v1';
  const CONFIG_PATH = 'data/config.json';
  // Load defaults from config file (if present) into localStorage on first run
  async function loadDefaultsFromFile(){
    try{
      const resp = await fetch(CONFIG_PATH, {cache:'no-store'});
      if(!resp.ok) return;
      const cfg = await resp.json();
      if(cfg){
        // admin
        const existingAdmin = loadAdminPass();
        if(!existingAdmin && cfg.adminPass) saveAdminPass(cfg.adminPass);
        // whitelist
        const existingWL = loadWhitelist();
        if(Object.keys(existingWL||{}).length===0 && cfg.whitelist){ saveWhitelist(cfg.whitelist); }
      }
    }catch(e){ /* ignore - file may not be accessible when opened via file:// */ }
  }
  loadDefaultsFromFile();

  function loadCandidates(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || '{}') }catch(e){return{}} }
  function saveCandidates(obj){ localStorage.setItem(LS_KEY, JSON.stringify(obj)); }
  function broadcast(msg){ if(ch) ch.postMessage(msg); }

  function loadWhitelist(){ try{ return JSON.parse(localStorage.getItem(WHITELIST_KEY) || '{}') }catch(e){return{}} }
  function saveWhitelist(obj){ localStorage.setItem(WHITELIST_KEY, JSON.stringify(obj)); broadcast({type:'whitelist_update'}); }
  const ADMIN_KEY = 'tka_admin_pass_v1';
  function loadAdminPass(){ return localStorage.getItem(ADMIN_KEY) || null; }
  function saveAdminPass(pw){ localStorage.setItem(ADMIN_KEY, pw); }


  // Helpers for random questions
  function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a}
  function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a }

  // question generator per level (50 questions) - diversified, higher-difficulty
  function generateQuestions(level){
    const arr = [];
    const vocabPairs = {
      abundant:'plentiful', scarce:'rare', swift:'quick', sluggish:'slow', robust:'strong', fragile:'breakable', ascend:'rise', descend:'fall', vivid:'bright', obscure:'unclear', eager:'keen', reluctant:'hesitant', generous:'giving', stingy:'mean'
    };
    const verbs = ['attend','explain','complete','arrive','decide','investigate','prepare','deliver','recommend','reduce'];
    const nouns = ['project','report','meeting','museum','experiment','proposal','lecture','assignment'];
    const prepositions = [['interested','in'],['responsible','for'],['depend','on'],['capable','of'],['concerned','about']];

    const passages = [
      {text: 'The research team published their findings after months of experiments. The results surprised many experts because the new method reduced costs significantly.', qs:[{q:'Why were the results surprising?', a:'Because the new method reduced costs significantly.'},{q:'What did the team do for months?', a:'They conducted experiments.'}]},
      {text: 'A local bakery started offering gluten-free options to meet rising customer demand. Many regular customers appreciated the new choices.', qs:[{q:'Why did the bakery start offering gluten-free options?', a:'To meet rising customer demand.'},{q:'How did customers react?', a:'Many regular customers appreciated the new choices.'}]},
      {text: 'The mayor announced a renovation plan for the old library to preserve historical books and make the space more accessible. The community supported the plan.', qs:[{q:'What is the purpose of the renovation?', a:'To preserve historical books and make the space more accessible.'}]}
    ];

    function makeOptions(correct, pool){
      const opts = new Set(); opts.add(correct);
      const keys = Array.isArray(pool)?pool:Object.keys(pool);
      while(opts.size<4){
        const pick = keys[rand(0,keys.length-1)];
        const val = Array.isArray(pool)?pick:(typeof pool[pick]==='string'?pool[pick]:pick);
        if(val && !opts.has(val)) opts.add(val);
      }
      return shuffle(Array.from(opts));
    }

    for(let i=0;i<50;i++){
      const q = {id:i+1,text:'',options:[],correctValue:null};
      const r = Math.random();
      if(level<=2){
        if(r<0.5){
          const words = Object.keys(vocabPairs);
          const w = words[rand(0,words.length-1)];
          q.text = `Choose the word closest in meaning to "${w}".`;
          q.options = makeOptions(vocabPairs[w], vocabPairs);
          q.correctValue = vocabPairs[w];
        } else {
          if(r<0.75){
            const pron = ['He','She','They','I'][rand(0,3)];
            const verb = verbs[rand(0,verbs.length-1)];
            const correct = (pron==='He' || pron==='She')? (verb+'s') : verb;
            q.text = `${pron} ____ the ${nouns[rand(0,nouns.length-1)]} regularly.`;
            q.options = makeOptions(correct, verbs.map(v=>v+'s').concat(verbs.map(v=>v+'ing')).concat(verbs.map(v=>'did '+v)));
            q.correctValue = correct;
          } else {
            const p = prepositions[rand(0,prepositions.length-1)];
            q.text = `Choose the correct preposition: She is ${p[0]} ____ the task.`;
            q.options = makeOptions(p[1], prepositions.map(x=>x[1]));
            q.correctValue = p[1];
          }
        }
      } else if(level===3){
        if(r<0.35){
          const subj = ['The committee','My sister','The teacher','Our team'][rand(0,3)];
          const verb = verbs[rand(0,verbs.length-1)];
          q.text = `${subj} decided to ____ the deadline to ensure quality.`;
          q.options = makeOptions('extend', ['extend','shorten','ignore','postpone']);
          q.correctValue = 'extend';
        } else if(r<0.7){
          const verb = verbs[rand(0,verbs.length-1)];
          const past = (verb==='go')? 'went' : (verb+'ed');
          q.text = `Yesterday they ${verb} to the office.`;
          q.options = makeOptions(past, [past, verb, 'will '+verb, verb+'ing']);
          q.correctValue = past;
        } else {
          q.text = `The student studied all night and performed exceptionally well on the exam. What can be inferred?`;
          q.options = makeOptions('The student prepared thoroughly', ['The student prepared thoroughly','The exam was easy','The student guessed answers','The student slept during the exam']);
          q.correctValue = 'The student prepared thoroughly';
        }
      } else if(level===4){
        if(r<0.3){
          q.text = `Identify the error: "Each of the participants were given a certificate."`;
          q.options = makeOptions('were -> was', ['were -> was','participants -> participant','given -> give','a -> the']);
          q.correctValue = 'were -> was';
        } else if(r<0.6){
          q.text = `Choose the word that best completes: "The committee reached a ______ decision after long debate."`;
          q.options = makeOptions('unanimous', ['unanimous','trivial','hasty','sporadic']);
          q.correctValue = 'unanimous';
        } else if(r<0.85){
          const p = passages[rand(0,passages.length-1)];
          const qa = p.qs[rand(0,p.qs.length-1)];
          q.text = `${p.text} Question: ${qa.q}`;
          q.options = makeOptions(qa.a, [qa.a, 'Because it was expensive','Because it was delayed','Because it was difficult']);
          q.correctValue = qa.a;
        } else {
          q.text = `All interns who submit reports late receive a warning. John submitted his report late. What follows?`;
          q.options = makeOptions('John will receive a warning', ['John will receive a warning','John will be promoted','John will get extra time','John will be ignored']);
          q.correctValue = 'John will receive a warning';
        }
      } else {
        if(r<0.25){
          const p = passages[rand(0,passages.length-1)];
          const qa = p.qs[rand(0,p.qs.length-1)];
          q.text = `${p.text} Question: ${qa.q}`;
          q.options = makeOptions(qa.a, [qa.a, 'It is unclear','They disagreed','It was postponed']);
          q.correctValue = qa.a;
        } else if(r<0.55){
          q.text = `Despite the harsh criticism, the director persisted and completed the project on schedule. What does this suggest about the director?`;
          q.options = makeOptions('The director was determined', ['The director was determined','The director ignored feedback','The director lacked resources','The director delayed the project']);
          q.correctValue = 'The director was determined';
        } else if(r<0.8){
          q.text = `Complete: "Her explanation was so _____ that everyone understood the complex topic."`;
          q.options = makeOptions('lucid', ['lucid','ambiguous','esoteric','verbose']);
          q.correctValue = 'lucid';
        } else {
          q.text = `If all managers approve a budget and two managers are absent, can the budget be approved?`;
          q.options = makeOptions('Only if enough managers present form a quorum', ['Only if enough managers present form a quorum','Yes always','No never','Only the CEO can approve']);
          q.correctValue = 'Only if enough managers present form a quorum';
        }
      }
      arr.push(q);
    }
    return arr;
  }

  // UI state
  let state = {sessionId:null,name:null,level:1,questions:[],pos:0,answers:{}};

  function show(elem){ if(elem) elem.classList.remove('hidden'); }
  function hide(elem){ if(elem) elem.classList.add('hidden'); }

  // Timer
  let timerInterval = null;
  const levelTimes = {1:30,2:35,3:40,4:45,5:60};
  function showPrevButton(){ if(prevBtn) prevBtn.style.display = 'inline-block'; }
  function hidePrevButton(){ if(prevBtn) prevBtn.style.display = 'none'; }

  function startTimer(){ stopTimer(); const total = levelTimes[state.level]||40; state.timeLeft = total; state.justTimedOut = false; renderTimer(); timerInterval = setInterval(()=>{ state.timeLeft--; renderTimer(); if(state.timeLeft<=0){
        stopTimer();
        // mark if this question was unanswered when time expired
        const curQ = state.questions[state.pos];
        const wasUnanswered = !(state.answers && state.answers[curQ.id]);
        state.justTimedOut = wasUnanswered;
        state.pos = Math.min(state.pos+1, state.questions.length-1);
        updateSessionProgress();
        renderQuestion();
      }
    },1000); }
  function stopTimer(){ if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } }
  function renderTimer(){ const t = state.timeLeft||0; const mm = Math.floor(t/60); const ss = String(t%60).padStart(2,'0'); const el = $('#quiz-timer'); if(el) el.textContent = `${mm}:${ss}`; }

  // Render a question
  function renderQuestion(){
    stopTimer();
    const q = state.questions[state.pos];
    if(!q){ questionArea.innerHTML = '<em>No question data.</em>'; return; }
    quizInfo.textContent = `${state.name} — Level ${state.level}`;
    quizProgress.textContent = `Question ${state.pos+1} / ${state.questions.length}`;
    questionArea.innerHTML = '';
    const qdiv = document.createElement('div'); qdiv.innerHTML = `<h3>${escapeHtml(q.text)}</h3>`;
    questionArea.appendChild(qdiv);

    q.options.forEach((opt, idx)=>{
      const wrap = document.createElement('div'); wrap.className = 'option';
      const letter = document.createElement('div'); letter.className = 'letter'; letter.textContent = String.fromCharCode(65+idx);
      const text = document.createElement('div'); text.className = 'text'; text.textContent = opt;
      wrap.appendChild(letter); wrap.appendChild(text);
      if(state.answers[q.id]===opt) wrap.classList.add('selected');
      wrap.addEventListener('click',()=>{
        state.answers[q.id]=opt;
        questionArea.querySelectorAll('.option').forEach(x=>x.classList.remove('selected'));
        wrap.classList.add('selected');
        wrap.classList.add('picked');
        // answered: disallow previous navigation
        state.justTimedOut = false; hidePrevButton();
        updateSessionProgress();
        setTimeout(()=>{ if(state.pos < state.questions.length-1){ state.pos++; renderQuestion(); updateSessionProgress(); } else { finishQuiz(); } },420);
      });
      questionArea.appendChild(wrap);
    });
    // Prev visibility: show only if we just timed out and there is a previous question
    if(prevBtn){ if(state.justTimedOut && state.pos>0) showPrevButton(); else hidePrevButton(); }
    startTimer();
  }

  function updateSessionProgress(){
    const store = loadCandidates();
    const existing = store[state.sessionId] || {};
    store[state.sessionId] = {id:state.sessionId,name:state.name,level:state.level,total:state.questions.length,pos:state.pos,answers:state.answers,questions:state.questions,finished:false,score:null,ts:Date.now(),resumeAllowed: existing.resumeAllowed || false};
    saveCandidates(store);
    broadcast({type:'update',payload:store[state.sessionId]});
  }

  function finishQuiz(){
    stopTimer();
    let correct = 0; state.questions.forEach(q=>{ const ans = state.answers[q.id]; if(ans==q.correctValue) correct++; });
    const score = Math.round((correct/state.questions.length)*100);
    const store = loadCandidates();
    const existing = store[state.sessionId] || {};
    store[state.sessionId] = {id:state.sessionId,name:state.name,level:state.level,total:state.questions.length,pos:state.pos,answers:state.answers,questions:state.questions,finished:true,score:score,correct:correct,ts:Date.now(),resumeAllowed: existing.resumeAllowed || false};
    saveCandidates(store);
    broadcast({type:'finish',payload:store[state.sessionId]});
    showResult(store[state.sessionId]);
  }

  function showResult(r){
    hide(quizPanel); show(resultPanel);
    // Always show score after finishing
    resultSummary.innerHTML = `<p>Name: <strong>${escapeHtml(r.name)}</strong></p><p>Level: ${r.level}</p><p>Score: <strong>${r.score}</strong>% (${r.correct}/${r.total})</p>`;
  }

  // Start session
  function startSession(){
    const name = (nameInput.value||'Candidate').trim();
    const level = Number(levelSelect.value||1);
    state.sessionId = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    state.name = name || 'Candidate'; state.level = level; state.pos = 0; state.answers = {};
    const qbank = generateQuestions(level);
    state.questions = shuffle(qbank.slice());
    const store = loadCandidates();
    store[state.sessionId] = {id:state.sessionId,name:state.name,level:state.level,total:state.questions.length,pos:0,answers:{},questions:state.questions,finished:false,score:null,ts:Date.now(),resumeAllowed:false};
    saveCandidates(store);
    broadcast({type:'start',payload:store[state.sessionId]});
    hide(roleSelect); hide(calonPanel); hide(panitiaPanel); hide(resultPanel); show(quizPanel); renderQuestion();
    try{ localStorage.setItem(LAST_SESSION_KEY, state.sessionId); }catch(e){}
  }

  // Navigation
  const prevBtnEl = prevBtn; const nextBtnEl = nextBtn; const finishBtnEl = finishBtn;
  prevBtnEl.addEventListener('click',()=>{ if(state.pos>0){ state.pos--; state.justTimedOut = false; hidePrevButton(); renderQuestion(); updateSessionProgress(); } });
  nextBtnEl.addEventListener('click',()=>{ if(state.pos < state.questions.length-1){ state.pos++; state.justTimedOut = false; hidePrevButton(); renderQuestion(); updateSessionProgress(); } });
  finishBtnEl.addEventListener('click',()=>{ showConfirm('Finish and submit answers?').then(ok=>{ if(ok) finishQuiz(); }); });

  // role select fade hide
  function hideRoleSelectWithFade(){ try{ roleSelect.classList.add('fade-out'); setTimeout(()=>{ hide(roleSelect); roleSelect.style.display='none'; roleSelect.classList.remove('fade-out'); },350); }catch(e){ hide(roleSelect); } }
  btnCalon.addEventListener('click',()=>{ hideRoleSelectWithFade(); show(calonPanel); /* resume shown after login only */ });
  // Panitia button opens panitia login first (require login every time)
  btnPanitia.addEventListener('click',()=>{
    hideRoleSelectWithFade();
    // always require password entry when selecting Panitia
    show(panitiaLoginPanel); panitiaLoginStatus.textContent='';
  });
  startBtn.addEventListener('click',()=>{
    if(!nameInput.value.trim()){
      showConfirm('Continue without a name?').then(ok=>{ if(ok) startSession(); });
    } else { startSession(); }
  });
  returnHome.addEventListener('click',()=>{ location.reload(); });

  // Panitia functions
  function renderPanitiaList(cands){
    const keys = Object.keys(cands||{});
    panitiaList.innerHTML = '';
    if(keys.length===0){ panitiaList.textContent='No active candidates.'; return; }
    keys.forEach(k=>{
      const c = cands[k];
      const item = document.createElement('div'); item.className='item panitia-item'; item.dataset.id = c.id;
      const title = document.createElement('div'); title.style.display='flex'; title.style.justifyContent='space-between'; title.style.alignItems='center';
      const left = document.createElement('div'); left.innerHTML = `<strong>${escapeHtml(c.name)}</strong> — Level ${c.level}`;
      // resume indicator icon
      const ind = document.createElement('span'); ind.className = 'resume-indicator'; ind.style.marginLeft = '8px';
      if(c.finished || (c.pos >= (c.total||50))){ ind.textContent = '⛔'; ind.title = 'Cannot resume (finished)'; ind.classList.add('no-resume'); }
      else if(c.resumeAllowed){ ind.textContent = '✔'; ind.title = 'Resume allowed'; ind.classList.add('resume-yes'); }
      else { ind.textContent = '⏸'; ind.title = 'Resume not allowed'; ind.classList.add('resume-no'); }
      left.appendChild(ind);
      const right = document.createElement('div');
      const delBtn = document.createElement('button'); delBtn.className = 'panitia-btn danger'; delBtn.dataset.action='delete'; delBtn.dataset.id=c.id; delBtn.textContent='Delete';
      right.appendChild(delBtn);
      title.appendChild(left); title.appendChild(right);
      item.appendChild(title);
      const meta = document.createElement('div');
      if(c.finished){ meta.innerHTML = `Status: <strong>Finished</strong> — Score: ${c.score}% (${c.correct}/${c.total})`; }
      else { const pct = Math.round((Object.keys(c.answers||{}).length / (c.total||50))*100); meta.textContent = `Progress: ${pct}% (${Object.keys(c.answers||{}).length}/${c.total})`; }
      item.appendChild(meta);
      panitiaList.appendChild(item);
    });
  }

  // Whitelist management
  const wlListEl = $('#whitelist-list');
  const wlAddBtn = $('#whitelist-add');
  const wlUserInput = $('#whitelist-username');
  const wlPassInput = $('#whitelist-password');

  function renderWhitelist(){
    const store = loadWhitelist(); wlListEl.innerHTML='';
    const keys = Object.keys(store||{});
    if(keys.length===0){ wlListEl.textContent='No whitelist users.'; return; }
    keys.forEach(k=>{
      const u = store[k];
      const div = document.createElement('div'); div.style.display='flex'; div.style.justifyContent='space-between'; div.style.alignItems='center'; div.style.padding='6px 0';
      const left = document.createElement('div'); left.textContent = `${k} ${u.allowed? '(allowed)':'(blocked)'}`;
      const right = document.createElement('div');
      const toggle = document.createElement('button'); toggle.className='panitia-btn'; toggle.textContent = u.allowed? 'Block':'Allow'; toggle.dataset.action='wl_toggle'; toggle.dataset.user=k;
      const del = document.createElement('button'); del.className='panitia-btn danger'; del.textContent='Delete'; del.dataset.action='wl_delete'; del.dataset.user=k;
      right.appendChild(toggle); right.appendChild(del);
      div.appendChild(left); div.appendChild(right); wlListEl.appendChild(div);
    });
  }

  // Global centered alert (lazy query to support placement after script tag)
  let globalAlert = $('#global-alert');
  let alertBox = $('#alert-box');
  function showAlert(msg,timeout=2500){
    try{
      if(!globalAlert) globalAlert = document.getElementById('global-alert');
      if(!alertBox) alertBox = document.getElementById('alert-box');
      if(alertBox) alertBox.textContent = msg;
      if(globalAlert) globalAlert.classList.remove('hidden');
      setTimeout(()=>{ try{ if(globalAlert) globalAlert.classList.add('hidden'); }catch(e){} }, timeout);
    }catch(e){}
  }

  // Confirm modal (Yes/No) - returns Promise<boolean>
  let confirmModal = $('#confirm-modal');
  let confirmMessage = $('#confirm-message');
  let confirmYes = $('#confirm-yes');
  let confirmNo = $('#confirm-no');
  function showConfirm(message){
    return new Promise((resolve)=>{
      try{
        if(!confirmModal) confirmModal = document.getElementById('confirm-modal');
        if(!confirmMessage) confirmMessage = document.getElementById('confirm-message');
        if(!confirmYes) confirmYes = document.getElementById('confirm-yes');
        if(!confirmNo) confirmNo = document.getElementById('confirm-no');
        if(confirmMessage) confirmMessage.textContent = message;
        if(confirmModal) confirmModal.classList.remove('hidden');
        const clean = ()=>{ try{ if(confirmModal) confirmModal.classList.add('hidden'); }catch(e){}; if(confirmYes) confirmYes.removeEventListener('click',onYes); if(confirmNo) confirmNo.removeEventListener('click',onNo); };
        const onYes = ()=>{ clean(); resolve(true); };
        const onNo = ()=>{ clean(); resolve(false); };
        if(confirmYes) confirmYes.addEventListener('click', onYes); if(confirmNo) confirmNo.addEventListener('click', onNo);
      }catch(e){ resolve(false); }
    });
  }

  wlAddBtn && wlAddBtn.addEventListener('click',()=>{
    const user = (wlUserInput.value||'').trim(); const pass = (wlPassInput.value||'').trim();
    if(!user || !pass){ showAlert('Enter username and password'); return; }
    const wl = loadWhitelist();
    const proceed = ()=>{ wl[user] = {password:pass,allowed:true,ts:Date.now()}; saveWhitelist(wl); renderWhitelist(); wlUserInput.value=''; wlPassInput.value=''; };
    if(wl[user]){
      showConfirm('User exists - overwrite password?').then(ok=>{ if(ok) proceed(); });
    } else { proceed(); }
  });

  // handle whitelist button actions
  wlListEl && wlListEl.addEventListener('click',(e)=>{
    const btn = e.target.closest('button'); if(!btn) return; const act = btn.dataset.action; const user = btn.dataset.user; const wl = loadWhitelist(); if(!wl[user]) return;
    if(act==='wl_toggle'){ wl[user].allowed = !wl[user].allowed; saveWhitelist(wl); renderWhitelist(); }
    if(act==='wl_delete'){ showConfirm('Delete whitelist user?').then(ok=>{ if(ok){ delete wl[user]; saveWhitelist(wl); renderWhitelist(); } }); }
  });

  // when showing panitia panel, render whitelist too
  function refreshPanitiaList(){ renderPanitiaList(loadCandidates()); renderWhitelist(); }

  // panitia login / setup handlers
  panitiaLoginBtn && panitiaLoginBtn.addEventListener('click',()=>{
    const pass = (panitiaPasswordInput.value||'').trim();
    const stored = loadAdminPass();
    if(!stored){ showAlert('No admin password set. Use Setup to create one.'); return; }
    if(pass === stored){
      // success
      sessionStorage.setItem('tka_current_admin','1');
      hide(panitiaLoginPanel); show(panitiaPanel); refreshPanitiaList();
      panitiaPasswordInput.value=''; panitiaLoginStatus.textContent='';
    } else { showAlert('Invalid admin password'); }
  });
  panitiaSetupBtn && panitiaSetupBtn.addEventListener('click',async ()=>{
    const pass = (panitiaPasswordInput.value||'').trim(); if(!pass){ panitiaLoginStatus.textContent='Enter a new admin password to setup.'; return; }
    const existing = loadAdminPass();
    if(existing){ const ok = await showConfirm('Admin password already set — overwrite?'); if(!ok) return; }
    saveAdminPass(pass); panitiaLoginStatus.textContent='Admin password saved. Use Login.'; panitiaPasswordInput.value='';
  });

  // panel tabs
  tabMonitorBtn && tabMonitorBtn.addEventListener('click',()=>{ show(panitiaMonitorDiv); hide(panitiaWhitelistDiv); tabMonitorBtn.classList.add('btn-primary'); tabWhitelistBtn.classList.remove('btn-primary'); });
  tabWhitelistBtn && tabWhitelistBtn.addEventListener('click',()=>{ hide(panitiaMonitorDiv); show(panitiaWhitelistDiv); tabWhitelistBtn.classList.add('btn-primary'); tabMonitorBtn.classList.remove('btn-primary'); renderWhitelist(); });
  panitiaLogoutBtn && panitiaLogoutBtn.addEventListener('click',()=>{
    // clear admin session and require login again
    sessionStorage.removeItem('tka_current_admin');
    // hide panitia panel content
    hide(panitiaPanel);
    hide(panitiaMonitorDiv); hide(panitiaWhitelistDiv);
    // reset tab styling
    if(tabMonitorBtn) tabMonitorBtn.classList.remove('btn-primary');
    if(tabWhitelistBtn) tabWhitelistBtn.classList.remove('btn-primary');
    // show panitia login panel and prompt for password
    show(panitiaLoginPanel);
    if(panitiaLoginStatus) panitiaLoginStatus.textContent = 'Logged out. Please login again.';
  });

  // Open candidate detail or handle button actions
  let openDetailId = null;
  const panitiaDetailEl = $('#panitia-detail');
  const detailNameEl = $('#detail-name');
  const detailMetaEl = $('#detail-meta');
  const detailAnswersEl = $('#detail-answers');
  const detailCloseBtn = $('#detail-close');

  panitiaList.addEventListener('click',(e)=>{
    const btn = e.target.closest('button');
    if(btn){ const action = btn.dataset.action; const id = btn.dataset.id; if(action==='delete'){ showConfirm('Delete this candidate progress? This action cannot be undone.').then(ok=>{ if(ok) deleteCandidate(id); }); } return; }
    const it = e.target.closest('.panitia-item'); if(!it) return; const id = it.dataset.id; showCandidateDetail(id);
  });

  detailCloseBtn && detailCloseBtn.addEventListener('click',()=>{ if(panitiaDetailEl) panitiaDetailEl.classList.add('hidden'); openDetailId = null; });

  function showCandidateDetail(id){
    const store = loadCandidates(); const c = store[id];
    if(!c){ showAlert('No data for this candidate'); if(panitiaDetailEl) panitiaDetailEl.classList.add('hidden'); openDetailId = null; return; }
    openDetailId = id;
    if(panitiaDetailEl) panitiaDetailEl.classList.remove('hidden');
    detailNameEl.textContent = c.name || 'Candidate';
    detailMetaEl.textContent = `Level ${c.level} — ${c.finished? 'Finished':'In Progress'} — ${c.total} questions`;
    // add resume permission toggle (panitia only)
    // remove existing toggle if present
    const existingToggle = panitiaDetailEl.querySelector('.detail-resume-toggle');
    if(existingToggle) existingToggle.remove();
    const toggleBtn = document.createElement('button'); toggleBtn.className = 'panitia-btn detail-resume-toggle';
    toggleBtn.style.marginLeft = '8px';
    toggleBtn.textContent = c.resumeAllowed? 'Revoke Resume':'Allow Resume';
    toggleBtn.addEventListener('click', ()=>{
      const store2 = loadCandidates(); if(!store2[id]) return; store2[id].resumeAllowed = !store2[id].resumeAllowed; saveCandidates(store2); broadcast({type:'update', payload:{id}}); showCandidateDetail(id);
      showAlert(store2[id].resumeAllowed? 'Resume allowed for candidate':'Resume revoked for candidate');
    });
    // append next to close button
    const header = panitiaDetailEl.querySelector('.panitia-detail-header'); if(header){ header.appendChild(toggleBtn); }
    detailAnswersEl.innerHTML = '';
    const qs = c.questions || [];
    qs.forEach((q,idx)=>{
      const row = document.createElement('div'); row.className='answer-row';
      const num = document.createElement('div'); num.className='qnum'; num.textContent = idx+1;
      const qtext = document.createElement('div'); qtext.className='qtext'; qtext.textContent = (q.text||'Question').slice(0,220);
      const ansWrap = document.createElement('div'); ansWrap.className='ans-wrap';
      const given = (c.answers && c.answers[q.id])? c.answers[q.id] : '';
      const correct = q.correctValue || '';
      const ansEl = document.createElement('div'); ansEl.className='ans'; ansEl.textContent = given || '—';
      if(given=='') ansEl.classList.add('unanswered');
      else if(given === correct) ansEl.classList.add('correct'); else ansEl.classList.add('wrong');
      const corrEl = document.createElement('div'); corrEl.className='small'; corrEl.style.marginLeft='10px'; corrEl.textContent = `Answer: ${correct}`;
      ansWrap.appendChild(ansEl); ansWrap.appendChild(corrEl);
      row.appendChild(num); row.appendChild(qtext); row.appendChild(ansWrap);
      detailAnswersEl.appendChild(row);
    });
  }

  // Candidate login flow
  if(loginBtnEl){
    loginBtnEl.addEventListener('click',()=>{
      const user = (loginUsername.value||'').trim(); const pass = (loginPassword.value||'').trim();
      if(!user || !pass){ showAlert('Enter username and password'); return; }
      const wl = loadWhitelist(); const entry = wl[user];
      if(!entry){ showAlert('User not registered'); return; }
      if(!entry.allowed){ showAlert('User not allowed by panitia'); return; }
      if(entry.password !== pass){ showAlert('Invalid password'); return; }
      // success
      loginStatusEl.textContent = 'Authenticated — choose level and start';
      // mark current logged-in candidate
      sessionStorage.setItem('tka_current_user', user);
      nameInput.value = user; if(nameWrap) nameWrap.style.display='block'; if(levelWrap) levelWrap.classList.remove('hidden'); if(startBtn) startBtn.classList.remove('hidden');
      // hide login inputs
      if(loginUsername) loginUsername.parentElement.style.display='none';
      if(loginPassword) loginPassword.parentElement.style.display='none';
      if(loginBtnEl) loginBtnEl.style.display='none';
      // show resume for this user if exists
      showResumeIfExists();
    });
  }

  const clearAllBtn = $('#clear-all'); if(clearAllBtn){ clearAllBtn.addEventListener('click',()=>{ showConfirm('Clear all candidate progress? This cannot be undone.').then(ok=>{ if(ok){ localStorage.removeItem(LS_KEY); broadcast({type:'clear_all'}); renderPanitiaList({}); } }); }); }

  function deleteCandidate(id){ const store = loadCandidates(); if(store[id]){ delete store[id]; saveCandidates(store); broadcast({type:'delete',payload:{id}}); renderPanitiaList(store); } }
  function refreshPanitiaList(){ renderPanitiaList(loadCandidates()); }

  // BroadcastChannel handling (also update candidate result view in real-time)
  if(ch){
    ch.onmessage = (ev)=>{
      const msg = ev.data;
      if(!msg) return;
      if(msg.type==='start' || msg.type==='update' || msg.type==='finish' || msg.type==='delete' || msg.type==='clear_all'){
          renderPanitiaList(loadCandidates());
          try{ showResumeIfExists(); }catch(e){}
      }
      // If a detail panel is open for this candidate, refresh it live
      try{
        const payload = msg.payload || {};
        if(typeof openDetailId !== 'undefined' && openDetailId){
          if((msg.type==='update' || msg.type==='finish' || msg.type==='start') && payload.id && payload.id === openDetailId){
            showCandidateDetail(openDetailId);
          }
          if(msg.type==='delete' && payload.id && payload.id === openDetailId){
            if(panitiaDetailEl) panitiaDetailEl.classList.add('hidden'); openDetailId = null;
          }
          if(msg.type==='clear_all'){
            if(panitiaDetailEl) panitiaDetailEl.classList.add('hidden'); openDetailId = null;
          }
        }
      }catch(e){}
      // if someone finished and it's this session, update candidate view live
      if(msg.type==='finish'){
        const payload = msg.payload || {};
        if(payload.id && payload.id === state.sessionId){ showResult(payload); }
      }
    }
  }

  // storage event for cross-tab sync
  window.addEventListener('storage',(e)=>{ if(e.key===LS_KEY) renderPanitiaList(loadCandidates()); });

  // initial panitia render
  refreshPanitiaList();

  // escape html
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // --- Resume support for candidates ---
  const resumeArea = $('#resume-area');
  const resumeInfo = $('#resume-info');
  const btnResume = $('#btn-resume');
  const btnViewResult = $('#btn-view-result');
  const btnClearSession = $('#btn-clear-session');

  function showResumeIfExists(){
    try{
      // Only show resume for currently logged-in candidate
      const current = sessionStorage.getItem('tka_current_user');
      if(!current){ if(resumeArea) resumeArea.style.display='none'; return; }
      const last = localStorage.getItem(LAST_SESSION_KEY);
      if(!last){ if(resumeArea) resumeArea.style.display='none'; return; }
      const store = loadCandidates(); const entry = store[last];
      if(!entry || entry.name !== current){ if(resumeArea) resumeArea.style.display='none'; return; }
      // Check whitelist permission (must be allowed candidate)
      const wl = loadWhitelist(); const wentry = wl[current];
      if(!wentry || !wentry.allowed){ if(resumeArea) resumeArea.style.display='none'; return; }
      resumeInfo.textContent = `${entry.name} — Level ${entry.level} — ${entry.finished? 'Finished':'In Progress'}`;
      resumeArea.style.display='block';
      // Resume only if panitia allowed (entry.resumeAllowed === true) and session not finished
      if(entry.finished || (entry.pos >= (entry.total||50))){
        btnResume.style.display = 'none';
        btnResume.onclick = ()=>{ showAlert('Session complete; cannot resume'); };
      } else if(entry.resumeAllowed){
        btnResume.style.display = 'inline-block'; btnResume.onclick = ()=>{ resumeSession(last); };
      } else {
        btnResume.style.display = 'none';
        btnResume.onclick = ()=>{ showAlert('Resume disabled. Ask panitia for permission to continue this session.'); };
      }
      btnViewResult.onclick = ()=>{ viewResultById(last,false); };
      // Candidates cannot delete progress; only panitia can. Show an informational action instead.
      btnClearSession.onclick = ()=>{ showAlert('Only panitia can clear or delete progress.'); };
      btnClearSession.style.display = 'inline-block';
    }catch(e){ if(resumeArea) resumeArea.style.display='none'; }
  }

  function resumeSession(id){ const store = loadCandidates(); const entry = store[id]; if(!entry){ showAlert('No session found to resume'); return; } if(!entry.questions){ showAlert('Session data incomplete; cannot resume'); return; } state.sessionId = entry.id; state.name = entry.name; state.level = entry.level; state.questions = entry.questions; state.pos = entry.pos||0; state.answers = entry.answers||{}; hide(roleSelect); hide(calonPanel); hide(panitiaPanel); hide(resultPanel); show(quizPanel); renderQuestion(); }
  function viewResultById(id, asPanitia=false){ const store = loadCandidates(); const entry = store[id]; if(!entry){ showAlert('No result found'); return; } if(!asPanitia){ const current = sessionStorage.getItem('tka_current_user'); if(!current || entry.name !== current){ showAlert('You are not authorized to view this result'); return; } const wl = loadWhitelist(); const w = wl[current]; if(!w || !w.allowed){ showAlert('You are not allowed to view past sessions'); return; } }
    showResult(entry);
  }

  // check resume on load - no automatic resume shown until login

})();
