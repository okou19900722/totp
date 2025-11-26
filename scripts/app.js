// 页面交互与路由
(function(){
  const views = {
    auth: document.getElementById('view-auth'),
    unlock: document.getElementById('view-unlock'),
    list: document.getElementById('view-list'),
    settings: document.getElementById('view-settings'),
  };
  function show(name){
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[name].classList.remove('hidden');
  }

  // 导航按钮
  document.getElementById('nav-auth').onclick = () => show('auth');
  document.getElementById('nav-unlock').onclick = () => show('unlock');
  document.getElementById('nav-list').onclick = () => show('list');
  document.getElementById('nav-settings').onclick = () => show('settings');

  // 设置页加载与保存
  const cfgInputs = {
    client_id: document.getElementById('cfg-client-id'),
    owner: document.getElementById('cfg-owner'),
    repo: document.getElementById('cfg-repo'),
    path: document.getElementById('cfg-path'),
    public_key_pem: document.getElementById('cfg-public-key'),
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
  const authStatus = document.getElementById('auth-status');
  const startBtn = document.getElementById('start-device-flow');
  const pollBtn = document.getElementById('poll-token');
  const deviceDetails = document.getElementById('device-flow-details');
  const verificationUri = document.getElementById('verification-uri');
  const userCode = document.getElementById('user-code');
  // 移除设备授权相关元素获取
  const patInput = document.getElementById('pat-input');
  const openPatBtn = document.getElementById('open-pat-page');
  const savePatBtn = document.getElementById('save-pat');

  // PAT 相关：打开 token 生成页、保存 PAT
  openPatBtn.onclick = () => {
    window.open('https://github.com/settings/personal-access-tokens/new', '_blank');
  };
  savePatBtn.onclick = () => {
    const pat = (patInput?.value||'').trim();
    if(!pat){
      alert('请先粘贴 PAT');
      return;
    }
    GH_DEVICE.setToken(pat);
    authStatus.textContent = '已保存 PAT 到浏览器';
    show('unlock');
  };

  // 设备授权功能已移除，保留占位避免报错
  if (startBtn) {
    startBtn.onclick = () => {
      authStatus.textContent = '设备授权已移除，请使用 PAT 登录';
    };
  }
  if (pollBtn) {
    pollBtn.onclick = () => {
      authStatus.textContent = '设备授权已移除，请使用 PAT 登录';
    };
  }

  // 解锁视图
  const inputPassword = document.getElementById('input-password');
  const inputPrivateKey = document.getElementById('input-private-key');
  const btnLoadDecrypt = document.getElementById('btn-load-decrypt');
  const unlockStatus = document.getElementById('unlock-status');

  let currentData = null; // 解密后的 protobuf 对象
  let currentSha = null;  // 仓库文件 sha

  async function fetchAndDecrypt(){
    try{
      unlockStatus.textContent = '拉取仓库数据...';
      await TOTP_PROTO.init();
      const cfg = TOTP_CFG.getConfig();
      const file = await GH_CONTENTS.getFile(cfg.owner, cfg.repo, cfg.path);
      if(!file){
        unlockStatus.textContent = '仓库未发现数据文件，将从空列表开始。';
        currentData = { otp_parameters: [], version: 1, batch_size: 1, batch_index: 0, batch_id: 1 };
        currentSha = null;
        renderList();
        return;
      }
      currentSha = file.sha;
      const enc = JSON.parse(file.content);
      unlockStatus.textContent = '解密中...';
      const plain = await TOTP_CRYPTO.decryptDataWithHybrid(enc, inputPrivateKey.value.trim(), inputPassword.value);
      const decoded = TOTP_PROTO.decodeUint8(plain);
      currentData = JSON.parse(JSON.stringify(decoded));
      unlockStatus.textContent = '解密成功，加载列表';
      renderList();
    }catch(e){
      unlockStatus.textContent = '失败：' + e.message;
    }
  }
  btnLoadDecrypt.onclick = fetchAndDecrypt;

  // 列表渲染与倒计时
  const listEl = document.getElementById('totp-list');
  const progressBar = document.getElementById('progress-bar');
  const listStatus = document.getElementById('list-status');
  let timer = null;

  function renderList(){
    show('list');
    listEl.innerHTML = '';
    const arr = (currentData?.otp_parameters)||[];
    arr.forEach((p, idx) => {
      const li = document.createElement('li');
      const name = document.createElement('div'); name.className='name'; name.textContent = `${p.issuer||''} ${p.name||''}`.trim();
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
  document.getElementById('btn-add-update').onclick = () => {
    const sBytes = TOTP_CORE.toBytes(editSecret.value);
    const algoEnum = editAlgo.value==='SHA256'?2:editAlgo.value==='SHA512'?3:1;
    const digitsEnum = editDigits.value==='8'?2:1;
    const typeEnum = editType.value==='HOTP'?1:2;
    const newItem = { secret: Array.from(sBytes), name: editName.value, issuer: editIssuer.value, algorithm: algoEnum, digits: digitsEnum, type: typeEnum, counter: parseInt(editCounter.value||'0',10) };
    currentData.otp_parameters = currentData.otp_parameters || [];
    currentData.otp_parameters.push(newItem);
    renderList();
  };

  // 重新加密并上传
  document.getElementById('btn-save-upload').onclick = async () => {
    try{
      listStatus.textContent = '编码并加密...';
      const uint8 = TOTP_PROTO.encodeMessage(currentData);
      const cfg = TOTP_CFG.getConfig();
      const enc = await TOTP_CRYPTO.encryptDataWithHybrid(uint8, cfg.public_key_pem, inputPassword.value);
      const payload = JSON.stringify(enc);
      listStatus.textContent = '上传到仓库...';
      const res = await GH_CONTENTS.putFile(cfg.owner, cfg.repo, cfg.path, payload, currentSha||undefined);
      currentSha = res.content.sha;
      listStatus.textContent = '保存成功';
    }catch(e){
      listStatus.textContent = '失败：' + e.message;
    }
  };

  // 初始：检查 token 存在与否
  function init(){
    loadConfigToUI();
    const hasTok = GH_DEVICE.hasToken();
    document.getElementById('auth-status').textContent = hasTok ? '已检测到 token' : '尚未授权（请使用 PAT 登录）';
    show(hasTok ? 'unlock' : 'auth');
  }
  init();
})();