addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // 新增：检查用户是否直接访问代理地址
  if (url.pathname === "/" || url.pathname === "/proxy/") {
    return createLandingPage();
  }

  const actualUrlStr =
    url.pathname.replace("/proxy/", "") + url.search + url.hash;

  const actualUrl = new URL(actualUrlStr);

  // 获取请求者的IP地址
  const ip = request.headers.get("CF-Connecting-IP");

  // 仅当KV命名空间存在时更新请求次数，并传递IP地址  
  if (typeof MY_KV_NAMESPACE !== "undefined") {
    await updateRequestCount(actualUrl.href,ip);
  }

    // 复制原始请求的headers
  let headers = new Headers(request.headers);
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36"
  );
  headers.set(
    "Accept",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9"
  );
  // 可以根据需要添加更多请求头

  const modifiedRequest = new Request(actualUrl, {
    headers: headers,
    method: request.method,
    body: request.body,
    redirect: "follow",
  });

  const response = await fetch(modifiedRequest);
  const modifiedResponse = new Response(response.body, response);

  // 添加允许跨域访问的响应头
  modifiedResponse.headers.set("Access-Control-Allow-Origin", "*");
  // 允许cookie
  modifiedResponse.headers.set("Access-Control-Allow-Credentials", "true");
   // 修改Set-Cookie头的Domain属性
  const setCookieHeader = response.headers.get("Set-Cookie");
  if (setCookieHeader) {
    const updatedSetCookieHeader = setCookieHeader
      .split(',')
      .map(cookie => {
        // 找到并替换Domain属性
        return cookie.replace(/(Domain=)([^;]+)/i, `\$1.paperai.life`);
      })
      .join(',');

    modifiedResponse.headers.set("Set-Cookie", updatedSetCookieHeader);
  }
  return modifiedResponse;
}

// 更新特定URL的请求计数，并记录请求IP
async function updateRequestCount(url, ip) {
  let data = await MY_KV_NAMESPACE.get(url, "json");
  if (data) {
    data.count = data.count + 1;
    data.ips = data.ips || [];
    if (!data.ips.includes(ip)) {
      data.ips.push(ip); // 为了简化，这里不考虑IP数组过大的情况
    }
  } else {
    data = { count: 1, ips: [ip] };
  }
  await MY_KV_NAMESPACE.put(url, JSON.stringify(data));

  console.log(`URL ${url} has been requested ${data.count} times by IPs: ${data.ips.join(", ")}.`);
}

// 新增：创建引导页面
function createLandingPage() {
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <style>
  body {
    background-color: #fbfbfb;
    font-family: Arial, sans-serif;
  }

  h1 {
    text-align: center;
    color: #444;
  }

  .container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }

  form {
    background-color: white;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
    padding: 2rem;
    border-radius: 8px;
  }

  input {
    display: block;
    width: 100%;
    font-size: 18px;
    padding: 15px;
    border: solid 1px #ccc;
    border-radius: 4px;
    margin: 1rem 0;
  }

  button {
    padding: 15px;
    background-color: #0288d1;
    color: white;
    font-size: 18px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
  }

  button:hover {
    background-color: #039BE5;
  }
</style>
    <meta charset="UTF-8">
    <title>代理服务器</title>
  </head>
  <body>
    <h1>输入您想访问的网址</h1>
    <form id="proxy-form">
      <input type="text" id="url" name="url" placeholder="https://example.com" required />
      <button type="submit">访问</button>
    </form>
    <script>
      const form = document.getElementById('proxy-form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const input = document.getElementById('url');
        const actualUrl = input.value;
        const proxyUrl = '/proxy/' + actualUrl;
        location.href = proxyUrl;
      });
    </script>
  </body>
  </html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
