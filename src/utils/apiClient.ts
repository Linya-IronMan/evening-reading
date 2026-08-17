const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
const port = typeof window !== 'undefined' ? window.location.port : '';

// 如果当前直接在 1421 端口运行，使用相对路径 ''；
// 否则自动跟随当前页面的 hostname 动态指向该 IP/主机的 1421 后端端口
export const API_BASE_URL = port === '1421' ? '' : `http://${host}:1421`;

export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> {
    try {
        const res = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res;
    } catch (error) {
        if (retries > 0 && (!options.method || options.method.toUpperCase() === 'GET')) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, retries - 1, delay * 2);
        }
        throw error;
    }
}
