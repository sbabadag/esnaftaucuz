-- Add INSERT policy for users table
-- This allows authenticated users to create their own profile after signup

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;

-- Create policy: Authenticated users can insert their own profile
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Also allow insert for guest users (when is_guest = true)
-- This is needed for guest login functionality
DROP POLICY IF EXISTS "Users can create guest profile" ON public.users;

CREATE POLICY "Users can create guest profile" ON public.users
  FOR INSERT 
  TO anon
  WITH CHECK (is_guest = true);




