// client/src/lib/apiRequest.ts
interface ApiRequestOptions extends RequestInit {
  data?: unknown;
}

export async function apiRequest<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { data, headers: customHeaders, ...restOptions } = options;

  const defaultHeaders: HeadersInit = {
    // Default headers can be added here if needed, e.g., Authorization
  };

  if (data) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const headers = new Headers({ ...defaultHeaders, ...customHeaders });

  const config: RequestInit = {
    ...restOptions,
    headers,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // If response is not JSON, use text
      errorData = { message: await response.text() };
    }
    console.error('API Request Error:', response.status, errorData);
    throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
  }

  // Handle cases where response might be empty (e.g., 204 No Content)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json() as Promise<T>;
  } else {
    // If not JSON, or no content, resolve with null or handle as appropriate
    // For a generic function, returning the Response object or text might be safer
    // but for this app, we usually expect JSON or an error.
    // If it's a 204, response.json() would fail.
    if (response.status === 204) {
      return null as unknown as T; // Or handle as per specific app needs
    }
    // For other non-JSON responses, you might want to return text or throw
    const text = await response.text();
    try {
      // Try to parse as JSON anyway, in case content-type is missing/wrong
      return JSON.parse(text) as T;
    } catch (e) {
      // If still fails, return text or throw. For now, let's assume it might be an error.
      // This part depends on how non-JSON success responses should be handled.
      // For this app, most successful GETs return JSON, POSTs might return created object or 201/204.
      console.warn(`API response for ${url} was not JSON. Status: ${response.status}. Body: ${text.substring(0,100)}...`);
      // If you expect non-JSON text as a valid response, return `text as unknown as T;`
      // For now, assuming if it's not JSON and not 204, it's unexpected for a <T> promise.
      // Let's try to return it as T, but this might cause runtime issues if T is not string.
      return text as unknown as T;
    }
  }
}
