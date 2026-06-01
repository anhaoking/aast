const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe';
const out = path.join(process.env.TEMP, 'GitSetup.exe');

console.log('正在下载 Git 安装包 (约60MB)，请稍候...');

const file = fs.createWriteStream(out);

function download(targetUrl) {
  https.get(targetUrl, { rejectUnauthorized: false }, (res) => {
    if (res.statusCode === 302 && res.headers.location) {
      return download(res.headers.location);
    }
    const total = parseInt(res.headers['content-length'] || '0');
    let downloaded = 0;
    res.on('data', (chunk) => {
      downloaded += chunk.length;
      if (total) process.stdout.write('\r下载进度: ' + Math.round(downloaded / total * 100) + '%');
    });
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('\n✅ 下载完成: ' + out);
      console.log('请双击运行 ' + out + ' 安装 Git');
      console.log('安装时一直点 Next 即可，完成后重新打开命令行验证: git --version');
    });
  }).on('error', (e) => {
    console.error('下载失败: ' + e.message);
    console.log('\n请手动下载: https://git-scm.com/download/win');
  });
}

download(url);
