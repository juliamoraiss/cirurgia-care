
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'secretary');

-- Create enum for patient status
CREATE TYPE public.patient_status AS ENUM (
  'awaiting_authorization',
  'authorized',
  'pending_scheduling',
  'surgery_scheduled',
  'surgery_completed',
  'cancelled'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (NEVER store roles in profiles!)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has any role
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
  )
$$;

-- Create patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  procedure TEXT NOT NULL,
  hospital TEXT,
  insurance TEXT,
  insurance_number TEXT,
  status patient_status NOT NULL DEFAULT 'awaiting_authorization',
  authorization_date DATE,
  surgery_date TIMESTAMPTZ,
  contact_date DATE,
  notes TEXT,
  exams_checklist TEXT[],
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on patients
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Create patient_files table for uploads
CREATE TABLE public.patient_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on patient_files
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

-- Create patient_history table for tracking changes
CREATE TABLE public.patient_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on patient_history
ALTER TABLE public.patient_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for patients
CREATE POLICY "Authenticated users can view all patients"
  ON public.patients FOR SELECT
  USING (public.is_authenticated_user());

CREATE POLICY "Secretaries and admins can create patients"
  ON public.patients FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'secretary') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Secretaries and admins can update patients"
  ON public.patients FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'secretary') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Only admins can delete patients"
  ON public.patients FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for patient_files
CREATE POLICY "Authenticated users can view patient files"
  ON public.patient_files FOR SELECT
  USING (public.is_authenticated_user());

CREATE POLICY "Secretaries and admins can upload files"
  ON public.patient_files FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'secretary') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete files"
  ON public.patient_files FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for patient_history
CREATE POLICY "Authenticated users can view history"
  ON public.patient_history FOR SELECT
  USING (public.is_authenticated_user());

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to log patient changes
CREATE OR REPLACE FUNCTION public.log_patient_changes()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.patient_history (patient_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status', OLD.status::TEXT, NEW.status::TEXT, auth.uid());
  END IF;
  
  IF OLD.surgery_date IS DISTINCT FROM NEW.surgery_date THEN
    INSERT INTO public.patient_history (patient_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'surgery_date', OLD.surgery_date::TEXT, NEW.surgery_date::TEXT, auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to log patient changes
CREATE TRIGGER log_patient_status_changes
  AFTER UPDATE ON public.patients
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION public.log_patient_changes();

-- Create storage bucket for patient files
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-files', 'patient-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for patient files
CREATE POLICY "Authenticated users can view patient files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'patient-files' AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Secretaries and admins can upload patient files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'patient-files' AND
    (public.has_role(auth.uid(), 'secretary') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Admins can delete patient files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'patient-files' AND
    public.has_role(auth.uid(), 'admin')
  );
