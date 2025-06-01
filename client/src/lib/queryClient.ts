import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react"; // Added for Clerk auth

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// apiRequest needs to be defined in a context where useAuth can be called,
// or getToken needs to be passed in. For simplicity in this context,
// we'll assume this file might be refactored to allow hook usage or getToken is available globally.
// This is a conceptual update based on memory. A direct call to useAuth here is not standard
// outside of a React component or custom hook. 
// For a library function like this, getToken would typically be passed as an argument or retrieved
// from a more accessible auth state manager if not using React Query's context capabilities.

// Simulating how it might be if Clerk's getToken was accessible directly or via a passed function:
// This is a placeholder to illustrate the logic from memory. Actual implementation might differ.
// A better approach for React Query is to use a custom fetcher that has access to the Clerk token.

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  getToken?: () => Promise<string | null> // Optional: Pass getToken if useAuth can't be used directly
): Promise<Response> {
  const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};

  // Attempt to get token if getToken function is provided (conceptual)
  // In a real React Query setup, this token fetching would be integrated into the query/mutation function
  // often using a custom hook that wraps useAuth or by having ClerkProvider context available.
  if (typeof getToken === 'function') { // Check if getToken was passed
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else {
    // Fallback or warning if used without a token strategy for protected routes
    // This part highlights the challenge of using useAuth directly in a non-component file.
    // The memory implies 'useAuth' was used, which suggests apiRequest might have been
    // refactored into a custom hook or the memory simplified the description.
    console.warn('apiRequest called without a getToken function for a potentially protected route. If this route requires auth, it may fail.');
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (data && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = JSON.stringify(data);
  }

  const res = await fetch(url, fetchOptions);

  // 'credentials: "include"' is usually for cookie-based auth, not Bearer tokens.
  // It can be kept if other parts of the app use cookies, but for Clerk Bearer token auth,
  // the Authorization header is key.
  // credentials: "include", 

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
