// GitHub Contents API 读取/写入加密数据文件（支持空仓库首次提交）
(function(){
  function headers(){
    var cfg = TOTP_CFG.getConfig();
    const token = cfg.token;
    if(!token) throw new Error('未找到 GitHub token');
    return {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json'
    };
  }

  async function getSha(owner, repo, branch) {
    const url = `https://api.github.com/repos/${owner}/${repo}/branches`;
    const resp = await fetch(url, { headers: headers() });
    if(resp.status === 404) return null;
    if(!resp.ok) throw new Error('读取文件失败');
    const data = await resp.json();
    return data.find(i => i.name === branch).commit.sha;
  }

  async function getFile(owner, repo, path, branch){
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${branch?`?ref=${encodeURIComponent(branch)}`:''}`;
    const resp = await fetch(url, { headers: headers() });
    if(resp.status === 404) return null;
    if(!resp.ok) throw new Error('读取文件失败');
    const data = await resp.json();
    const content = data.content;
    return { sha: data.sha, content };
  }

  async function initRepoWithFile(owner, repo, branch, path, content){
    const hdrs = { ...headers(), 'Content-Type': 'application/json' };
    const base64 = content;
    // 1) 创建 blob
    const blobResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ content: base64, encoding: 'base64' })
    });
    if(!blobResp.ok) throw new Error('初始化失败：创建 blob 失败');
    const blob = await blobResp.json();
    // 2) 创建 tree
    const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }] })
    });
    if(!treeResp.ok) throw new Error('初始化失败：创建 tree 失败');
    const tree = await treeResp.json();
    // 3) 创建 commit（无父提交，作为首个提交）
    const commitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ message: 'Init TOTP data', tree: tree.sha, parents: [] })
    });
    if(!commitResp.ok) throw new Error('初始化失败：创建 commit 失败');
    const commit = await commitResp.json();
    // 4) 创建分支引用 refs/heads/<branch>
    const refName = `refs/heads/${branch||'main'}`;
    const refResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ ref: refName, sha: commit.sha })
    });
    if(!refResp.ok) throw new Error('初始化失败：创建分支引用失败');
    // 返回创建后的文件信息（拉取 sha）
    const file = await getFile(owner, repo, path, branch);
    return { content: { sha: file?.sha } };
  }

  async function putFile(owner, repo, path, content, sha, branch){
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const body = {
      message: sha ? 'Update TOTP data' : 'Create TOTP data',
      content: content,
      ...(sha ? { sha } : {}),
      ...(branch ? { branch } : {})
    };
    const resp = await fetch(url, { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if(resp.ok){
      return await resp.json();
    }
    // 首次部署或无默认分支时，尝试使用 Git Data API 初始化仓库并写入文件
    if(resp.status === 409 || resp.status === 422 || resp.status === 404){
      return await initRepoWithFile(owner, repo, branch||'main', path, content);
    }
    const errText = await resp.text();
    throw new Error(`写入文件失败（${resp.status}）：${errText}`);
  }

  window.GH_CONTENTS = { getFile, putFile, getSha };
})();