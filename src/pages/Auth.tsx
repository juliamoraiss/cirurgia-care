import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Activity, Stethoscope } from "lucide-react";
import { Navigate } from "react-router-dom";
import { z } from "zod";

const signUpSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  confirmPassword: z.string(),
  userType: z.enum(["medico", "dentista"], { required_error: "Selecione sua profissão" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const Auth = () => {
  const { signIn, signUp, user, loading, isApproved } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  
  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // Signup form state
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    userType: "" as "medico" | "dentista" | "",
  });
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  // Redirect if already logged in and approved
  if (!loading && user && isApproved) {
    return <Navigate to="/" replace />;
  }
  
  // Redirect to pending approval if logged in but not approved
  if (!loading && user && !isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(username, password);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Login error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});
    
    const result = signUpSchema.safeParse(signupData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setSignupErrors(errors);
      return;
    }
    
    setIsLoading(true);
    try {
      await signUp(signupData.email, signupData.password, signupData.fullName, signupData.userType as "medico" | "dentista");
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Signup error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Activity className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Sistema de Cirurgias</CardTitle>
          <CardDescription>
            Gerencie pacientes e procedimentos cirúrgicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuário ou Email</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Digite seu usuário ou email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-3">
                  <Label>Profissão *</Label>
                  <RadioGroup
                    value={signupData.userType}
                    onValueChange={(value) => setSignupData(prev => ({ ...prev, userType: value as "medico" | "dentista" }))}
                    className="grid grid-cols-2 gap-3"
                  >
                    <Label
                      htmlFor="medico"
                      className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                        signupData.userType === "medico" 
                          ? "border-primary bg-primary/5" 
                          : "border-muted hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value="medico" id="medico" className="sr-only" />
                      <Stethoscope className={`h-8 w-8 mb-2 ${signupData.userType === "medico" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`font-medium ${signupData.userType === "medico" ? "text-primary" : ""}`}>Médico</span>
                    </Label>
                    <Label
                      htmlFor="dentista"
                      className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                        signupData.userType === "dentista" 
                          ? "border-primary bg-primary/5" 
                          : "border-muted hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value="dentista" id="dentista" className="sr-only" />
                      <svg 
                        className={`h-8 w-8 mb-2 ${signupData.userType === "dentista" ? "text-primary" : "text-muted-foreground"}`}
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                      >
                        <path d="M12 2C8.5 2 6 4.5 6 7.5c0 2 1 3.5 2 4.5-.5 2-1.5 6-1 8 .5 2 2 2.5 3 2.5s2-.5 2-2v-3c0-.5.5-1 1-1s1 .5 1 1v3c0 1.5 1 2 2 2s2.5-.5 3-2.5c.5-2-.5-6-1-8 1-1 2-2.5 2-4.5C20 4.5 17.5 2 14 2h-2z" />
                      </svg>
                      <span className={`font-medium ${signupData.userType === "dentista" ? "text-primary" : ""}`}>Dentista</span>
                    </Label>
                  </RadioGroup>
                  {signupErrors.userType && (
                    <p className="text-sm text-destructive">{signupErrors.userType}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder={signupData.userType === "dentista" ? "Dr(a). Maria Santos" : "Dr(a). João Silva"}
                    value={signupData.fullName}
                    onChange={(e) => setSignupData(prev => ({ ...prev, fullName: e.target.value }))}
                    required
                  />
                  {signupErrors.fullName && (
                    <p className="text-sm text-destructive">{signupErrors.fullName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupEmail">Email</Label>
                  <Input
                    id="signupEmail"
                    type="email"
                    placeholder="email@clinica.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                  {signupErrors.email && (
                    <p className="text-sm text-destructive">{signupErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupPassword">Senha</Label>
                  <Input
                    id="signupPassword"
                    type="password"
                    placeholder="••••••••"
                    value={signupData.password}
                    onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  {signupErrors.password && (
                    <p className="text-sm text-destructive">{signupErrors.password}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                  {signupErrors.confirmPassword && (
                    <p className="text-sm text-destructive">{signupErrors.confirmPassword}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Cadastrando..." : "Cadastrar"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Após o cadastro, um administrador precisará aprovar seu acesso.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
