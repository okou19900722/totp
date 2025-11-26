// GitHub 设备授权流程（Device Flow）与 token 存储
(function(){
  const TOKEN_KEY = 'github_token';

  function hasToken(){
    return !!localStorage.getItem(TOKEN_KEY);
  }
  function getToken(){
    return localStorage.getItem(TOKEN_KEY);
  }
  function setToken(token){
    localStorage.setItem(TOKEN_KEY, token);
  }

  async function startDeviceFlow(){
    const cfg = TOTP_CFG.getConfig();
    if(!cfg.client_id){
      throw new Error('请先在设置页配置 OAuth Client ID');
    }
    const resp = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cfg.client_id, scope: cfg.scope })
    });
    if(!resp.ok) throw new Error('获取设备代码失败');
    const data = await resp.json();
    return data; // { device_code, user_code, verification_uri, expires_in, interval }
  }

  async function pollForToken(device_code){
    const cfg = TOTP_CFG.getConfig();
    const body = new URLSearchParams({
      client_id: cfg.client_id,
      device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    });
    const resp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await resp.json();
    if(data.error){
      return { error: data.error, error_description: data.error_description };
    }
    setToken(data.access_token);
    return { access_token: data.access_token };
  }

  window.GH_DEVICE = { hasToken, getToken, setToken, startDeviceFlow, pollForToken };
})();