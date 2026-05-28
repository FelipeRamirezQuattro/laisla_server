import { Request } from 'express';

export interface AuthPayload {
  id: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export interface CompatibilityProfile {
  socialEnergy: number;
  conversationType: 'deep' | 'intellectual' | 'creative' | 'entrepreneurial' | 'casual' | 'balanced';
  workAttitude: number;
  hobbies: string[];
  spontaneity: number;
  dinnerStyle: 'intimate' | 'lively' | 'experiential';
  personalityTag: 'intellectual' | 'empathetic' | 'aesthetic' | 'adventurous';
}

export interface GuestForMatching {
  _id: string;
  name: string;
  ageRange: string;
  compatibilityProfile: CompatibilityProfile;
}

export interface MatchingGroup {
  groupNumber: number;
  guests: string[];
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}
