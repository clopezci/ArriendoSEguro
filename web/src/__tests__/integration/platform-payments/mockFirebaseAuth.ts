import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";

type User = { uid: string; email: string };

function bearer(request: Request): string {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
}

export function installFirebaseAuthMock(usersByToken: Record<string, User>) {
  async function requireAuthUserTestHook(request: Request) {
    const token = bearer(request);
    const user = usersByToken[token];
    if (!user) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { success: false, errors: [{ field: "auth", message: "Token inválido o faltante." }] },
          { status: 401 },
        ),
      };
    }
    return {
      ok: true as const,
      user: {
        ...user,
        decoded: { uid: user.uid, email: user.email } as DecodedIdToken,
      },
    };
  }
  globalThis.__TEST_REQUIRE_AUTH_USER__ = requireAuthUserTestHook;

  async function getAuthUserTestHook(request: Request) {
    const token = bearer(request);
    const user = usersByToken[token];
    if (!user) return null;
    return {
      ...user,
      decoded: { uid: user.uid, email: user.email } as DecodedIdToken,
    };
  }
  globalThis.__TEST_GET_AUTH_USER__ = getAuthUserTestHook;
}

export function clearFirebaseAuthMock() {
  globalThis.__TEST_GET_AUTH_USER__ = undefined;
  globalThis.__TEST_REQUIRE_AUTH_USER__ = undefined;
}

