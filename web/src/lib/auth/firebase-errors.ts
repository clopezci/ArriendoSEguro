type AuthErr = { code?: string };

export function mapFirebaseAuthError(e: unknown): string {
  const code = (e as AuthErr)?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "Ese correo ya tiene cuenta. Iniciá sesión o recuperá el acceso.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña no coinciden. Revisalos o creá una cuenta.";
    case "auth/invalid-email":
      return "Revisá que el correo esté bien escrito.";
    case "auth/weak-password":
      return "La contraseña debe ser más larga (mínimo 6 caracteres en Firebase).";
    case "auth/too-many-requests":
      return "Demasiados intentos. Esperá un minuto o probá otra conexión.";
    case "auth/network-request-failed":
      return (
        "No hay conexión con los servidores de Firebase (red o bloqueo). " +
        "Probá: desactivar bloqueadores de anuncios o extensiones de privacidad para este sitio, otra red o datos móviles, " +
        "ventana de incógnito sin extensiones, o revisá antivirus/firewall. " +
        "El restablecimiento de contraseña usa la misma conexión."
      );
    default:
      if (e instanceof Error && e.message) return e.message;
      return "No pudimos completar el paso. Probá de nuevo en un rato.";
  }
}
