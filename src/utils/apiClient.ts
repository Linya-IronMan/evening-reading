// 如果当前不在 1421 端口运行（如桌面端 Webview 或 Vite 调试端），统一指向本地后端
export const API_BASE_URL = window.location.port === '1421' ? '' : 'http://127.0.0.1:1421';

export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> {
    try {
        const res = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        
        if (!res.ok && res.status !== 404) {
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
