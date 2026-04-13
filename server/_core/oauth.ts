import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getWhitelistEntry, markWhitelistUsed } from "../db-whitelist";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // Retry helper for rate-limited OAuth calls
    const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delayMs = 2000): Promise<T> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          const msg = (err?.message || err?.toString() || "").toLowerCase();
          if (msg.includes("rate") && attempt < retries) {
            console.log(`[OAuth] Rate limited — retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})`);
            await new Promise(r => setTimeout(r, delayMs));
            continue;
          }
          throw err;
        }
      }
      throw new Error("Max retries exceeded");
    };

    try {
      const tokenResponse = await withRetry(() => sdk.exchangeCodeForToken(code, state));
      const userInfo = await withRetry(() => sdk.getUserInfo(tokenResponse.accessToken));

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const isOwner = userInfo.openId === ENV.ownerOpenId;

      // Step 1: Check if user already exists by their OAuth openId
      let existingUser = await db.getUserByOpenId(userInfo.openId);

      // Step 2: If not found by openId, try to find by email (invited users have temporary openIds)
      if (!existingUser && userInfo.email) {
        const database = await getDb();
        if (database) {
          const emailMatch = await database
            .select()
            .from(users)
            .where(eq(users.email, userInfo.email))
            .limit(1);

          if (emailMatch.length > 0) {
            const matchedUser = emailMatch[0];
            // Found a user with the same email — update their openId to the real OAuth openId
            console.log(`[OAuth] Linking existing user "${matchedUser.name}" (email: ${userInfo.email}) to OAuth openId: ${userInfo.openId}`);
            await database
              .update(users)
              .set({
                openId: userInfo.openId,
                loginMethod: userInfo.loginMethod ?? userInfo.platform ?? matchedUser.loginMethod,
                lastSignedIn: new Date(),
                name: userInfo.name || matchedUser.name,
              })
              .where(eq(users.id, matchedUser.id));

            existingUser = { ...matchedUser, openId: userInfo.openId };
          }
        }
      }

      // Step 3: If user doesn't exist, check the email whitelist
      if (!existingUser && !isOwner) {
        if (!userInfo.email) {
          console.log(`[OAuth] Access denied: no email provided by OAuth. openId=${userInfo.openId}`);
          res.redirect(302, "/?access=denied");
          return;
        }

        const whitelistEntry = await getWhitelistEntry(userInfo.email);

        if (!whitelistEntry) {
          // Email NOT in whitelist — block access
          console.log(`[OAuth] Access denied: email "${userInfo.email}" not in whitelist. openId=${userInfo.openId}`);
          res.redirect(302, "/?access=denied");
          return;
        }

        // Email IS in whitelist — auto-create user with the whitelisted role
        console.log(`[OAuth] Whitelisted email "${userInfo.email}" — creating user with role: ${whitelistEntry.role}`);
        const database = await getDb();
        if (database) {
          await database.insert(users).values({
            openId: userInfo.openId,
            name: whitelistEntry.name || userInfo.name || null,
            email: userInfo.email,
            loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
            role: whitelistEntry.role,
            status: "Active",
            lastSignedIn: new Date(),
          });

          // Mark the whitelist entry as used
          await markWhitelistUsed(userInfo.email);

          existingUser = {
            id: 0, // will be set by upsert below
            openId: userInfo.openId,
            name: whitelistEntry.name || userInfo.name || null,
            email: userInfo.email,
            role: whitelistEntry.role,
          } as any;
        }
      }

      // Step 4: Upsert user (creates owner on first login, updates existing users)
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error: any) {
      console.error("[OAuth] Callback failed", error);
      const errMsg = (error?.message || error?.toString() || "").toLowerCase();
      if (errMsg.includes("rate")) {
        // Show a friendly retry page that auto-retries after 2 seconds
        const retryUrl = req.originalUrl;
        res.status(429).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Please wait...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #334155; }
    .card { background: white; border-radius: 16px; padding: 48px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 420px; width: 90%; }
    .spinner { width: 48px; height: 48px; border: 4px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 24px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 14px; color: #64748b; margin-bottom: 24px; }
    .countdown { font-size: 32px; font-weight: 700; color: #6366f1; }
    .btn { display: inline-block; margin-top: 16px; padding: 10px 24px; background: #6366f1; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; text-decoration: none; }
    .btn:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Almost there!</h2>
    <p>The server is busy. Retrying automatically...</p>
    <div class="countdown" id="timer">2</div>
    <a class="btn" href="/" style="margin-top:24px;">Go to Homepage</a>
  </div>
  <script>
    let seconds = 2;
    const timer = document.getElementById('timer');
    const interval = setInterval(() => {
      seconds--;
      timer.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(interval);
        timer.textContent = '...';
        window.location.href = '/';
      }
    }, 1000);
  </script>
</body>
</html>`);
        return;
      }
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
