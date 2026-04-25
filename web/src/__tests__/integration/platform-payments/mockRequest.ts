export function jsonPost(
  url: string,
  body: unknown,
  token?: string,
): Request {
  const headers: HeadersInit = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export function jsonGet(url: string, token?: string): Request {
  const headers: HeadersInit = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(url, { method: "GET", headers });
}

