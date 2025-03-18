'use server'

import { supabaseAdmin } from './supabase-admin'
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function getValidAccessToken(userId: string) {
  const { data: connection, error } = await supabaseAdmin
    .from('connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .single();

  if (error || !connection) {
    throw new Error('Microsoft connection not found');
  }

  const now = new Date();
  const expiresAt = new Date(connection.expires_at);

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Token expired or expiring soon, refreshing...');
    const { accessToken, refreshToken, expiresAt: newExpiresAt } = await refreshAccessToken(connection.refresh_token);

    // Update the connection with new tokens
    await supabaseAdmin
      .from('connections')
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return accessToken;
  }

  return connection.access_token;
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export const createServerClient = (cookieStore: ReturnType<typeof cookies>) => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}; 