import { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { buildShareRedirectPath, peekPendingShareIntent } from "@/lib/shareIntent";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isApproved: boolean;
  approvalChecked: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, userType: "medico" | "dentista") => Promise<void>;
  getPostAuthRedirectPath: () => string;
  recheckApproval: (userId: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [approvalChecked, setApprovalChecked] = useState(false);
  const initializedRef = useRef(false);
  const approvalRequestRef = useRef(0);
  const lastUserIdRef = useRef<string | null>(null);
  const navigate = useNavigate();

  const getPostAuthRedirectPath = () => {
    const pending = peekPendingShareIntent();
    return pending ? buildShareRedirectPath(pending) : "/";
  };

  const checkApprovalStatus = async (userId: string) => {
    const requestId = ++approvalRequestRef.current;

    try {
      const { data, error } = await supabase
        .rpc('is_user_approved', { _user_id: userId });

      const approved = !error && data === true;
      if (requestId === approvalRequestRef.current) {
        setIsApproved(approved);
        setApprovalChecked(true);
      }

      return approved;
    } catch {
      if (requestId === approvalRequestRef.current) {
        setIsApproved(false);
        setApprovalChecked(true);
      }
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        const nextUserId = session?.user?.id ?? null;
        const userChanged = lastUserIdRef.current !== nextUserId;
        const shouldBlockUi = !initializedRef.current || userChanged;
        const shouldRecheckApproval =
          !!nextUserId && (!initializedRef.current || userChanged || event === "SIGNED_IN");

        lastUserIdRef.current = nextUserId;

        setSession(session);
        setUser(session?.user ?? null);
        // Só bloqueia a UI quando a identidade da sessão muda de fato.
        // Em mobile/desktop, ao voltar do background, o Supabase pode disparar
        // eventos de refresh da sessão; nesses casos mantemos a tela atual.
        if (session?.user && shouldBlockUi) {
          setLoading(true);
          setApprovalChecked(false);
        }

        void (async () => {
          if (session?.user && shouldRecheckApproval) {
            await checkApprovalStatus(session.user.id);
          } else if (session?.user) {
            setApprovalChecked(true);
          } else {
            approvalRequestRef.current += 1;
            setIsApproved(false);
            setApprovalChecked(true);
          }

          if (isMounted && initializedRef.current && shouldBlockUi) {
            setLoading(false);
          }
        })();
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;

      lastUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await checkApprovalStatus(session.user.id);
      } else {
        setIsApproved(false);
        setApprovalChecked(true);
      }

      initializedRef.current = true;
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (usernameOrEmail: string, password: string) => {
    try {
      let email = usernameOrEmail;
      
      // Se não for um email (não contém @), buscar email pelo username
      if (!usernameOrEmail.includes('@')) {
        const { data: emailData, error: emailError } = await supabase
          .rpc('get_email_by_username', { _username: usernameOrEmail });
        
        if (emailError || !emailData) {
          toast.error("Usuário não encontrado");
          throw new Error("Usuário não encontrado");
        }
        
        email = emailData;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Check approval status after login
      if (data.user) {
        const { data: approvedData } = await supabase
          .rpc('is_user_approved', { _user_id: data.user.id });
        
        if (!approvedData) {
          toast.info("Sua conta ainda está aguardando aprovação do administrador.");
          navigate("/pending-approval");
          return;
        }
      }
      
      toast.success("Login realizado com sucesso!");
      // Não navegar aqui: a página Auth já resolve corretamente o redirect
      // a partir de ?redirect=... ou do pending_share_surgery em sessionStorage.
      return;
    } catch (error: any) {
      toast.error("Erro ao fazer login. Verifique suas credenciais.");
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string, userType: "medico" | "dentista") => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
            user_type: userType,
          },
        },
      });
      
      if (error) throw error;
      
      toast.success("Cadastro realizado! Aguarde a aprovação do administrador para acessar o sistema.");
      navigate("/pending-approval");
    } catch (error: any) {
      if (error.message?.includes("already registered")) {
        toast.error("Este email já está cadastrado.");
      } else {
        toast.error("Erro ao criar conta. Tente novamente.");
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error && !error.message?.includes("Session not found")) {
        throw error;
      }
      
      setSession(null);
      setUser(null);
      setIsApproved(false);
      
      toast.success("Logout realizado com sucesso!");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Erro ao fazer logout");
      setSession(null);
      setUser(null);
      setIsApproved(false);
      navigate("/auth");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isApproved, approvalChecked, signIn, signUp, getPostAuthRedirectPath, recheckApproval: checkApprovalStatus, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
