'use server'

import { getValidAccessToken as getToken } from './supabase-server'

export async function getValidAccessToken(userId: string): Promise<string> {
  return getToken(userId)
} 