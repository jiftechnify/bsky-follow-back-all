import { AppBskyActorRef, AtpAgent, AtpSessionData } from "@atproto/api";
import { useCallback, useMemo, useState } from "react";
import { FollowerView } from "./Follower";
import { LoginForm } from "./LoginForm";
import type { Crendentials } from "./types";

import styles from "./App.module.css";
import octocat from "./assets/github-mark.svg";

type GraphActor = AppBskyActorRef.WithInfo;

const atpAgent = new AtpAgent({ service: "https://bsky.social" });

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
  | "loginInProgress"
  | "loginFailed"
  | "fetchFollowersInProgress"
  | "fetchedFollowers"
  | "fetchFollowersFailed"
  | "followBackInProgress"
  | "followedBack";

const messageForState = (s: AppState): string => {
  switch (s) {
    case "initial":
      return "";
    case "loginInProgress":
      return "ログイン中…";
    case "loginFailed":
      return "ログイン失敗🤔";
    case "fetchFollowersInProgress":
      return "フォロワーを取得中…";
    case "fetchedFollowers":
      return "フォロワー取得完了";
    case "fetchFollowersFailed":
      return "フォロワー取得失敗😵";
    case "followBackInProgress":
      return "フォローバック中…";
    case "followedBack":
      return "フォローバック完了🎉";
  }
};

const hasFetchedFollowers = (s: AppState): boolean => {
  const hasFetchedStates: AppState[] = [
    "fetchedFollowers",
    "followBackInProgress",
  ];
  return hasFetchedStates.includes(s);
};

export const App = () => {
  const [session, setSession] = useState<AtpSessionData | undefined>(undefined);

  const [followers, setFollowers] = useState<GraphActor[]>([]);
  const [followings, setFollowings] = useState<GraphActor[]>([]);

  const [appState, setAppState] = useState<AppState>("initial");

  const onClickLogin = async (creds: Crendentials) => {
    setAppState("loginInProgress");

    let sess: AtpSessionData | undefined;
    try {
      const loginResp = await atpAgent.login({
        identifier: creds.email,
        password: creds.password,
      });
      sess = loginResp.data;
      setSession(sess);
    } catch (err) {
      setAppState("loginFailed");
      return;
    }

    setAppState("fetchFollowersInProgress");
    const [followersRes, followingsRes] = await Promise.all([
      getFollowers(sess as AtpSessionData),
      getFollowings(sess as AtpSessionData),
    ]);

    setFollowers(followersRes);
    setFollowings(followingsRes);
    setAppState("fetchedFollowers");
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
      if (session === undefined) {
        return;
      }
      setAppState("followBackInProgress");

      for (const target of notFollowedActors) {
        console.log(`following ${target.handle}...`);
        try {
          await bsky.graph.follow.create(
            { did: session.did },
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

  return (
    <>
      <div className={styles.container}>
        <h1 className={styles.title}>Bluesky Follow Back All</h1>
        <div className={styles.main}>
          <div className={styles.message}>{messageForState(appState)}</div>
          {session === undefined && (
            <LoginForm
              onClickLogin={onClickLogin}
              loginInProgress={appState === "loginInProgress"}
            ></LoginForm>
          )}
          {hasFetchedFollowers(appState) && notFollowed.length > 0 && (
            <div>
              <div>未フォローバックユーザ数: {notFollowed.length}</div>
              <button
                className={styles.followAll}
                type="button"
                onClick={() => followBackAll(notFollowed)}
                disabled={appState === "followBackInProgress"}
              >
                すべてフォロー
              </button>
            </div>
          )}
          {hasFetchedFollowers(appState) && notFollowed.length === 0 && (
            <div>全員フォロー済み🎉</div>
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
      <div className={styles.linkToRepo}>
        <a href="https://github.com/jiftechnify/bsky-follow-back-all">
          <img src={octocat} width={20} height={20} />
        </a>
      </div>
    </>
  );
};
