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

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

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
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
