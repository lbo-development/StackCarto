import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const BRAND = {
  dark: "#2E7D32",
  base: "#4CAF50",
  light: "#A8C545",
  soft: "#F5F8F2",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#DDE6D7",
};

export default function AuthPage({ onClose }) {
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [hoverSubmit, setHoverSubmit] = useState(false);

  const submitLabel = useMemo(() => {
    if (loading) {
      return mode === "signin" ? "Connexion..." : "Création...";
    }
    return mode === "signin" ? "Se connecter" : "Créer le compte";
  }, [loading, mode]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;

        setMessage(
          "Compte créé. Vérifie ton email si la confirmation est activée.",
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;

        onClose?.();
      }
    } catch (err) {
      setError(err.message || "Erreur d’authentification.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.brandBlock}>
          <img
            src="/DIgitalBonsai.png"
            alt="Digital Bonsai"
            style={styles.logo}
          />
          <h2 style={styles.heading}>Bienvenue dans SPADIA</h2>
          <p style={styles.subheading}>
            Connectez-vous pour accéder à l’arborescence documentaire et à vos
            fonctionnalités sécurisées.
          </p>
        </div>

        <div style={styles.topBar}>
          <div style={styles.switchRow}>
            <button
              type="button"
              onClick={() => switchMode("signin")}
              style={{
                ...styles.switchBtn,
                ...(mode === "signin" ? styles.switchBtnActive : {}),
              }}
            >
              Connexion
            </button>

            <button
              type="button"
              onClick={() => switchMode("signup")}
              style={{
                ...styles.switchBtn,
                ...(mode === "signup" ? styles.switchBtnActive : {}),
              }}
            >
              Inscription
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.closeBtn}
            aria-label="Fermer la fenêtre"
          >
            ✕
          </button>
        </div>

        {message ? <div style={styles.success}>{message}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "signup" && (
            <div style={styles.field}>
              <label style={styles.label}>Nom complet</label>
              <input
                type="text"
                placeholder="Ex. Laurent Bohbot"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="vous@domaine.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
              autoComplete="email"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              ...(hoverSubmit && !loading ? styles.submitBtnHover : {}),
              ...(loading ? styles.submitBtnDisabled : {}),
            }}
            onMouseEnter={() => setHoverSubmit(true)}
            onMouseLeave={() => setHoverSubmit(false)}
          >
            {submitLabel}
          </button>
        </form>

        <div style={styles.footerNote}>
          {mode === "signin"
            ? "Pas encore de compte ? Passe sur l’onglet Inscription."
            : "Déjà inscrit ? Revenez sur l’onglet Connexion."}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(18, 32, 18, 0.42)",
    backdropFilter: "blur(7px)",
    WebkitBackdropFilter: "blur(7px)",
    display: "grid",
    placeItems: "center",
    zIndex: 5000,
    padding: "20px",
  },
  modal: {
    width: "100%",
    maxWidth: "460px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,246,0.98) 100%)",
    borderRadius: "24px",
    padding: "26px",
    border: `1px solid ${BRAND.border}`,
    boxShadow: "0 22px 60px rgba(0,0,0,0.22)",
  },
  brandBlock: {
    textAlign: "center",
    marginBottom: "22px",
  },
  logo: {
    height: "70px",
    width: "auto",
    objectFit: "contain",
    marginBottom: "12px",
  },
  heading: {
    margin: "0 0 6px",
    fontSize: "28px",
    lineHeight: 1.1,
    color: BRAND.dark,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  subheading: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.5,
    color: BRAND.muted,
  },
  topBar: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
  },
  closeBtn: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    border: `1px solid ${BRAND.border}`,
    background: "#fff",
    cursor: "pointer",
    color: BRAND.text,
    fontSize: "16px",
    fontWeight: 700,
  },
  switchRow: {
    display: "flex",
    gap: "8px",
  },
  switchBtn: {
    flex: 1,
    height: "42px",
    borderRadius: "12px",
    border: `1px solid ${BRAND.border}`,
    background: BRAND.soft,
    cursor: "pointer",
    fontWeight: 700,
    color: BRAND.text,
    transition: "all 0.2s ease",
  },
  switchBtnActive: {
    background: `linear-gradient(135deg, ${BRAND.base}, ${BRAND.dark})`,
    color: "#fff",
    borderColor: BRAND.base,
    boxShadow: "0 8px 18px rgba(76, 175, 80, 0.22)",
  },
  form: {
    display: "grid",
    gap: "14px",
  },
  field: {
    display: "grid",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    color: BRAND.text,
  },
  input: {
    height: "46px",
    borderRadius: "14px",
    border: `1px solid ${BRAND.border}`,
    background: "#fff",
    padding: "0 14px",
    fontSize: "14px",
    color: BRAND.text,
    outline: "none",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
  },
  submitBtn: {
    height: "48px",
    border: "none",
    borderRadius: "14px",
    background: `linear-gradient(135deg, ${BRAND.base}, ${BRAND.dark})`,
    color: "#fff",
    fontWeight: 800,
    letterSpacing: "0.01em",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginTop: "6px",
  },
  submitBtnHover: {
    transform: "translateY(-1px)",
    boxShadow: "0 12px 24px rgba(76,175,80,0.28)",
  },
  submitBtnDisabled: {
    opacity: 0.8,
    cursor: "wait",
  },
  error: {
    marginBottom: "14px",
    padding: "11px 12px",
    borderRadius: "12px",
    background: "#FEF2F2",
    color: "#B91C1C",
    border: "1px solid #FECACA",
    fontSize: "13px",
    fontWeight: 600,
  },
  success: {
    marginBottom: "14px",
    padding: "11px 12px",
    borderRadius: "12px",
    background: "#ECFDF5",
    color: "#166534",
    border: "1px solid #A7F3D0",
    fontSize: "13px",
    fontWeight: 600,
  },
  footerNote: {
    marginTop: "14px",
    fontSize: "12px",
    color: BRAND.muted,
    textAlign: "center",
  },
};
