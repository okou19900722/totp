// 站点配置的读取与保存
(function(){
  const defaultConfig = {
    client_id: '',
    owner: '',
    repo: '',
    path: 'data/totp.enc.bin',
    public_key_pem: '',
    branch: 'main',
    // 固定：授权 scope，最小化权限（只读/只写内容）
    scope: 'repo'
  };

  function getConfig(){
    try {
      const raw = localStorage.getItem('totp_config');
      return raw ? { ...defaultConfig, ...JSON.parse(raw) } : defaultConfig;
    } catch(e){
      console.warn('parse config failed', e);
      return defaultConfig;
    }
  }

  function saveConfig(cfg){
    localStorage.setItem('totp_config', JSON.stringify(cfg));
  }

  window.TOTP_CFG = { getConfig, saveConfig };
})();