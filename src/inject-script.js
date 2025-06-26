// Inject script for html5Game.do
console.log('Injected script loaded!');

// Function to convert https:// URLs to http://
function convertHttpsToHttp(url) {
  if (typeof url === 'string' && url.startsWith('https://')) {
    const convertedUrl = url.replace('https://', 'http://');
    console.log(`URL converted: ${url} -> ${convertedUrl}`);
    return convertedUrl;
  }
  return url;
}

// Override fetch to convert https to http
const originalFetch = window.fetch;
window.fetch = function(input, init) {
  let url = input;
  
  // Handle Request object
  if (input instanceof Request) {
    url = convertHttpsToHttp(input.url);
    // Create new Request with converted URL
    const newRequest = new Request(url, {
      method: input.method,
      headers: input.headers,
      body: input.body,
      mode: input.mode,
      credentials: input.credentials,
      cache: input.cache,
      redirect: input.redirect,
      referrer: input.referrer,
      integrity: input.integrity
    });
    return originalFetch.call(this, newRequest, init);
  } else {
    // Handle string URL
    url = convertHttpsToHttp(input);
    return originalFetch.call(this, url, init);
  }
};

// Override XMLHttpRequest to convert https to http
const OriginalXMLHttpRequest = window.XMLHttpRequest;
window.XMLHttpRequest = function() {
  const xhr = new OriginalXMLHttpRequest();
  const originalOpen = xhr.open;
  
  xhr.open = function(method, url, async, user, password) {
    const convertedUrl = convertHttpsToHttp(url);
    return originalOpen.call(this, method, convertedUrl, async, user, password);
  };
  
  return xhr;
};

// Example: Add custom functionality
window.customGameEnhancements = {
  init: function() {
    console.log('Custom game enhancements initialized');
    console.log('HTTPS to HTTP converter is active');
    // Add your custom code here
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.customGameEnhancements.init);
} else {
  window.customGameEnhancements.init();
}
