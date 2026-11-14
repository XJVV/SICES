"use client";

import * as React from "react";
import { LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/i18n";
import type { AuthUser } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  openLogin: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loginOpen, setLoginOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } catch {
      // silencioso
    }
  }, []);

  const openLogin = React.useCallback(() => setLoginOpen(true), []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, openLogin }}>
      {children}
      <AuthDialog open={loginOpen} onOpenChange={setLoginOpen} onAuthenticated={refresh} />
    </AuthContext.Provider>
  );
}

function AuthDialog({
  open,
  onOpenChange,
  onAuthenticated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAuthenticated: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [busy, setBusy] = React.useState(false);

  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [regName, setRegName] = React.useState("");
  const [regEmail, setRegEmail] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t.toast.error, description: data.error, variant: "destructive" });
        return;
      }
      await onAuthenticated();
      toast({ title: t.auth.welcome.replace("{name}", data.user.name) });
      onOpenChange(false);
      setLoginPassword("");
    } catch {
      toast({ title: t.toast.error, description: t.common.errorLoad, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t.toast.error, description: data.error, variant: "destructive" });
        return;
      }
      await onAuthenticated();
      toast({ title: t.auth.registered });
      onOpenChange(false);
      setRegPassword("");
    } catch {
      toast({ title: t.toast.error, description: t.common.errorLoad, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hud-panel z-50 sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="hud-label">{t.auth.secureAccess}</span>
          </div>
          <DialogTitle className="display-title text-lg">{t.auth.title}</DialogTitle>
          <DialogDescription>{t.auth.description}</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t.auth.login}</TabsTrigger>
            <TabsTrigger value="register">{t.auth.register}</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <form onSubmit={submitLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">{t.auth.email}</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="demo@sices.dev"
                  className="input-terminal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">{t.auth.password}</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-terminal"
                />
              </div>
              <Button type="submit" disabled={busy} className="glow-primary w-full">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {busy ? t.common.loading : t.auth.login}
              </Button>
              <p className="text-xs text-muted-foreground">{t.auth.demoHint}</p>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <form onSubmit={submitRegister} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">{t.auth.name}</Label>
                <Input
                  id="reg-name"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">{t.auth.email}</Label>
                <Input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password">{t.auth.password}</Label>
                <Input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.auth.passwordHint}</p>
              </div>
              <Button type="submit" disabled={busy} className="glow-primary w-full">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                {busy ? t.common.loading : t.auth.register}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** Chip de usuario / botón de acceso para la cabecera. */
export function AuthHeaderButton() {
  const { user, loading, logout, openLogin } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return <Button variant="outline" size="sm" className="h-9 w-24 animate-pulse" aria-label="loading" />;
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" className="h-9" onClick={openLogin}>
        <LogIn className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t.auth.login}</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5"
        title={user.email}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary" aria-hidden="true">
          {user.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="text-xs font-semibold">{user.name}</p>
          <p className="hud-label text-[9px]">{user.role === "ADMIN" ? t.auth.admin : t.auth.userRole}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="h-9" onClick={logout} aria-label={t.auth.logout}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
