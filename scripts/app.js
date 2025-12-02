// 页面交互与路由
(function(){
  const fileName = "data1.bin";
  // const fileName = "data/totp.enc.bin";
  const views = {
    list: document.getElementById('view-list'),
    settings: document.getElementById('view-settings'),
  };
  function show(name){
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[name].classList.remove('hidden');
    if (name === "settings") {
      loadConfigToUI();
    } else if (name === "list") {
      renderList();
    }
  }

  // 导航按钮
  document.getElementById('nav-list').onclick = () => show('list');
  document.getElementById('nav-settings').onclick = () => show('settings');

  // 设置页加载与保存
  const cfgInputs = {
    token: document.getElementById('cfg-token'),
    owner: document.getElementById('cfg-owner'),
    repo: document.getElementById('cfg-repo'),
    public_key_pem: document.getElementById('cfg-public-key'),
    private_key_pem: document.getElementById('cfg-private-key'),
  };
  function loadConfigToUI(){
    const cfg = TOTP_CFG.getConfig();
    Object.keys(cfgInputs).forEach(k => cfgInputs[k].value = cfg[k] || '');
  }
  document.getElementById('btn-save-config').onclick = () => {
    const cfg = TOTP_CFG.getConfig();
    Object.keys(cfgInputs).forEach(k => cfg[k] = cfgInputs[k].value);
    TOTP_CFG.saveConfig(cfg);
    alert('配置已保存');
  };

  // 设备授权视图
  const pollBtn = document.getElementById('poll-token');
  // 移除设备授权相关元素获取
  const patInput = document.getElementById('pat-input');

  if (pollBtn) {
    pollBtn.onclick = () => {
      authStatus.textContent = '设备授权已移除，请使用 PAT 登录';
    };
  }

  let currentData = null; // 解密后的 protobuf 对象
  let currentSha = null;  // 仓库文件 sha

  async function fetchAndDecrypt(){
    try {
      await fetchAndDecrypt1();
    } catch (e) {
      console.log(e);
      currentData = { otpParameters: [], version: 1, batch_size: 1, batch_index: 0, batch_id: 1 };
      renderList();
    }
  }
  async function fetchAndDecrypt1(){
    try{
      await TOTP_PROTO.init();
      const cfg = TOTP_CFG.getConfig();
      const file = await GH_CONTENTS.getFile(cfg.owner, cfg.repo, fileName, "master");
      if(!file){
        currentData = { otpParameters: [], version: 1, batch_size: 1, batch_index: 0, batch_id: 1 };
        renderList();
        return;
      }
      currentSha = file.sha;

      let content = TOTP_BASE64.decode(file.content)
      const plain = await TOTP_CRYPTO.decryptDataWithHybrid(content, cfg.private_key_pem);
      const decodedObj = TOTP_PROTO.decodeToObject(plain);
      // 保护性处理：确保必要字段存在
      currentData = {
        otpParameters: Array.isArray(decodedObj.otpParameters) ? decodedObj.otpParameters : [],
        version: decodedObj.version || 1,
        batch_size: decodedObj.batch_size || 1,
        batch_index: decodedObj.batch_index || 0,
        batch_id: decodedObj.batch_id || 1,
      };
      console.log(currentData)
      renderList();
    }catch(e){
      console.error(e);
    }
  }

  // 列表渲染与倒计时
  const listEl = document.getElementById('totp-list');
  const progressBar = document.getElementById('progress-bar');
  const listStatus = document.getElementById('list-status');
  let timer = null;

  function renderList(){
    // show('list');
    listEl.innerHTML = '';
    const arr = (currentData?.otpParameters)||[];
    arr.forEach((p, idx) => {
      const li = document.createElement('li');
      const name = document.createElement('div'); name.className='name'; name.textContent = `${p.issuer||''} | ${p.name||''}`.trim();
      const code = document.createElement('div'); code.className='code'; code.textContent = '------';
      const btnDel = document.createElement('button'); btnDel.className='danger'; btnDel.textContent='删除';
      btnDel.onclick = () => { arr.splice(idx,1); renderList(); };
      li.appendChild(name); li.appendChild(code); li.appendChild(btnDel);
      listEl.appendChild(li);
      li.dataset.index = idx;
    });
    startCountdown(arr);
  }

  function startCountdown(arr){
    if(timer) clearInterval(timer);
    const step = 30; // TOTP 30s
    const tickStart = Math.floor(Date.now()/1000);
    async function refresh(){
      const now = Math.floor(Date.now()/1000);
      const remain = step - (now % step);
      const pct = ((step - remain)/step)*100;
      progressBar.style.width = pct+'%';
      for(const li of listEl.children){
        const idx = parseInt(li.dataset.index,10);
        const p = arr[idx];
        if(!p) continue;
        const digits = TOTP_CORE.digitEnumToNumber(p.digits);
        const algo = TOTP_CORE.algoEnumToString(p.algorithm);
        const keyBytes = new Uint8Array(p.secret);
        const code = p.type === 1 /* HOTP */ ? await TOTP_CORE.hotp(keyBytes, p.counter||0, digits, algo) : await TOTP_CORE.totp(keyBytes, step, digits, algo);
        li.children[1].textContent = code;
      }
    }
    timer = setInterval(refresh, 500);
    refresh();
  }

  // 新增/编辑
  const editName = document.getElementById('edit-name');
  const editIssuer = document.getElementById('edit-issuer');
  const editSecret = document.getElementById('edit-secret');
  const editAlgo = document.getElementById('edit-algo');
  const editDigits = document.getElementById('edit-digits');
  const editType = document.getElementById('edit-type');
  const editCounter = document.getElementById('edit-counter');
  document.getElementById('btn-add-update').onclick = async () => {
    const sBytes = TOTP_CORE.toBytes(editSecret.value);
    const algoEnum = editAlgo.value==='SHA256'?2:editAlgo.value==='SHA512'?3:1;
    const digitsEnum = editDigits.value==='8'?2:1;
    const typeEnum = editType.value==='HOTP'?1:2;
    const newItem = { secret: Array.from(sBytes), name: editName.value, issuer: editIssuer.value, algorithm: algoEnum, digits: digitsEnum, type: typeEnum, counter: parseInt(editCounter.value||'0',10) };
    currentData.otpParameters = currentData.otpParameters || [];
    currentData.otpParameters.push(newItem);

    var plain = TOTP_PROTO.encodeMessage(currentData);
    const cfg = TOTP_CFG.getConfig();
    const enc = await TOTP_CRYPTO.encryptDataWithHybrid(plain, cfg.public_key_pem);
    const content = TOTP_BASE64.encode(enc);

    const res = await GH_CONTENTS.putFile(cfg.owner, cfg.repo, fileName, content, currentSha || undefined, "master");
    currentSha = res.content.sha;
    renderList();
  };

  // 初始：检查 token 存在与否
  async function init(){
    if (TOTP_CFG.hasConfig()) {
      await fetchAndDecrypt();
      show("list")
    } else {
      show("settings")
    }
    // loadConfigToUI();
    // loadSecretsFromStorage();
    // const hasTok = GH_TOKEN.hasToken();
    // document.getElementById('auth-status').textContent = hasTok ? '已检测到 token' : '尚未授权（请使用 PAT 登录）';
    // // 如果已有 token 且私钥/密码都存在，自动拉取并解码
    // if(hasTok && (inputPrivateKey.value.trim().length > 0) && (inputPassword.value.length > 0)){
    //   show('unlock');
    //   // 稍作延迟，等待视图切换后执行，避免状态信息被覆盖
    //   setTimeout(fetchAndDecrypt, 10);
    // }else{
    //   show(hasTok ? 'unlock' : 'auth');
    // }
  }
  init();
})();