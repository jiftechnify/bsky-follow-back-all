import {
  AppBskyActorDefs,
  AtpSessionData,
  AtpSessionEvent,
  BskyAgent,
} from "@atproto/api";
import { ResponseType, XRPCError } from "@atproto/xrpc";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FollowerView } from "./Follower";
import { LoginForm } from "./LoginForm";
import type { Crendentials } from "./types";

import { MdLogout } from "react-icons/md";

import styles from "./App.module.css";
import octocat from "./assets/github-mark.svg";

type GraphActor = AppBskyActorDefs.ProfileView;

const LS_BSKY_SESS_KEY = "bsky_sess";
const LS_UI_LANG_KEY = "ui_lang";

const bskyAgent = new BskyAgent({
  service: "https://bsky.social",
  persistSession: (_: AtpSessionEvent, session: AtpSessionData | undefined) => {
    if (session !== undefined) {
      localStorage.setItem(LS_BSKY_SESS_KEY, JSON.stringify(session));
    }
  },
});

const isXRPCError = (err: unknown): err is XRPCError => {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    "error" in err &&
    "success" in err
  );
};

const resumeSession = async (): Promise<AtpSessionData | undefined> => {
  const jsonBskySess = localStorage.getItem(LS_BSKY_SESS_KEY);
  if (jsonBskySess === null) {
    return undefined;
  }

  console.log("resuming session...");
  try {
    const sess = JSON.parse(jsonBskySess) as AtpSessionData;
    await bskyAgent.resumeSession(sess);
    console.log("resumed session");
    return sess;
  } catch (err) {
    console.error("failed to resume session:", err);
    return undefined;
  }
};

const withResumeSession = async <T extends unknown>(
  fn: () => Promise<T>,
  maxRetry = 3,
  retryCnt = 0
): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (isXRPCError(err) && err.status === ResponseType.AuthRequired) {
      if (retryCnt !== maxRetry) {
        console.log("auth required -> resume session and retry");
        await resumeSession();
        return withResumeSession(fn, maxRetry, retryCnt + 1);
      } else {
        console.error("exceeded max retry count");
        throw err;
      }
    }
    throw err;
  }
};

type GetActorsResult = {
  actors: GraphActor[];
  cursor: string | undefined;
};

async function fetchAllActors(
  step: (cursor: string) => Promise<GetActorsResult>
): Promise<GraphActor[]> {
  let cursor = "";
  const res: GraphActor[] = [];

  while (true) {
    const resp = await step(cursor);
    res.push(...resp.actors);
    if (!resp.cursor || resp.actors.length === 0) {
      return res;
    }
    cursor = resp.cursor;
  }
}

const getFollowersStep = (
  sess: AtpSessionData
): ((cursor: string) => Promise<GetActorsResult>) => {
  return async (cursor: string) => {
    const resp = await withResumeSession(() =>
      bskyAgent.getFollowers({
        actor: sess.handle,
        cursor,
      })
    );
    return { actors: resp.data.followers, cursor: resp.data.cursor };
  };
};

const getFollowingsStep = (
  sess: AtpSessionData
): ((cursor: string) => Promise<GetActorsResult>) => {
  return async (cursor: string) => {
    const resp = await withResumeSession(() =>
      bskyAgent.getFollows({
        actor: sess.handle,
        cursor,
      })
    );
    return { actors: resp.data.follows, cursor: resp.data.cursor };
  };
};

const getMutesStep = async (cursor: string): Promise<GetActorsResult> => {
  const resp = await withResumeSession(() =>
    bskyAgent.app.bsky.graph.getMutes({ cursor })
  );
  return { actors: resp.data.mutes, cursor: resp.data.cursor };
};

type AppState =
  | "initial"
  | "resumingSession"
  | "beforeLogin"
  | "loginInProgress"
  | "loginFailed"
  | "fetchFollowersInProgress"
  | "fetchedFollowers"
  | "fetchFollowersFailed"
  | "followBackInProgress"
  | "followedBack";

