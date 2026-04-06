import { useEffect, useState } from "react";
import MapLayout from "./components/MapLayout";
import AuthPage from "./components/AuthPage";
import { supabase } from "./lib/supabase";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  async function loadProfile() {
    try {
      const { data, error } = await supabase.rpc("get_my_profile");

      if (error) {
        console.error("Erreur get_my_profile:", error);
        setProfile(null);
        return;
      }

      const row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
      setProfile(row);
    } catch (err) {
      console.error("Erreur chargement profil:", err);
      setProfile(null);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(currentSession ?? null);
        setBootLoading(false);

        if (currentSession) {
          loadProfile();
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Erreur initialisation auth:", err);
        if (isMounted) {
          setBootLoading(false);
        }
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);

      if (newSession) {
        loadProfile();
        setShowAuth(false);
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setProfile(null);
    } catch (err) {
      console.error("Erreur logout:", err);
    }
  }

  if (bootLoading) {
    return <div />;
  }

  return (
    <>
      <MapLayout
        session={session}
        profile={profile}
        onLoginClick={() => setShowAuth(true)}
        onLogout={handleLogout}
      />

      {showAuth && <AuthPage onClose={() => setShowAuth(false)} />}
    </>
  );
}
