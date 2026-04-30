-- ============================================================
-- MediCare+ sample data seed
-- Run this in the Supabase SQL Editor (uses elevated privileges
-- so it bypasses RLS).
-- ============================================================
-- 1) Make sure each doctor has a corresponding `doctors` row.
--    For any profile with role='doctor' that doesn't yet have
--    one, insert a default row.

INSERT INTO public.doctors (user_id, specialty, fee, experience_years, rating, max_patients_per_day, city, province, bio)
SELECT
  p.id,
  'General Physician',
  500,
  5,
  4.5,
  20,
  'Peshawar',
  'Khyber Pakhtunkhwa',
  'Experienced doctor.'
FROM public.profiles p
WHERE p.role = 'doctor'
  AND NOT EXISTS (SELECT 1 FROM public.doctors d WHERE d.user_id = p.id);

-- 2) Demo / sample doctors. These create real auth users (email
--    confirmed) plus matching profiles + doctors rows so the app
--    has data to display across cities and specialties.

DO $$
DECLARE
  v_id uuid;
  v_email text;
  v_data record;
BEGIN
  FOR v_data IN
    SELECT * FROM (VALUES
      ('Ahmed Khan',     'General Physician',  'Peshawar',   'Khyber Pakhtunkhwa', 600, 8, 4.7, 25),
      ('Sara Iqbal',     'Cardiologist',       'Peshawar',   'Khyber Pakhtunkhwa', 1500, 12, 4.8, 18),
      ('Bilal Aslam',    'Dermatologist',      'Peshawar',   'Khyber Pakhtunkhwa', 1200, 10, 4.6, 22),
      ('Fatima Noor',    'Pediatrician',       'Peshawar',   'Khyber Pakhtunkhwa', 800, 7, 4.9, 30),
      ('Usman Tariq',    'Orthopedic',         'Abbottabad', 'Khyber Pakhtunkhwa', 1300, 11, 4.5, 20),
      ('Hira Malik',     'Gynecologist',       'Abbottabad', 'Khyber Pakhtunkhwa', 1400, 9, 4.8, 18),
      ('Khalid Mehmood', 'Neurologist',        'Lahore',     'Punjab',             2000, 15, 4.9, 15),
      ('Ayesha Siddiqui','Dentist',            'Lahore',     'Punjab',             900, 6, 4.6, 24),
      ('Zain Abbas',     'ENT Specialist',     'Lahore',     'Punjab',             1100, 9, 4.7, 22),
      ('Mariam Yousaf',  'Psychiatrist',       'Karachi',    'Sindh',              1800, 13, 4.8, 16),
      ('Imran Ali',      'Ophthalmologist',    'Karachi',    'Sindh',              1500, 14, 4.7, 20),
      ('Asad Raza',      'Urologist',          'Islamabad',  'Islamabad Capital Territory', 2200, 16, 4.9, 14),
      ('Nadia Sheikh',   'General Physician',  'Islamabad',  'Islamabad Capital Territory', 700, 8, 4.6, 28),
      ('Faisal Hussain', 'Cardiologist',       'Karachi',    'Sindh',              1900, 17, 4.9, 15)
    ) AS t(name, specialty, city, province, fee, exp, rating, mppd)
  LOOP
    v_email := lower(replace(v_data.name, ' ', '.')) || '@medicare.demo';

    -- Skip if a profile with this email/name already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      CONTINUE;
    END IF;

    -- Create auth user (confirmed)
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt('Demo123!', gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',array['email']),
      jsonb_build_object('name', v_data.name),
      now(), now(), '', '', '', ''
    );

    -- Profile (in case no trigger created one)
    INSERT INTO public.profiles (id, role, name, city, province)
    VALUES (v_id, 'doctor', v_data.name, v_data.city, v_data.province)
    ON CONFLICT (id) DO UPDATE
      SET role = 'doctor',
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          province = EXCLUDED.province;

    -- Doctor row
    INSERT INTO public.doctors (
      user_id, specialty, fee, experience_years, rating,
      max_patients_per_day, city, province, bio, easypaisa_number
    ) VALUES (
      v_id, v_data.specialty, v_data.fee, v_data.exp, v_data.rating,
      v_data.mppd, v_data.city, v_data.province,
      'Highly rated ' || v_data.specialty || ' practising in ' || v_data.city || '.',
      '03001234567'
    )
    ON CONFLICT (user_id) DO NOTHING;

  END LOOP;
END$$;

-- Verify
SELECT specialty, city, COUNT(*) AS doctors
FROM public.doctors
GROUP BY specialty, city
ORDER BY city, specialty;