const messageKeyForState = (s: AppState): string => {
  switch (s) {
    case "initial":
    case "beforeLogin":
      return "message.blank";

    case "loginInProgress":
    case "resumingSession":
      return "message.loginInProgress";

    case "loginFailed":
      return "message.loginFailed";

    case "fetchFollowersInProgress":
      return "message.fetchingFollowers";

    case "fetchedFollowers":
      return "message.fetchedFollowers";

    case "fetchFollowersFailed":
      return "message.fetchFollowersFailed";

    case "followBackInProgress":
      return "message.followingBack";

    case "followedBack":
      return "message.followedBack";
  }
};

const notLoggedIn = (s: AppState): boolean => {
  const notLoggedInStates: AppState[] = [
    "beforeLogin",
    "loginInProgress",
    "loginFailed",
  ];
  return notLoggedInStates.includes(s);
};

const loggedIn = (s: AppState): boolean => {
  const notLoggedInStates: AppState[] = [
    "fetchFollowersInProgress",
    "fetchedFollowers",
    "fetchFollowersFailed",
    "followBackInProgress",
    "followedBack",
  ];
  return notLoggedInStates.includes(s);
};

const hasFetchedFollowers = (s: AppState): boolean => {
  const hasFetchedStates: AppState[] = [
    "fetchedFollowers",
    "followBackInProgress",
  ];
  return hasFetchedStates.includes(s);
};

type Language = "ja" | "en";
const nextLang = (lang: Language): Language => {
  switch (lang) {
    case "ja":
      return "en";
    case "en":
      return "ja";
  }
};

