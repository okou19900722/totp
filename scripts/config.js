// 站点配置的读取与保存
(function(){
  const defaultConfig = {
    token: '',
    owner: '',
    repo: '',
    public_key_pem: '',
    private_key_pem: ''
  };

  const TOKEN_KEY = 'totp_config';
  function getConfig(){
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { ...defaultConfig, ...JSON.parse(raw) } : defaultConfig;
    } catch(e){
      console.warn('parse config failed', e);
      return defaultConfig;
    }
  }

  function saveConfig(cfg){
    localStorage.setItem(TOKEN_KEY, JSON.stringify(cfg));
  }

  function hasConfig(){
    return !!localStorage.getItem(TOKEN_KEY);
  }

  window.TOTP_CFG = { getConfig, saveConfig, hasConfig };
})();