-- Function to sync auth.users to profiles table
CREATE OR REPLACE FUNCTION sync_users_to_profiles()
RETURNS void AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Loop through all auth.users
    FOR user_record IN 
        SELECT id, email, raw_user_meta_data
        FROM auth.users
    LOOP
        -- Check if a profile exists for this user
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_record.id) THEN
            -- Extract display name from metadata if available
            DECLARE
                display_name text := split_part(user_record.email, '@', 1);
                avatar_url text := null;
            BEGIN
                IF user_record.raw_user_meta_data IS NOT NULL 
                   AND user_record.raw_user_meta_data::jsonb ? 'name' THEN
                    display_name := user_record.raw_user_meta_data::jsonb->>'name';
                END IF;
                
                -- Insert the profile
                INSERT INTO profiles (id, email, display_name, avatar_url, updated_at, created_at)
                VALUES (
                    user_record.id, 
                    user_record.email, 
                    display_name, 
                    avatar_url,
                    now(),
                    now()
                );
                
                RAISE NOTICE 'Created profile for user %', user_record.email;
            END;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Profile synchronization complete';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to sync a specific user
CREATE OR REPLACE FUNCTION sync_user_to_profile(user_email text)
RETURNS json AS $$
DECLARE
    user_record RECORD;
    result json;
BEGIN
    -- Find the user
    SELECT id, email, raw_user_meta_data
    INTO user_record
    FROM auth.users
    WHERE email = user_email;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;
    
    -- Check if a profile exists
    IF EXISTS (SELECT 1 FROM profiles WHERE id = user_record.id) THEN
        -- Update existing profile
        UPDATE profiles 
        SET email = user_record.email,
            updated_at = now()
        WHERE id = user_record.id;
        
        RETURN json_build_object(
            'success', true, 
            'message', 'Profile updated', 
            'user_id', user_record.id
        );
    ELSE
        -- Extract display name from metadata if available
        DECLARE
            display_name text := split_part(user_record.email, '@', 1);
            avatar_url text := null;
        BEGIN
            IF user_record.raw_user_meta_data IS NOT NULL 
               AND user_record.raw_user_meta_data::jsonb ? 'name' THEN
                display_name := user_record.raw_user_meta_data::jsonb->>'name';
            END IF;
            
            -- Insert the profile
            INSERT INTO profiles (id, email, display_name, avatar_url, updated_at, created_at)
            VALUES (
                user_record.id, 
                user_record.email, 
                display_name, 
                avatar_url,
                now(),
                now()
            );
            
            RETURN json_build_object(
                'success', true, 
                'message', 'Profile created', 
                'user_id', user_record.id
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution privileges
GRANT EXECUTE ON FUNCTION sync_users_to_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_to_profile(text) TO authenticated; 