export const App = () => {
  const session = useRef<AtpSessionData | undefined>(undefined);

  const [appState, setAppState] = useState<AppState>("initial");

  const [followers, setFollowers] = useState<GraphActor[]>([]);
  const [followings, setFollowings] = useState<GraphActor[]>([]);
  const [mutes, setMutes] = useState<GraphActor[]>([]);

  const { t, i18n } = useTranslation();

  const fetchFollowers = async () => {
    if (session.current === undefined) {
      console.error("session has not started");
      return;
    }

    setAppState("fetchFollowersInProgress");
    const [followersRes, followingsRes, mutesRes] = await Promise.all([
      fetchAllActors(getFollowersStep(session.current)),
      fetchAllActors(getFollowingsStep(session.current)),
      fetchAllActors(getMutesStep),
    ]);

    setFollowers(followersRes);
    setFollowings(followingsRes);
    setMutes(mutesRes);
    setAppState("fetchedFollowers");
  };

  const onClickLogin = async (creds: Crendentials) => {
    setAppState("loginInProgress");

    try {
      const loginResp = await bskyAgent.login({
        identifier: creds.email,
        password: creds.password,
      });
      session.current = loginResp.data;
    } catch (err) {
      console.error("failed to login:", err);
      setAppState("loginFailed");
      return;
    }

    await fetchFollowers();
  };

  // tasks just after launch
  // - restore language setting
  // - resume bsky session (if session is stored)
  useEffect(() => {
    if (appState !== "initial") {
      return;
    }

    const restoreLang = () => {
      const lastUsedLang = localStorage.getItem(LS_UI_LANG_KEY);
      if (lastUsedLang !== null) {
        i18n.changeLanguage(lastUsedLang);
      } else {
        const systemLang = window.navigator.language;
        i18n.changeLanguage(systemLang === "ja" ? "ja" : "en");
      }
    };

    const resumeSess = async () => {
      const jsonBskySess = localStorage.getItem(LS_BSKY_SESS_KEY);
      if (jsonBskySess === null) {
        setAppState("beforeLogin");
        return;
      }

      setAppState("resumingSession");
      try {
        const sess = JSON.parse(jsonBskySess) as AtpSessionData;
        await bskyAgent.resumeSession(sess);
        session.current = sess;
      } catch (err) {
        console.error("failed to resume session:", err);
        setAppState("beforeLogin");
        return;
      }

      await fetchFollowers();
    };

    restoreLang();
    resumeSess().catch((err) => console.error(err));
  }, []);

  const onClickLogout = () => {
    session.current = undefined;
    localStorage.removeItem(LS_BSKY_SESS_KEY);

    setFollowers([]);
    setFollowings([]);
    setMutes([]);

    setAppState("beforeLogin");
  };

  const followingsDIDSet = useMemo(() => {
    return new Set(followings.map((actor) => actor.did));
  }, [followings]);

  const mutesDIDSet = useMemo(() => {
    return new Set(mutes.map((actor) => actor.did));
  }, [mutes]);

  const { notFollowed, alreadyFollowed } = useMemo(() => {
    const notFollowed: GraphActor[] = [];
    const alreadyFollowed: GraphActor[] = [];

    followers.forEach((follower) => {
      // exclude muted actors
      if (mutesDIDSet.has(follower.did)) {
        return;
      }

      if (followingsDIDSet.has(follower.did)) {
        alreadyFollowed.push(follower);
      } else {
        notFollowed.push(follower);
      }
    });
    return { notFollowed, alreadyFollowed };
  }, [followers, followingsDIDSet, mutesDIDSet]);

  const followBackAll = useCallback(
    async (notFollowedActors: GraphActor[]) => {
      if (session.current === undefined) {
        return;
      }
      setAppState("followBackInProgress");

      for (const target of notFollowedActors) {
        console.log(`following ${target.handle}...`);
        try {
          await withResumeSession(() => bskyAgent.follow(target.did));
          setFollowings((prev) => [...prev, target]);
        } catch (err) {
          console.error(err);
        }
      }
      setAppState("followedBack");
    },
    [notFollowed]
  );

  const onClickLang = () => {
    const lang = nextLang(i18n.language as Language);
    i18n.changeLanguage(lang);
    localStorage.setItem(LS_UI_LANG_KEY, lang);
  };

  return (
    <>
      <div className={styles.container}>
        <h1 className={styles.title}>Bluesky Follow Back All</h1>
        <div className={styles.main}>
          <div className={styles.message}>
            {t(messageKeyForState(appState))}
          </div>
          {notLoggedIn(appState) && (
            <LoginForm
              onClickLogin={onClickLogin}
              loginInProgress={appState === "loginInProgress"}
            ></LoginForm>
          )}
          {hasFetchedFollowers(appState) && notFollowed.length > 0 && (
            <div>
              <div>
                {t("text.numNotFollowing")} {notFollowed.length}
              </div>
              <button
                className={styles.followAll}
                type="button"
                onClick={() => followBackAll(notFollowed)}
                disabled={appState === "followBackInProgress"}
              >
                {t("ui.followAll")}
              </button>
            </div>
          )}
          {hasFetchedFollowers(appState) && notFollowed.length === 0 && (
            <div>{t("text.alreadyFollowingAll")}</div>
          )}
          <div className={styles.followers}>
            {notFollowed.map((actor) => (
              <FollowerView key={actor.did} actor={actor} isFollowing={false} />
            ))}
            {alreadyFollowed.map((actor) => (
              <FollowerView key={actor.did} actor={actor} isFollowing={true} />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.toolBtns}>
        <button className={styles.btnLang} type="button" onClick={onClickLang}>
          {i18n.language}
        </button>
        {loggedIn(appState) && (
          <button
            className={styles.btnLogout}
            type="button"
            onClick={onClickLogout}
          >
            <MdLogout className={styles.btnLogoutIcon} />
          </button>
        )}
      </div>
      <div className={styles.linkToRepo}>
        <a href="https://github.com/jiftechnify/bsky-follow-back-all">
          <img src={octocat} width={20} height={20} />
        </a>
      </div>
    </>
  );
};
