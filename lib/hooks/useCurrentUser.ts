'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { User } from '@supabase/supabase-js';

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }
        
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Subscribe to auth changes
    const { data: authListener } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, error };
} 