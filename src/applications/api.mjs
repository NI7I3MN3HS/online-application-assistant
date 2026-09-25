export function request(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, response => {
      const error = chrome.runtime.lastError;
      if (error) return reject(new Error(error.message));
      if (!response?.ok) return reject(Object.assign(new Error(response?.error || '操作未完成，请重试。'), { code: response?.code }));
      resolve(response.data);
    });
  });
}
export function formatTime(value) {
  if (!value) return '尚无填写记录';
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', year: 'numeric', hour12: false });
}
export const node = (tag, properties = {}) => Object.assign(document.createElement(tag), properties);
