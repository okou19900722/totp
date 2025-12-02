// GitHub token 存储
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

  window.GH_TOKEN = { hasToken, getToken, setToken };
})();