import {
  AppBskyActorRef,
  AtpAgent,
  AtpSessionData,
  AtpSessionEvent
} from "@atproto/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FollowerView } from "./Follower";
import { LoginForm } from "./LoginForm";
import type { Crendentials } from "./types";

import { MdLogout } from "react-icons/md";

import styles from "./App.module.css";
import octocat from "./assets/github-mark.svg";

type GraphActor = AppBskyActorRef.WithInfo;

const LS_BSKY_SESS_KEY = "bsky_sess";
const LS_UI_LANG_KEY = "ui_lang";

const atpAgent = new AtpAgent({
  service: "https://bsky.social",
  persistSession: (_: AtpSessionEvent, session: AtpSessionData | undefined) => {
    if (session !== undefined) {
      localStorage.setItem(LS_BSKY_SESS_KEY, JSON.stringify(session));
    }
  },
});

const bsky = atpAgent.api.app.bsky;

const now = () => new Date().toISOString();

const getFollowers = async (sess: AtpSessionData) => {
  let cursor = "";
  const result: GraphActor[] = [];

  while (true) {
    const resp = await bsky.graph.getFollowers({
      user: sess.handle,
      before: cursor,
    });
    result.push(...resp.data.followers);
    if (!resp.data.cursor || resp.data.followers.length === 0) {
      return result;
    }
    cursor = resp.data.cursor;
  }
};

const getFollowings = async (sess: AtpSessionData) => {
  let cursor = "";
  const result: GraphActor[] = [];

  while (true) {
    const resp = await bsky.graph.getFollows({
      user: sess.handle,
      before: cursor,
    });
    result.push(...resp.data.follows);
    if (!resp.data.cursor || resp.data.follows.length === 0) {
      return result;
    }
    cursor = resp.data.cursor;
  }
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

  const { t, i18n } = useTranslation();

  const fetchFollowers = async () => {
    if (session.current === undefined) {
      console.error("session has not started");
      return;
    }

    setAppState("fetchFollowersInProgress");
    const [followersRes, followingsRes] = await Promise.all([
      getFollowers(session.current),
      getFollowings(session.current),
    ]);

    setFollowers(followersRes);
    setFollowings(followingsRes);
    setAppState("fetchedFollowers");
  };

  const onClickLogin = async (creds: Crendentials) => {
    setAppState("loginInProgress");

    try {
      const loginResp = await atpAgent.login({
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
      const lang = localStorage.getItem(LS_UI_LANG_KEY);
      if (lang !== null) {
        i18n.changeLanguage(lang);
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
        await atpAgent.resumeSession(sess);
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

    setAppState("beforeLogin");
  };

  const followingsDIDSet = useMemo(() => {
    return new Set(followings.map((actor) => actor.did));
  }, [followings]);

  const { notFollowed, alreadyFollowed } = useMemo(() => {
    const notFollowed: GraphActor[] = [];
    const alreadyFollowed: GraphActor[] = [];

    followers.forEach((follower) => {
      if (followingsDIDSet.has(follower.did)) {
        alreadyFollowed.push(follower);
      } else {
        notFollowed.push(follower);
      }
    });
    return { notFollowed, alreadyFollowed };
  }, [followers, followings]);

  const followBackAll = useCallback(
    async (notFollowedActors: GraphActor[]) => {
      if (session.current === undefined) {
        return;
      }
      setAppState("followBackInProgress");

      for (const target of notFollowedActors) {
        console.log(`following ${target.handle}...`);
        try {
          await bsky.graph.follow.create(
            { did: session.current.did },
            {
              subject: {
                did: target.did,
                declarationCid: target.declaration.cid,
              },
              createdAt: now(),
            }
          );
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
    localStorage.setItem(LS_UI_LANG_KEY, lang)
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
