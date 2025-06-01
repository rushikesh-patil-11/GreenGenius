import { AuthObject } from '@clerk/clerk-sdk-node';

declare global {
  namespace Express {
    export interface Request {
      auth: AuthObject;
    }
  }
}

// Adding an empty export to make this file a module.
export {};
