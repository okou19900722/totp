// GitHub Contents API 读取/写入加密数据文件
(function(){
  function headers(){
    const token = GH_DEVICE.getToken();
    if(!token) throw new Error('未找到 GitHub token');
    return {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json'
    };
  }

  async function getFile(owner, repo, path){
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const resp = await fetch(url, { headers: headers() });
    if(resp.status === 404) return null;
    if(!resp.ok) throw new Error('读取文件失败');
    const data = await resp.json();
    // data.content 为 base64
    const content = atob(data.content.replace(/\n/g, ''));
    return { sha: data.sha, content };
  }

  async function putFile(owner, repo, path, content, sha){
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const body = {
      message: 'Update TOTP data',
      content: btoa(content),
      sha
    };
    const resp = await fetch(url, { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if(!resp.ok) throw new Error('写入文件失败');
    return await resp.json();
  }

  window.GH_CONTENTS = { getFile, putFile };
})();