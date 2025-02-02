-- Function to update a user's ID while maintaining referential integrity
create or replace function update_user_id(old_id uuid, new_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Update the user's ID
  update auth.users
  set id = new_id
  where id = old_id;

  -- Update the user's ID in the public schema
  update users
  set id = new_id
  where id = old_id;

  -- Update foreign key references
  update connections
  set user_id = new_id
  where user_id = old_id;
end;
$$; 